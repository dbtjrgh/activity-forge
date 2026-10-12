/**
 * 사람이 준 답을 남기고, 레시피에 얹는다.
 *
 * **레시피가 아니라 답만 남긴다.** 레시피를 통째로 남기면 리소스를 더 넣었을 때
 * 맞추기(`swap`)가 다시 도는 길이 막힌다 — 남긴 레시피가 옛 파일 이름을 그대로
 * 들고 있으니까. 답만 남기면 **매번 새로 클론·맞추기한 위에 답을 얹을** 수 있어
 * 둘이 다투지 않는다. 그리고 「무엇을 사람이 정했는지」가 글로 남는다.
 *
 * **자리는 `_recipe/<코드>.answer.json` 이다.** 새 창고를 만들지 않았다 —
 * `_recipe` 는 이미 「화면에서 채운 값」이 사는 곳이고 `.gitignore` 에 들어
 * 있다(호 저장소에 같은 값이 들어가므로 올리지 않는다). `_recipe` 를 훑는
 * 코드는 forge 에 없으므로 옆에 한 장 더 놓아도 걸리는 것이 없다(확인함).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Answer, AnswerBy, AnswerFile } from '../../../shared/forge'
import { nameInBase } from './rscplace'

export function answerFile(repoRoot: string, code: string): string {
  return path.join(repoRoot, '_recipe', `${code}.answer.json`)
}

export function readAnswers(repoRoot: string, code: string): AnswerFile {
  const file = answerFile(repoRoot, code)
  if (!fs.existsSync(file)) return { code, answers: [] }
  try {
    const got = JSON.parse(fs.readFileSync(file, 'utf8')) as AnswerFile
    return { code, answers: Array.isArray(got.answers) ? got.answers : [] }
  } catch {
    // 깨진 파일 때문에 양산 전체가 멈추면 안 된다. 답이 없는 셈 친다.
    return { code, answers: [] }
  }
}

/**
 * 새 답을 얹어 남긴다. **같은 자리는 덮고, 나머지는 그대로 둔다.**
 *
 * 답을 통째로 갈아치우지 않는 까닭 — 화면은 그때 펼쳐 놓은 카드의 답만
 * 보낸다. 앞서 답한 자리가 이번 화면에 없다고 지워 버리면, 리소스를 더 넣어
 * 카드가 줄어든 순간 예전 답이 조용히 사라진다.
 */
/**
 * **누가 답했나를 부르는 쪽이 꼭 댄다** (2026-09-29, M4) — 「AI 가 한 일」이 줄마다 누가 바꿨는지 보인다.
 * 사람 답은 `rerun.ts`(화면에서 보낸 것), AI 답은 맞추기 · 값 고치기 · 이름과 차례 · 짜임이다.
 * **앱 안의 길은 늘 댄다.** 안 대는 것은 forge 시험 도구(`tool/wire.ts` 등)뿐이고, 그 답은 「모름」으로 남는다 — 짐작해 적지 않는다.
 */
export function saveAnswers(repoRoot: string, code: string, fresh: Answer[], by?: AnswerBy): AnswerFile {
  const at = new Date().toISOString()
  const kept = readAnswers(repoRoot, code).answers
  const merged = new Map(kept.map((a) => [a.path, a]))
  for (const a of fresh) merged.set(a.path, { ...a, at, ...(by ? { by } : {}) })

  const out: AnswerFile = { code, answers: [...merged.values()] }
  const file = answerFile(repoRoot, code)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf8')
  return out
}

/**
 * 답 몇 개를 **뺀다.** 파일 이름을 바꿔 이룬 답(`rscname.ts`)이 그렇다 — 남겨 두면
 * 다음 판에 이미 없는 옛 이름을 그 자리에 다시 적는다.
 */
export function dropAnswers(repoRoot: string, code: string, paths: string[]): void {
  if (!paths.length) return
  const gone = new Set(paths)
  const out: AnswerFile = { code, answers: readAnswers(repoRoot, code).answers.filter((a) => !gone.has(a.path)) }
  fs.writeFileSync(answerFile(repoRoot, code), JSON.stringify(out, null, 2) + '\n', 'utf8')
}

