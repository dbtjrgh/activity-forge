/**
 * **통째로 맡기기** — 좁은 물음으로 못 푼 학습코드를 AI 한 명에게 레시피째 맡긴다 (2026-10-02 사용자 결정 — 「응 넣어」).
 *
 * 9-28 M1 은 「에이전트 한 판이 지금 길보다 못하다」였다 — 다만 구조가 원본과 같은 영어 · 수학 학습코드에서 잰 것이다.
 * 구조가 바뀌는 9호 KOL1M08W2S3(K35 퍼즐: 낱말마다 조각 수 · 조각 종류가 다름)에서는 좁은 물음이 오전 내내 못 풀었고,
 * 같은 입력을 한 장에 준 한 판이 3분 · 검사 에러 0 으로 풀었다. 그래서 **지금 길을 먼저 돌리고, 남으면 이리로** 넘긴다.
 *
 * - 시작은 지금 길이 만든 레시피다 — 이름으로 맞춘 것 · AI 답 · 좌표가 이미 들어 있다
 * - 받은 레시피는 **도구가 검사한다**(`api.check`). 에러가 있으면 그 에러를 붙여 두 번까지 다시 묻고,
 *   **지금 길보다 에러가 많으면 버린다**
 * - 남기는 자리는 `_recipe/<코드>.whole.json`. 리소스 폴더(figma · 기획서 포함)가 바뀌면 안 쓴다 — 다음 「생성」이 다시 만든다
 * - `assemble.ts` 끝에서 이것을 쓰고 사람 답을 그 위에 얹는다(`useWhole`). AI 가 짐작이라 한 것은 「확인」 카드다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Answer, Ask, RunResult } from '../../../shared/forge'
import { REVIEW_PREFIX } from '../../../shared/forge'
import { askAi } from './ai'
import { applyAnswers, readAnswers } from './answer'
import { specForBrief } from './revisespec'
import { shotsOf, plansOf } from './shot'
import { stampTree } from './stamp'
import { toMessage } from '../../lib/errors'
import { loadForge, type Forge } from './runtime'
import { stepper, type Emit, type Step } from './step'
import { readWhole, rscTable, wholeBrief, type WholeAsk, type WholeNote } from './wholebrief'

export const WHOLE_STEP = '통째로 맡기기'
/** 그림 수십 장을 열고 레시피 전체를 쓴다 — 재 보니 3분, 넉넉히 */
const WHOLE_TIMEOUT = 20 * 60 * 1000
const TRIES = 3

type Stored = { at: string; key: string; origin: string; module: string; recipe: Record<string, unknown>; notes: WholeNote[]; asks: WholeAsk[]; cost?: number; seconds?: number }

const fileOf = (repoRoot: string, code: string): string => path.join(repoRoot, '_recipe', `${code}.whole.json`)

/** 입력 지문 — 리소스 폴더 전부(figma · 기획서 포함)와 원본 · 모듈. 사람 답은 안 넣는다(그 위에 얹는다) */
function keyOf(forge: Forge, code: string, origin: string, module: string): string {
  const h = crypto.createHash('sha1')
  h.update(`${origin}|${module}\n`)
  for (const line of stampTree(forge.files.rscDir(code), forge.files.walk)) h.update(line + '\n')
  return h.digest('hex')
}

function readStored(forge: Forge, code: string, origin: string, module: string): Stored | null {
  try {
    const s = JSON.parse(fs.readFileSync(fileOf(forge.paths.REPO_ROOT, code), 'utf8')) as Stored
    return s.origin === origin && s.module === module && s.key === keyOf(forge, code, origin, module) ? s : null
  } catch {
    return null
  }
}

/** 「확인」 카드 — 값으로 못 닫으니 `#seen` 으로 닫는다 */
export function wholeCards(asks: WholeAsk[]): Ask[] {
  return asks.map((a) => ({
    id: `${REVIEW_PREFIX}${a.path}`,
    want: '사람이 봐야',
    where: a.path,
    title: a.question,
    desc: a.need ? `확정하려면: ${a.need}` : '',
    // 반영은 이 카드와 상관없이 된다 — 검수 완료만 막는다(`isReview`)
    give: '반영한 뒤 미리보기로 보고 맞으면 「확인」을 누르세요. 좌표가 어긋나면 「지금 화면 좌표 AI로 맞추기」를 쓰세요.',
    options: [],
    shape: 'none',
    count: 1,
    items: [],
    carry: false
  }))
}

