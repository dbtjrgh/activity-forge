/**
 * **과목 표의 앱 거울** (2026-10-21, 누리 추가) — forge `src/gen/subjects.ts` 와 같은 글자 · 이름 · 차례.
 *
 * 렌더러는 forge 를 못 부른다(node 전용 — `../forge.ts` 머리말). 그래서 화면이 쓰는 과목 이름과 차례를 여기 한 번 더 적는다.
 * **두 벌이 갈라지면 컴파일에서 걸린다** — `main/services/forge/board.ts` 의 `SubjectsTie` 가 글자 · 이름 · 차례를 견준다.
 * 진행판 옆줄 · 「호 열기」 · 회귀 검사 · 재현 검사가 과목 목록을 따로 들고 있다가 누리를 더할 때 다 찾아야 했다 — 앱 쪽은 이 표 하나다.
 *
 * 공용 모듈 폴더 이름(국어 KO → KR)은 여기 적지 않는다 — 메인이 forge `survey.moduleDir` 하나로 셈한다.
 */
export const SUBJECTS = [
  { code: 'EN', name: '영어' },
  { code: 'MA', name: '수학' },
  { code: 'KO', name: '국어' },
  { code: 'NU', name: '누리' }
] as const

export type Subject = (typeof SUBJECTS)[number]['code']

export const SUBJECT_CODES: readonly Subject[] = SUBJECTS.map((s) => s.code)

export function isSubject(s: string): s is Subject {
  return (SUBJECT_CODES as readonly string[]).includes(s)
}

/** 화면에 부를 이름 — 표에 없는 글자는 그대로 보인다(짐작해서 이름을 붙이지 않는다) */
export const subjectName = (code: string): string => SUBJECTS.find((s) => s.code === code)?.name ?? code

/** 화면 차례 — 표에 없는 글자는 맨 뒤 */
export function subjectRank(code: string): number {
  const i = (SUBJECT_CODES as readonly string[]).indexOf(code)
  return i < 0 ? SUBJECT_CODES.length : i
}
