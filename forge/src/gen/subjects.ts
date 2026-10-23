// 과목 표 — 학습코드 앞 두 글자와 공용 모듈 폴더(`sparkon_common/_common/module/<폴더>`) 이름.
//
// **왜 한 표인가 (2026-10-21).** 과목 목록이 forge 안 열한 파일에 따로 적혀 있었습니다 — `(MA|KO|EN)` 정규식,
// `["MA", "KO", "EN"]` 배열, KO → KR 폴더 표. 누리(NU)를 더하려니 그 자리를 다 찾아야 했고,
// 한 곳만 빠져도 오류 없이 누리만 빈 결과로 나옵니다. deploy 도 같은 일을 `util/studyCode.ts` 한 곳으로 모았습니다.
// **과목을 더할 때는 이 표에 한 줄만 더합니다.**
//
// **예외가 하나 있습니다 — `util/activityModules.ts` 는 이 표를 안 읽고 폴더 → 과목 표를 따로 듭니다.**
// 그 파일은 deploy 로 그대로 복사해 가는 정본이라 다른 파일을 import 하면 안 됩니다.
// 과목을 더하면 그쪽 `DIR_SUBJECT` 와 `ACTIVITY_MODULE` 도 같이 고칩니다(`yarn check:spec` 의 ③ 파서가 봅니다).
//
// **import 가 없습니다.** `paths.ts` 처럼 읽는 순간 뿌리를 정하는 일이 없어 어디서 불러도 됩니다.
// 앱은 여태처럼 `runtime.ts` 를 거쳐 `forge.spec` 에서 꺼내 씁니다(`spec.ts` 가 다시 내보냅니다).
//
// 차례는 앱 진행판 차례(영어, 수학, 국어)에 누리를 붙였습니다. 차례가 화면에 드러나는 자리는 거기서 따로 정합니다.

export const SUBJECTS = [
  { code: "EN", dir: "EN", name: "영어" },
  { code: "MA", dir: "MA", name: "수학" },
  // 국어만 학습코드(KO)와 폴더(KR)가 어긋납니다.
  { code: "KO", dir: "KR", name: "국어" },
  { code: "NU", dir: "NU", name: "누리" },
] as const;

export type Subject = (typeof SUBJECTS)[number]["code"];

export const SUBJECT_CODES: readonly Subject[] = SUBJECTS.map((s) => s.code);

export function isSubject(s: string): s is Subject {
  return (SUBJECT_CODES as readonly string[]).includes(s);
}

// 학습코드 글자 → 공용 모듈 폴더 이름. 표에 없으면 글자 그대로 둡니다 — 여태 그렇게 찾았습니다.
export function dirOf(code: string): string {
  return SUBJECTS.find((s) => s.code === code)?.dir ?? code;
}

const ALT = SUBJECT_CODES.join("|");

// 과목 글자 하나. 명령줄 · 배치표 쓰기가 받은 글자를 거릅니다.
export const SUBJECT_RE = new RegExp(`^(${ALT})$`);

// 학습코드 두 가지. **괄호로 잡는 것은 같습니다** — 1 과목 · 2 레벨 · 3 호(M) · 4 주 · 5 차시.
//
// `STUDY_RE` 는 사람이 적은 학습코드를 읽을 때(`parseStudyCode`) — 레벨 1~3, 주 1~4, 차시 1~3 만 받습니다.
// `STUDY_ANY_RE` 는 호 저장소 폴더 이름과 배치표에 적힌 원본을 가를 때 — 숫자는 한 자리면 다 받습니다.
// 둘을 하나로 합치지 않았습니다. 좁히면 이상한 이름의 폴더가 진행판에서 말없이 빠지고, 넓히면 사람이 잘못 적은 코드를 받아 줍니다.
export const STUDY_RE = new RegExp(`^(${ALT})L([1-3])M(\\d{2})W([1-4])S([1-3])$`);
export const STUDY_ANY_RE = new RegExp(`^(${ALT})L(\\d)M(\\d\\d)W(\\d)S(\\d)$`);