export type WholeUse = { at: string; notes: WholeNote[]; asks: WholeAsk[]; cost?: number; seconds?: number }

/** `assemble.ts` 끝 — 맞는 것이 남아 있으면 레시피를 갈아 끼우고 사람 답을 얹는다 */
export async function useWhole(forge: Forge, code: string, pick: { origin: string; module: string }, swapped: { recipe: unknown }, root: string, step: Step): Promise<WholeUse | null> {
  const s = readStored(forge, code, pick.origin, pick.module)
  if (!s) return null
  // 사람 답 + **이것을 만든 뒤에** 남은 AI 답(미리보기를 보고 고친 좌표 — `placefix.ts`). 그 앞의 AI 답은 지금 길의 것이라 이미 녹아 있다.
  // AI 를 먼저, 사람을 나중에 — 같은 자리는 답 파일에 한 줄뿐이라 겹치지 않지만 차례는 사람이 이기게 둔다
  // 좌표(x · y)만 — 다른 AI 답이 뒤에 생겨도 레시피를 덮지 않게 한 겹 더
  const after = (a: Answer): boolean => String((a as { at?: string }).at ?? '') > s.at && /\.(x|y)$/.test(a.path)
  const all = readAnswers(forge.paths.REPO_ROOT, code).answers.filter((a) => !a.path.startsWith('#'))
  const person = [...all.filter((a) => a.by === 'ai' && after(a)), ...all.filter((a) => a.by === 'person')]
  return step(
    WHOLE_STEP,
    () => {
      swapped.recipe = structuredClone(s.recipe)
      return applyAnswers(swapped.recipe, person, root)
    },
    (r) => ({
      name: WHOLE_STEP,
      state: s.asks.length ? 'warn' : 'ok',
      note: `AI 가 원본을 본보기로 만든 레시피를 씁니다. 바꾼 곳 ${s.notes.length}개, 확인할 것 ${s.asks.length}개입니다.${r.put ? ` 그 뒤에 고친 값 ${r.put}개를 적용했습니다.` : ''}`
    })
  ).then(() => ({ at: s.at, notes: s.notes, asks: s.asks, cost: s.cost, seconds: s.seconds }))
}

/** 지금 길이 다 못 끝냈나 — 이미 통째로 만든 것을 쓰는 판이면 다시 안 부른다 */
export function wantsWhole(out: RunResult): boolean {
  return !out.whole && !out.error && (!out.ok || out.asks.some((a) => !a.done))
}

const errorsOf = (g: ReturnType<Forge['api']['check']>): string[] =>
  'error' in g ? [String(g.error)] : g.issues.filter((i) => i.level === 'error').map((i) => `${i.rule} ${i.path} — ${i.message}`)

/** 「양산」(`auto.ts`)이 부르는 입구 — forge 를 불러 오고 걸음을 그 판의 걸음 줄로 보낸다 */
export async function wholeRound(code: string, out: RunResult, emit: Emit): Promise<{ saved: boolean; note: string }> {
  try {
    return await askWhole(await loadForge(), code, out, stepper([], emit))
  } catch (error) {
    return { saved: false, note: toMessage(error) }
  }
}

