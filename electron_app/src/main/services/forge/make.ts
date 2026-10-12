/**
 * **만들기 — 한 입구** (2026-09-29, M3). 화면의 「만들기」 · 「다시 만들기」는 이것 하나를 부른다.
 *
 *   입력 지문 → 지난번과 같으면 **부르지 않고** 저장된 결과를 보인다 (0초 · 0토큰)
 *             → 다르면 만드는 쪽(`runAuto`)을 돌리고, 끝난 뒤 지문과 결과를 남긴다
 *
 * **만드는 쪽은 지금 파이프라인 하나다.** M1 판가름이 ㄷ 이었다 — 헤드리스 에이전트 한 번은 옛 길보다
 * 못했다(`_document/자동양산.md` 「M1 판가름」). 갈래가 하나뿐이라 고르는 상수를 두지 않았다.
 * 다른 쪽을 끼울 때는 `MAKER` 한 줄만 바꾼다.
 *
 * **지문은 돌고 난 뒤에 뜬다.** 한 판이 돌면 AI 답이 `answer.json` 에 쌓인다 — 돌기 전에 뜬 지문을
 * 남기면 다음에 누를 때 늘 「바뀌었다」가 된다. 끝난 뒤의 모습을 남겨야 「그 뒤로 아무것도 안 바뀌었다」를
 * 가릴 수 있다.
 *
 * 저장 자리는 `_recipe/<코드>.made.json` 이다(커밋하지 않는 산출물).
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { RunResult } from '../../../shared/forge'
import { answerFile } from './answer'
import { runAuto } from './auto'
import type { OnLog } from './finish'
import { runDry } from './run'
import { track } from './runstate'
import { loadForge, type Forge } from './runtime'
import { sha1Of, stamp, stampTree } from './stamp'
import { tapeMode } from './tape'
import { recordTime } from './times'
import type { Emit } from './step'

/** `view` — 쓴 뒤 띄워 보기까지 갈지. 차례 줄(`queue.ts`)은 쓰기까지만 간다 (M5) */
type Maker = (code: string, emit: Emit, onLog: OnLog, view: boolean) => Promise<RunResult>
const MAKER: Maker = runAuto

type Made = { key: string; at: string; result: RunResult }

/**
 * **지금 도는 코드**의 지문 — 이 파일을 불러올 때 한 번 뜬다. 앱 번들은 띄울 때마다 다시 빌드돼
 * 수정 시각이 바뀌므로 내용으로 잰다. 부를 때마다 디스크에서 읽으면, 옛 앱이 새로 빌드된 번들로
 * 지문을 떠서 **옛 코드의 결과를 새 코드 것처럼** 남긴다(2026-09-29 에 그렇게 됐다).
 */
const SELF = sha1Of(__filename)

const madeFile = (root: string, code: string): string => path.join(root, '_recipe', `${code}.made.json`)

/**
 * 입력 지문. 이것이 같으면 만든 결과도 같다고 본다.
 *
 * - 리소스 폴더 전부(그림 · 소리 · figma 화면 · 기획서) — 크기와 수정 시각
 * - 배치표가 고른 모듈과 원본, 원본의 GameData · AssetTable
 * - 그 모듈의 스펙 · 받아 둔 답 — 내용
 * - 도구 자신(앱 번들 · forge `src/gen`) — 고치면 다시 만든다
 */
export function makeKey(forge: Forge, code: string): string {
  const h = crypto.createHash('sha1')
  const put = (s: string): void => void h.update(s + '\n')
  put(code)
  for (const line of stampTree(forge.files.rscDir(code), forge.files.walk)) put(line)
  const pick = forge.api.layoutFor(code)
  put(JSON.stringify(pick.ok ? [pick.module, pick.origin] : ['모름', pick.error ?? '']))
  if (pick.ok && pick.module && pick.origin) {
    const study = forge.spec.parseStudyCode(pick.origin)
    const act = forge.paths.workPath(`sparkon_m${String(study?.month ?? 0).padStart(2, '0')}`, 'src', 'activity', pick.origin)
    for (const f of ['GameData.ts', 'AssetTable.ts']) put(`${f}|${stamp(path.join(act, f))}`)
    put(sha1Of(forge.spec.specPath(code.slice(0, 2), pick.module)))
  }
  put(sha1Of(answerFile(forge.paths.REPO_ROOT, code)))
  put(SELF)
  for (const line of stampTree(path.join(forge.paths.REPO_ROOT, 'src', 'gen'), forge.files.walk)) put(line)
  return h.digest('hex')
}

/** 지난번 결과가 **지금 입력에 그대로 맞으면** 그것. 아니면 null. */
export function madeFor(forge: Forge, code: string): Made | null {
  try {
    const kept = JSON.parse(fs.readFileSync(madeFile(forge.paths.REPO_ROOT, code), 'utf8')) as Made
    return kept.key === makeKey(forge, code) ? kept : null
  } catch {
    return null
  }
}

/** 한 번이라도 만들어 남긴 적이 있나 — 입력이 바뀌었어도 참이다 (`prepare.ts` 가 처음인지 가린다) */
export function madeBefore(root: string, code: string): boolean {
  return fs.existsSync(madeFile(root, code))
}

/**
 * **AI 없이 보기** — 열 때 · 붙일 때 · 놓을 때 (M2). 그리고 「지금 만들기를 누르면 지난 결과가 그대로
 * 뜨나」를 같이 알린다(`fresh`) — 그러면 화면이 「다시 만들기」에 되묻지 않는다. 돈이 안 나가기 때문이다.
 */
export async function look(code: string, emit: Emit): Promise<RunResult> {
  const out = await runDry(code, emit)
  try {
    out.fresh = madeFor(await loadForge(), code) !== null
  } catch {
    // 못 재면 모른다 — 화면은 되묻는 쪽으로 간다
  }
  return out
}

/** **같은 학습코드가 돌고 있으면 새로 안 돌린다** — 떠났다 돌아온 화면이 그 판에 다시 붙는다 (`runstate.ts`, M4) */
export function make(code: string, emit: Emit, onLog: OnLog, view = true): Promise<RunResult> {
  return track(code, emit, (keep) => makeOnce(code, keep, onLog, view))
}

async function makeOnce(code: string, emit: Emit, onLog: OnLog, view: boolean): Promise<RunResult> {
  const forge = await loadForge()
  const kept = madeFor(forge, code)
  if (kept) return { ...kept.result, reused: kept.at }
  const at = Date.now()
  const out = await MAKER(code, emit, onLog, view)
  // 시작도 못 한 판은 남기지 않는다 — 다음에 누르면 다시 해 봐야 한다
  if (!out.error) {
    // 차례 줄의 「끝나는 시각 어림」 — 모듈별 벽시계 (`times.ts`, M5). **녹음을 켠 판은 안 적는다** —
    // 재생은 AI 를 안 기다려 MAL2 가 12초로 적혔다(실제 9분). 그 기록으로 어림하면 끝나는 때가 한참 틀린다
    const pick = forge.api.layoutFor(code)
    if (tapeMode() === 'off') recordTime(forge.paths.REPO_ROOT, pick.ok ? pick.module : '', Date.now() - at)
    try {
      const made: Made = { key: makeKey(forge, code), at: new Date().toISOString(), result: out }
      fs.writeFileSync(madeFile(forge.paths.REPO_ROOT, code), JSON.stringify(made) + '\n', 'utf8')
    } catch {
      // 못 남기면 다음에 또 만들 뿐이다
    }
  }
  return out
}
