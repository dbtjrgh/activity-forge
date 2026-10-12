/**
 * 맞추기(`match.ts`)와 **같이 도는 곁걸음 둘** — 이름·차례(`order.ts`) · 짜임(`shape.ts`).
 *
 * `match.ts` 가 229줄이 되어 흐름과 곁걸음을 갈랐다 (2026-09-18, 동작 변화 없음).
 * 둘 다 **넘어져도 맞추기는 계속한다** — 곁가지에서 막혀 정작 하려던 일까지
 * 못 하게 두지 않는다.
 *
 * **짜임은 더 이상 곁걸음이 아니다** (2026-09-21). `match.ts` 가 이것을
 * **먼저 기다린다** — 칸이 벌어져야 맞추기가 걸 자리가 생기기 때문이다.
 * 파일은 그대로 두었다(둘 다 「맞추기가 부르는 걸음」이라는 점은 같다).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer, MatchResult, ShapeFinding } from '../../../shared/forge'
import { cellsPath } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { saveAnswers } from './answer'
import { emptyOrder, nameAndOrder } from './order'
import type { loadForge } from './runtime'
import type { wordAliases } from './slotask'
import { fieldAt } from './field'
import { askShape, sizableAt } from './shape'
import { saveFindings } from './shapestore'
import type { Spec } from '@/gen/types'
import { AI_SECONDS } from './ai'
import { plansOf, shotsOf } from './shot'
import type { stepper } from './step'

/**
 * 이름과 차례를 묻고 **자리 답으로 남긴다.**
 *
 * 사람이 카드에서 고른 것과 **같은 파일에 같은 꼴**로 남으므로, 마음에 안
 * 들면 카드에서 그대로 덮어쓸 수 있다.
 *
 * **넘어져도 맞추기는 계속한다.** 여기서 막히면 정작 하려던 일까지 못 한다.
 */
export async function orderStep(
  forge: Awaited<ReturnType<typeof loadForge>>,
  code: string,
  judged: Parameters<typeof wordAliases>[0],
  swapped: { recipe: { gameData?: unknown }; spare: string[] },
  step: ReturnType<typeof stepper>,
  out: MatchResult
): Promise<void> {
  if (!judged.some((j) => j.verdict === '낱말')) return
  try {
    const got = await step(
      '이름과 차례',
      () => nameAndOrder(forge, code, judged, swapped.recipe.gameData, swapped.spare),
      (r) => ({
        name: '이름과 차례',
        state: r.result.error || r.result.orderNote ? 'warn' : r.result.taken.length ? 'ok' : 'warn',
        note: r.result.note
      }),
      // 갈래마다 한 번씩 부르므로 여기가 제일 여러 번 돈다 — 몇 초째인지 적는다.
      (s) => `이름이 무작위인 파일에 이름과 순서를 정하는 중입니다. ${s}초 경과`
    )
    out.order = got.result
    // **답이 없으면 남기지 않는다.** 빈 답을 얹으면 앞서 사람이 고른 것을
    // 지우는 꼴이 될 수 있다 — `saveAnswers` 는 같은 자리를 덮는다.
    if (got.answers.length) saveAnswers(forge.paths.REPO_ROOT, code, got.answers, 'ai')
  } catch (error) {
    out.order = { ...emptyOrder(), error: toMessage(error) }
  }
}

/**
 * 짜임을 묻고, 짚은 것을 **남긴다.** 요구 카드로 바뀌는 것은 `runDry` 가 한다 —
 * 그래야 다음에 「양산 시작」만 눌러도 그 카드가 그대로 뜬다.
 *
 * **넘어져도 맞추기는 계속한다.** 이것은 곁가지라, 여기서 막히면 정작 하려던
 * 일까지 못 하게 된다.
 */