/** 부른다. 남겼으면 true — 부르는 쪽이 `runDry` 를 다시 돌린다 */
export async function askWhole(forge: Forge, code: string, out: RunResult, step: Step): Promise<{ saved: boolean; note: string }> {
  // 지금 길이 낸 레시피와 **실제로 뜬 원본** — 배치표 원본이 아니다. 그림 크기로 바꿔 뜬 원본(`originfit.ts`)일 수 있다
  // (2026-10-02 첫 판이 배치표의 6호를 적어 지문이 안 맞아 한 번도 안 쓰였다). assemble 이 이 파일을 부르므로 늦게 불러 온다
  const { assemble } = await import('./assemble')
  const made = await assemble(code, forge, stepper([], () => {}))
  const pick = made.pick
  const start = made.swapped.recipe
  const dir = forge.files.rscDir(code)
  const study = forge.spec.parseStudyCode(pick.origin)
  if (!dir || !study) return { saved: false, note: '리소스 폴더나 원본을 찾지 못했습니다.' }
  const actOf = (c: string): string =>
    path.join(forge.paths.workPath('sparkon_m' + String(forge.spec.parseStudyCode(c)?.month ?? 0).padStart(2, '0')), 'src', 'activity', c)
  const originAct = actOf(pick.origin)
  // **같은 모듈의 다른 완성본도 연다** (2026-10-02) — 원본 하나에는 안 나오는 경우가 있다. 4호(아빠 · 엄마 …)에는 같은 글자가 두 번 나오지 않아
  // AI 가 「겹치는 글자는 소리 한 번」으로 짐작했는데, 6호(자동차 · 기차)는 같은 글자도 소리를 따로 썼다
  const others = [...new Set([forge.layout.originFor(code).origin, ...(pick.alt ?? [])])]
    .filter((c) => c && c !== pick.origin)
    .slice(0, 4)
    .map(actOf)
    .filter((d) => fs.existsSync(d))
  const originRsc = forge.common.rscOfDone(pick.origin)
  const moduleDir = forge.survey.moduleDir(code.slice(0, 2), pick.module)
  const spec = forge.api.spec(code.slice(0, 2), pick.module)
  const baseErrors = out.issues.filter((i) => i.level === 'error').length
  const person: Answer[] = readAnswers(forge.paths.REPO_ROOT, code).answers.filter((a) => a.by === 'person' && !a.path.startsWith('#'))

  let recipe: unknown = start
  let errors: string[] = []
  let cost = 0
  const at = Date.now()
  for (let t = 1; t <= TRIES; t += 1) {
    const brief = wholeBrief({
      code, module: pick.module, origin: pick.origin, originAct, originRsc, moduleDir, others,
      shots: shotsOf(dir), plans: plansOf(dir), recipe, person, errors,
      table: rscTable(forge, dir, originRsc, recipe).text,
      spec: specForBrief('ok' in spec && spec.ok === false ? null : (spec as unknown as Record<string, unknown>))
    })
    const reply = await step(
      WHOLE_STEP,
      () => askAi(brief, dir, { dirs: [originAct, originRsc, moduleDir, ...others], timeout: WHOLE_TIMEOUT }),
      (r) => ({ name: WHOLE_STEP, state: r.ok ? 'ok' : 'warn', note: r.ok ? `${t}번째 답을 받았습니다. 검사합니다.` : r.error }),
      (s) => `AI 가 원본 ${pick.origin} 을 본보기로 이 학습코드 전체를 만드는 중입니다${t > 1 ? `(검사 에러를 고쳐 ${t}번째)` : ''}. ${s}초 경과`
    )
    cost += reply.cost ?? 0
    if (!reply.ok) return { saved: false, note: reply.error }
    const got = readWhole(reply.text, code, pick.module)
    if (!got.recipe) return { saved: false, note: got.error }
    errors = errorsOf(forge.api.check(got.recipe as never))
    recipe = got.recipe
    if (errors.length === 0 || t === TRIES) {
      if (errors.length > baseErrors) return { saved: false, note: `AI 가 만든 레시피에 에러가 ${errors.length}개 남아 지금 결과(${baseErrors}개)를 그대로 둡니다.` }
      const stored: Stored = {
        at: new Date().toISOString(), key: keyOf(forge, code, pick.origin, pick.module), origin: pick.origin, module: pick.module,
        recipe: got.recipe, notes: got.notes, asks: got.asks, cost, seconds: Math.round((Date.now() - at) / 1000)
      }
      fs.writeFileSync(fileOf(forge.paths.REPO_ROOT, code), JSON.stringify(stored, null, 1) + '\n')
      return { saved: true, note: `에러 ${errors.length}개, 확인할 것 ${got.asks.length}개입니다.` }
    }
  }
  return { saved: false, note: '' }
}
