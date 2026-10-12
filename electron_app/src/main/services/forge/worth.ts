/**
 * **AI 를 부를 값어치가 있나** — 「양산」 한 단추(`auto.ts`)가 바퀴마다 묻는 것.
 *
 * `auto.ts` 가 250줄이 되어 흐름과 판단을 갈랐다 (2026-09-18, 동작 변화 없음).
 * 흐름은 `auto.ts` 에 있고, 여기는 **부를지 말지와 나아갔는지를 재는 셈**만 있다.
 *
 * **가르는 자리가 둘이다** (2026-09-21). 「화면이 있나」는 `shotfirst.ts` 가
 * 보고 그쪽이 **먼저** 묻는다. 여기는 그 뒤에 「남은 카드가 AI 가 풀 갈래인가」
 * 만 본다 — 전에는 화면도 여기서 봤는데, 두 곳에 두면 한쪽만 고쳐진다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Ask, RunResult } from '../../../shared/forge'

/**
 * AI 가 답할 수 있는 카드 갈래.
 *
 * **값·좌표·모듈은 여기 없다 — 세어 보고 안 넣었다** (5단계, 2026-09-16).
 * 8호 79차시의 「값」 카드 73장은 AI 가 채울 물음이 아니었다: 42장은 배열
 * 칸을 늘리고 줄이는 자리라 앱이 값을 받지도 못하고, 나머지는 **원본에만
 * 있는 걸음**의 별칭이거나 막는 검사가 잘못 건 것이었다. 「좌표」 카드는
 * 한 장도 없었고, 「모듈」은 세 차시인데 틀리면 액티비티가 통째로 틀린다.
 * 잰 것은 `_document/자동양산.md` 5단계와 `forge/src/tool/values.ts` 에 있다.
 */
export const BY_AI = new Set<Ask['want']>(['리소스파일', '고르기'])

/**
 * 아직 막혀 있는 양 — **자리 수와 에러 수로** 센다. 카드 수는 묶이는 것이라
 * 나아간 것을 못 본다 (한 장이 열두 자리를 대신하기도 한다).
 */
export function left(out: RunResult): { slots: number; errors: number } {
  let slots = 0
  for (const a of out.asks) if (!a.done) slots += Math.max(a.items.length, a.count, 1)
  return { slots, errors: out.issues.filter((i) => i.level === 'error').length }
}

/**
 * AI 를 불러도 소용없는 경우를 **부르기 전에** 가린다. 부를 값어치가 있으면 빈 글.
 *
 * **모르면 부르는 쪽으로 기울이지 않는다.** 한 번이 14,830토큰이고 답 없는
 * 물음에 부른 적이 실제로 있다 (2026-09-15, 답할 수 없는 질문이 분모의 61%).
 */
export function notWorthCalling(open: Ask[], out: RunResult): string {
  if (out.error) return '' // 넘어진 까닭은 아래 걸음에 있다 — 여기서 덧붙이지 않는다
  if (open.some((a) => BY_AI.has(a.want))) return ''
  if (!open.some((a) => a.want === '자리세우기')) {
    return `남은 ${open.length}개는 사람이 정해야 합니다. 아래 카드를 확인하세요.`
  }
  // **「화면이 있나」는 여기서 안 본다** (2026-09-21). 전에는 자리 세우기일
  // 때만 화면을 봤는데, 이제 **어느 갈래든 화면이 없으면 아예 안 부른다** —
  // 그 판단은 `shotfirst.ts` 하나에 있고 `auto.ts` 가 이보다 먼저 묻는다.
  // 두 곳에 두면 한쪽만 고쳐져서 「화면을 넣었는데도 안 돈다」가 된다.
  return ''
}
