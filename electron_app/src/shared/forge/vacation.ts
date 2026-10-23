/**
 * 방학호와 앞선 호 학습코드의 짝 (2026-10-20) — 리소스 파일이 바이트까지 거의 다 같은 것.
 * 잰 것은 forge `tool/vacation.ts` 이고 결과는 `_layout/vacation.json` 이다. 앱은 읽기만 한다(`services/forge/vacation.ts`).
 * 짝은 칸이 같지 않다(ENL1M11W1S1 ← ENL1M01W1S2) — 그래서 학습코드를 줄이지 않고 다 보인다.
 */
export interface VacationLink {
  /** 짝 학습코드 — `side` 가 `copied` 면 방학호 것, `from` 이면 앞선 호 것 */
  code: string
  /** `copied` — 이 학습코드가 방학호에 그대로 쓰였다. `from` — 이 방학호 학습코드가 앞선 호 것을 그대로 가져왔다 */
  side: 'copied' | 'from'
  /** 방학호 학습코드의 견준 파일(64바이트 이상) 가운데 바이트까지 같은 수와 견준 수 */
  same: number
  total: number
}