export async function askShapeStep(
  code: string,
  origin: string,
  swapped: { recipe: { gameData?: unknown } },
  forge: Awaited<ReturnType<typeof loadForge>>,
  step: ReturnType<typeof stepper>,
  out: MatchResult,
  /**
   * 그 모듈의 스펙. 짚은 자리가 「칸 수만 바꾸면 되는 자리」인지 보는 데 쓰고,
   * **스펙이 못 박아 둔 아래 한도를 어기는 답을 막는 데** 쓴다.
   */
  spec: Spec | null = null
): Promise<number> {
  const gameDataRoot = spec?.gameData?.root ?? ''
  try {
    const got = forge.api.files(code)
    const files = got.ok ? (got.files as { name: string; base: string }[]) : []
    // 붙여넣은 figma 화면이 있으면 그것을 보고 센다 — 이름·차례와 **같은 한 장**이다.
    const dir = forge.files.rscDir(code)
    // **붙인 화면을 전부 넘긴다** (2026-09-21). 칸 수야말로 한 장에 다 안
    // 보이는 것이라 — 사람이 나눠 붙인 까닭이 대개 이것이다.
    const shots = dir ? shotsOf(dir) : []
    const plans = dir ? plansOf(dir) : []
    const look = dir && (shots.length || plans.length) ? { dir, shots, plans } : undefined
    const ran = await step(
      '짜임 견주기',
      () => askShape(code, origin, swapped.recipe.gameData, files, forge.swap.familyOf, forge.paths.REPO_ROOT, look),
      (r) => ({
        name: '짜임 견주기',
        state: r.error ? 'warn' : r.taken.length ? 'warn' : 'ok',
        note: r.error || r.note
      }),
      (s) =>
        (shots.length ? `figma 화면 ${shots.length}장을 보고 ` : '폴더의 파일 개수로 ') +
        `항목 개수를 세는 중입니다. ${s}초 경과(최대 ${AI_SECONDS}초)`
    )
    out.shape = ran
    // **짚은 것이 없으면 앞서 남긴 것을 지운다** — 고친 뒤에도 옛 지적이
    // 남아 있으면 실제 쓰기가 영영 안 열린다.
    saveFindings(forge.paths.REPO_ROOT, code, ran.taken)

    // **칸 수만 바꾸면 되는 자리는 바로 얹는다** (2026-09-21).
    //
    // 전에는 짚어 놓고 **카드로만** 냈다 — 사람이 누르기 전에는 자리가 안
    // 벌어지고, 자리가 안 벌어지면 맞추기가 걸 데가 없다. `MAL2M07W2S1` 이
    // 그랬다: 폴더는 `view_0_0`…`view_4_2`(5×3)인데 베껴 온 자리는 3칸짜리라
    // **71자리 가운데 58자리가 갈 곳이 없었다.**
    //
    // 얹는 것은 **같은 꼴 칸일 때만**이다(`cells.ts` 의 `uniform`) — 칸마다
    // 꼴이 다르면 어느 것을 넣고 뺄지 모르므로 그대로 카드로 남긴다.
    // 사람이 넣은 답과 **같은 길**(`#cells`)로 남으므로 카드에서 덮어쓸 수 있고,
    // 무엇을 몇 칸으로 바꿨는지는 「칸 수 맞추기」 걸음에 그대로 보인다.
    const put = cellsAnswers(ran.taken, swapped.recipe, gameDataRoot, spec)
    if (put.length) saveAnswers(forge.paths.REPO_ROOT, code, put, 'ai')
    return put.length
  } catch (error) {
    out.shape = {
      ran: false,
      brief: '',
      shot: '',
      tokens: 0,
      took: 0,
      taken: [],
      refused: [],
      note: '',
      error: toMessage(error)
    }
  }
  return 0
}

/**
 * 짚은 것 가운데 **칸 수만 바꾸면 되는 자리**를 답으로.
 *
 * 「칸 수만 바꾸면 되나」를 보는 셈은 `shape.ts` 의 `sizableAt` 하나다 —
 * 카드를 만드는 쪽(`shapeAsks`)과 여기가 **같은 눈으로 봐야** 「카드는
 * 숫자를 받는데 저절로는 안 얹힌다」 같은 어긋남이 안 생긴다.
 */
function cellsAnswers(
  findings: ShapeFinding[],
  recipe: unknown,
  gameDataRoot: string,
  spec: Spec | null
): Answer[] {
  return findings
    .filter((f) => sizableAt(recipe, f.where, gameDataRoot))
    .filter((f) => withinSpec(spec, f.where, f.should))
    .map((f) => ({ path: cellsPath(f.where), value: f.should }))
}

/**
 * **스펙이 못 박아 둔 아래 한도를 어기면 안 얹는다** (2026-09-21).
 *
 * 사람이 누르지 않아도 얹히는 답이라(위 「바로 얹는다」) **틀리면 조용히
 * 에러가 된다.** 실제로 그랬다 — AI 가 화면을 보고 `quizData.M05_Answer.value`
 * 의 칸을 6→3 으로 줄이자고 했고, 그대로 얹혀 **「4개 이상이어야 하는데
 * 3개입니다」 에러가 열둘** 났다. 카드도 아홉에서 스물다섯으로 늘었다.
 *
 * 스펙은 사람이 적어 둔 것이고 AI 의 답은 짐작이다. **어긋나면 스펙이 맞다.**
 * 여기서 막힌 것은 얹히지 않고 짚은 것(`saveFindings`)으로만 남아, 사람이
 * 카드에서 보고 정한다.
 */
function withinSpec(spec: Spec | null, where: string, should: number): boolean {
  if (!spec) return true
  const field = fieldAt(spec, where)
  const min = field?.minLength
  return !(typeof min === 'number' && should < min)
}
