// 모듈 하나를 쓰는 기존 액티비티를 찾아서 그 `GameData.ts` 를 읽어 옵니다.
//
// 스펙(spec/{과목}/{모듈}.json)을 손으로 쓸 때 제일 오래 걸리는 일이
// 「이 모듈을 쓰는 액티비티가 어디 있더라」와 「걔들 데이터가 어떻게 생겼더라」
// 였습니다. 그걸 기계가 대신 합니다. 스펙을 써 주지는 않습니다 — 재료만 모읍니다.
//
// 모듈 113개 중 스펙이 있는 것은 3개뿐이라(2026-09-01), 하나씩 손으로 쓰는 한
// 이 도구는 계속 2%만 덮습니다. 그래서 스펙 만드는 값을 먼저 낮춥니다.

export type Sample = {
  code: string; // 학습코드
  month: number;
  dir: string; // 액티비티 폴더
  root: string | null; // GameData 가 내보내는 이름. ex) quizData
  data: unknown; // 읽어 낸 값
  note?: string; // 못 읽었으면 그 까닭
};

//
// **본문은 조각으로 나눴습니다** (2026-09-30, 493줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   surveyfind     찾기 — 모듈을 쓰는 액티비티 · 모듈 목록 · 폴더 훑기
//   surveyread     GameData 읽기 — `export const` 를 값으로
//   surveycompare  견주기 — 표본끼리 자리마다 값 · 타입
//   surveyprint    명령줄 뿌리기 (`forge survey`)

// 파서와 같은 것을 씁니다. 부르는 쪽이 두 군데를 import 하지 않게 다시 내보냅니다.
export type { ModuleRef } from "@/util/activityModules";
export { modulesOf, surveyAll, findUsers, keyOf, type ModuleRow, listModules, moduleDir } from "./surveyfind";
export { readGameData, readExports, assetAliases } from "./surveyread";
export { type FieldStat, compare, type Leaf, leavesOf } from "./surveycompare";
export { printSurvey, printModule, printDiff } from "./surveyprint";