export function clearAnswers(repoRoot: string, code: string): void {
  fs.rmSync(answerFile(repoRoot, code), { force: true })
}

/**
 * 답을 레시피에 얹는다. 넣은 수와, 자리를 못 찾아 못 넣은 것을 돌려준다.
 *
 * **못 넣은 것을 조용히 넘기지 않는다.** 스펙이 바뀌어 자리가 없어졌는데
 * 「답 3개 넣음」이라고 하면, 사람은 자기가 정한 값이 들어간 줄 안다.
 */
export function applyAnswers(
  recipe: unknown,
  answers: Answer[],
  gameDataRoot: string
): { put: number; missed: string[] } {
  const missed: string[] = []
  let put = 0
  for (const a of answers) {
    if (setAt(recipe, a.path, a.value, gameDataRoot)) put++
    else missed.push(a.path)
  }
  return { put, missed }
}

/**
 * `quizData.inningData[1].items[0].popup` 이나 `assets.image.bgFrame2` 자리에
 * 값을 넣는다.
 *
 * 두 갈래다 —
 *   `assets.<갈래>.<별칭>`   그 별칭의 **파일 이름**을 바꾼다
 *   그 밖                    gameData 안의 그 자리에 값을 넣는다
 *
 * **없는 자리는 만들지 않는다.** 마디를 따라가다 없으면 false 다. 짐작해서
 * 새 열쇠를 만들면 모듈이 안 읽는 자리에 값이 들어가고, 그것은 아무도 못 본다.
 * 다만 **마지막 마디만은** 없어도 넣는다 — 빠진 값을 채우는 것이 이 일이다.
 */
function setAt(recipe: unknown, path: string, value: unknown, gameDataRoot: string): boolean {
  const asset = /^assets\.(image|sound|lottie|font)\.(.+)$/.exec(path)
  if (asset) {
    const list = (recipe as { assets?: Record<string, { alias: string; file: string }[]> }).assets?.[
      asset[1]
    ]
    const one = list?.find((x) => x.alias === asset[2])
    if (!one) return false
    // 화면 이름에는 폴더가 붙어 있다 — 그대로 넣으면 `sounds/sounds/nar01.mp3` 를 찾아 404 다.
    one.file = nameInBase(String(value))
    return true
  }

  const rest = path.startsWith(gameDataRoot + '.')
    ? path.slice(gameDataRoot.length + 1)
    : path === gameDataRoot
      ? ''
      : path
  if (!rest) return false

  const steps = parts(rest)
  let here: unknown = (recipe as { gameData?: unknown }).gameData
  for (let i = 0; i < steps.length - 1; i++) {
    if (here === null || typeof here !== 'object') return false
    here = (here as Record<string | number, unknown>)[steps[i]]
  }
  if (here === null || typeof here !== 'object') return false
  ;(here as Record<string | number, unknown>)[steps[steps.length - 1]] = value
  return true
}

/**
 * 레시피에 지금 들어 있는 값. 요구 카드가 「고치기 전 값」으로 보여 준다.
 *
 * **자리 셈은 이 파일 하나가 한다.** 읽는 쪽과 쓰는 쪽이 마디를 따로 세면
 * 「보여준 자리와 넣은 자리가 다르다」가 된다 — 화면에는 고쳐진 것처럼
 * 보이는데 실제로는 딴 데 들어가는, 제일 찾기 어려운 갈래다.
 */
export function valueAt(recipe: unknown, path: string, gameDataRoot: string): unknown {
  const rest = path.startsWith(gameDataRoot + '.') ? path.slice(gameDataRoot.length + 1) : path
  let here: unknown = (recipe as { gameData?: unknown }).gameData
  for (const k of parts(rest)) {
    if (here === null || typeof here !== 'object') return undefined
    here = (here as Record<string | number, unknown>)[k]
  }
  return here
}

/** `a.b[2].c` → `["a","b",2,"c"]` */
function parts(path: string): (string | number)[] {
  const out: (string | number)[] = []
  for (const chunk of path.split('.')) {
    const head = chunk.replace(/\[\d+\]/g, '')
    if (head) out.push(head)
    for (const m of chunk.matchAll(/\[(\d+)\]/g)) out.push(Number(m[1]))
  }
  return out
}
