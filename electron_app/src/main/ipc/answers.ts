/**
 * **렌더러가 보낸 학습코드를 거르는 자리** — 신뢰 경계.
 *
 * `normalizeCode` 는 2026-09-30 에 `services/forge/prepare.ts` 에서 옮겼다(200줄이 넘어서, 동작 변화 없음) —
 * 부르는 곳이 다 `ipc/` 이고, 하는 일이 입구 검사다.
 *
 * 레시피 답을 거르던 `cleanAnswers` 와 그 경로 규칙(`PATH` · `RESERVED`)은 2026-10-08 에 걷었다 —
 * 그것을 부르던 이전 방식의 답 채널과 비교 캔버스가 앱에 없다. 되살리려면 fb5c0d4 를 본다.
 */

/**
 * 학습코드 꼴 — `ENL1M06W3S1`.
 *
 * **입구에서 한 번만 본다.** 렌더러가 보낸 글자를 그대로 forge 에 넘기면
 * 배치표·파일 목록·권한이 저마다 다른 말로 실패한다. 여기서 거르면
 * 「학습코드가 아닙니다」 한 마디로 끝난다.
 */
const CODE = /^[A-Z]{2}L\dM\d\dW\dS\d$/

export function normalizeCode(raw: string): string | null {
  const code = String(raw ?? '')
    .trim()
    .toUpperCase()
  return CODE.test(code) ? code : null
}
