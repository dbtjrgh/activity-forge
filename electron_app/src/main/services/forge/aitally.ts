/**
 * **실제로 부른 것의 합 · 부르기 전 상한** — `ai.ts` 에서 합 셈을 옮기고(동작 변화 없음) 상한을 더했다 (2026-09-29, M5).
 *
 * 합: 한 판의 몫은 **앞뒤를 빼서** 얻는다(`spentSince`). 양산은 한 번에 학습코드 하나씩 돌므로 그 사이의 부름이
 * 곧 그 판 것이다 — 둘을 겹쳐 돌리면 섞인다(차례 줄은 동시 1 이다, `queue.ts`).
 *
 * 상한: 차례 줄이 판마다 건다(`setCap`). **부르기 직전에 본다** — 판이 끝난 뒤에 재면 이미 넘은 뒤다.
 * 한 판 안에서 동시에 나간 묶음(`matchcalls.ts`)은 한 번에 나가므로 그 한 묶음만큼은 넘을 수 있다.
 * 한도 오류(계정 사용량)는 따로 들고 있다가 차례 줄이 보고 멈춘다 — 다음 판도 똑같이 막힌다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { AiSpent } from '../../../shared/forge'

/** 부른 결과 가운데 셈에 쓰는 것 — `ai.ts` 의 `AiReply` 와 같은 모양 */
type Counted = {
  took: number
  error: string
  usage?: { input: number; cacheWrite: number; cacheRead: number; output: number }
  cost?: number
}

const spent: AiSpent = { calls: 0, unknown: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, cost: 0, ms: 0 }

/** 지금까지의 합을 떠 둔다 */
export function aiTally(): AiSpent {
  return { ...spent }
}

export function spentSince(from: AiSpent): AiSpent {
  const now = aiTally()
  const out = { ...now }
  for (const k of Object.keys(out) as (keyof AiSpent)[]) out[k] = now[k] - from[k]
  return out
}

/**
 * 한도 오류만 본다 — 합에는 안 넣는다. 대화로 만들기(`aisession.ts`)가 쓴다: 대화 값은 대화가 따로 들고(`chat.json` 의 cost),
 * 합에 넣으면 차례 줄이 그때 돌리던 **남의 학습코드** 상한을 써 버린다. 계정 한도는 같이 쓰므로 그것만 알린다
 */
export function noteLimit(error: string): void {
  if (error && LIMIT.test(error)) limitHit = error
}

export function count(reply: Counted): void {
  spent.calls += 1
  spent.ms += reply.took
  noteLimit(reply.error)
  if (!reply.usage) {
    spent.unknown += 1
    return
  }
  spent.input += reply.usage.input
  spent.cacheWrite += reply.usage.cacheWrite
  spent.cacheRead += reply.usage.cacheRead
  spent.output += reply.usage.output
  spent.cost += reply.cost ?? 0
}

/** 계정 한도 · 사용량 초과를 알아보는 말 — claude 가 내는 영어 글 */
const LIMIT = /usage limit|rate limit|limit reached|credit balance|quota|too many requests|429/i

let cap: { from: number; max: number } | null = null
let limitHit = ''

/** 이제부터 부르는 값이 `max` 달러를 넘으면 안 부른다. null 이면 푼다 */
export function setCap(max: number | null): void {
  cap = max === null ? null : { from: spent.cost, max }
  limitHit = ''
}

/** 지금 부르면 안 되는 까닭. 괜찮으면 null */
export function capSays(): string | null {
  if (!cap) return null
  const used = spent.cost - cap.from
  return used >= cap.max ? `이 학습코드에 $${used.toFixed(2)}를 사용해 상한 $${cap.max.toFixed(2)}에 도달했습니다. AI 를 더 호출하지 않습니다.` : null
}

/** 한도 오류가 났으면 그 글 — 차례 줄이 멈출지 본다 */
export function aiLimitHit(): string {
  return limitHit
}
