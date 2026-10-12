// 표본을 견줘서 스펙 초안을 씁니다. `yarn forge draft MA/M29`
//
// 이것은 **초안**입니다. 그대로 쓰라고 만든 것이 아닙니다.
// 기계가 할 수 있는 것과 없는 것을 갈라 놓았습니다.
//
//   기계가 함    자리 목록 · 필수/선택 · 타입 · 배열 최소 칸 수 ·
//                고정값 · 리소스 별칭인지 · 표본 목록 · codegen 뼈대
//   나중에 채움  title · summary · 자리마다의 desc · rules · 왜 그런지
//
// 전에는 못 아는 자리에 "TODO" 를 박아 두었습니다. 그런데 M05 는 자리가
// 836개라 채울 곳이 841군데였습니다 — 사람이 할 일이 아닙니다. 그래서
// **안 아는 것은 아예 적지 않습니다.** 빈 칸으로 두고 나중에 채웁니다 (2026-09-01).
//
// **본문은 조각으로 나눴습니다** (2026-09-30, 995줄이라 — 동작 변화 없음). 바깥(api · 명령 · 도구)은 여태처럼 이 파일에서 가져다 씁니다.
//
//   draftspec    초안 입구 — 표본을 모아 자리 목록을 짓는다 (`draftSpec`)
//   draftshape   배열 한 겹의 모양 · 고정값
//   drafttype    타입 알아내기 · 값 꼴 가름
//   draftcodegen codegen 뼈대 — 표본 Activity.ts 에서 베껴 온다
//   draftsymbols 훅 줄에서 직접 부르는 이름 · 클래스 멤버
//   draftrun     모듈 하나를 내놓기 (`forge draft MA/M29`)
//   draftall     스펙이 없는 모듈을 전부 (`forge draft --all`)
//   draftmerge   사람이 쓴 글을 새 초안에 도로 얹기

export { type Draft, draftSpec } from "./draftspec";
export { classMembers, symbolsInMembers } from "./draftsymbols";
export { runDraft } from "./draftrun";
export { runDraftAll } from "./draftall";
export { mergeHuman } from "./draftmerge";
