/**
 * 양산기(forge)와 주고받는 데이터 모양 — IPC 계약.
 *
 * **forge 의 타입을 import 하지 않고 여기에 적는다.** forge 의 `layout.ts` 는
 * `fs`·`child_process` 를 쓰는 node 전용 코드라, 렌더러 프로그램이 그것을 보게 되면
 * 안 되는 자리를 보게 된다.
 *
 * 그래서 모양이 두 곳에 있지만 **갈라지면 컴파일에서 걸린다** —
 * `services/forge/board.ts` 가 forge 의 결과를 이 타입에 그대로 대입하기 때문이다.
 * 칸 이름이 바뀌거나 없어지면 그 대입이 먼저 깨진다.
 */
// **조각은 화면 단위로 나눴다** (2026-09-18, 895줄이라). 부르는 쪽은 여태처럼
// 이 파일만 import 한다 — 59곳을 안 고치려고 여기서 다시 내보낸다.
export * from './forge/board'
export * from './forge/workspace'
export * from './forge/prepare'
export * from './forge/run'
export * from './forge/inbox'
export * from './forge/ask'
export * from './forge/answer'
export * from './forge/tally'
export * from './forge/ai'
export * from './forge/finish'
export * from './forge/status'
export * from './forge/manage'
export * from './forge/guide'
export * from './forge/voice'
export * from './forge/origin'
export * from './forge/setup'
export * from './forge/chat'
