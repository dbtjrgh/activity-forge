/**
 * **AI 도 곤란하면 그때서야 사람에게 묻는다** — 맞추기 · 값 고치기가 「모르겠다」고 한 자리를 카드로
 * (2026-09-30 에 `auto.ts` 끝에서 옮김, 200줄이 넘어서. 동작 변화 없음).
 *
 * 카드 한 장의 꼴은 `revise.ts` 의 `unsureAsks` 다. 여기는 **무엇을 물을지**만 가린다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { MatchResult, ReviseResult, RunResult } from '../../../shared/forge'
import { listPaper } from './pasted'
import { unsureAsks } from './revise'
import type { ShotGate } from './shotfirst'

/**
 * 늘 figma 를 달라고 하지 않는 것이 요점이다 — 막힌 학습코드에만 사람 손과 토큰이 든다.
 * 전에는 브리프가 「확신이 없으면 그 줄을 쓰지 않는다」고만 해서 **AI 가
 * 모를 때 아무 말 없이 빠졌고**, 도구가 앞 회차에서 베껴 온 값이 그대로
 * 나갔다. 이제 그 침묵이 카드가 된다.
 * **본 화면을 같이 넘긴다.** 화면을 넣고 다시 돌린 판인지에 따라 카드가
 * 달라진다 — 이미 본 사람에게 「화면을 넣으세요」라고 하면 고리가 안 닫힌
 * 것처럼 보인다.
 * **그 뒤에 덜어낸 자리는 묻지 않는다** (2026-09-23). MAL2M07W2S1 에서 AI 가
 * 「6종뿐이라 7번째 동물이 없다」고 한 `character_6_*` 를 「안 쓰는 자리 덜어내기」가
 * 그 답을 증인 삼아 덜어냈는데, 카드에는 그대로 남아 9자리를 물었다.
 */
export function addUnsure(
  code: string,
  out: RunResult,
  revised: ReviseResult | null,
  match: MatchResult | undefined,
  gate: ShotGate
): void {
  const remain = new Set(out.swap?.aliases ?? [])
  const still = (u: { kind: string; alias: string }): boolean => !out.swap || remain.has(`${u.kind}|${u.alias}`)
  const unsure = (revised?.unsure ?? []).filter(still)
  // 기획서가 없으면 화면을 더 달라기 전에 기획서부터 — 사람에게 직접 묻는 것은 그다음이다(`askorder.ts`)
  const hasPlan = Boolean(gate.dir && listPaper(gate.dir, 'plan').length)
  if (revised && unsure.length) {
    out.asks = [...out.asks, ...unsureAsks(code, unsure, gate.spot, revised.shot, 'revise', hasPlan)]
  }
  // **맞추기가 못 고른 것도 같은 꼴로 묻는다** (2026-09-21). 전에는 브리프에
  // 「모르면 그 줄을 쓰지 마세요」라고만 해서 **못 고른 자리가 아무 데도 안
  // 남았다** — `MAL2M07W2S1` 에서 71자리 가운데 58자리가 그랬고, 사람이 볼
  // 수 있는 것은 에러 숫자뿐이라 무엇을 주면 풀리는지 알 길이 없었다.
  const stuck = (match?.unsure ?? []).filter(still)
  if (stuck.length) {
    out.asks = [...out.asks, ...unsureAsks(code, stuck, gate.spot, gate.shot, 'match', hasPlan)]
  }
}
