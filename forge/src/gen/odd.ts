// 「혼자만 다른 것」 — 같은 모듈을 쓰는 액티비티를 전 호에서 모아 견주고,
// **하나만 다른 값**과 **하나만 빠진 줄**을 짚습니다.
//
// **왜 이것이 필요한가.** 8호에서 실제로 터진 결함 둘은 타입 검사로도,
// `check:repro` 로도, 화면을 봐도 안 잡혔습니다.
//
//   ① `popup` 인덱스가 이닝마다 0,1,2 여야 하는데 전부 0     ← 값의 관계. 여기서는 못 잡습니다
//   ② `await SparkApp.eop.show();` 가 빠져 엔딩이 안 뜸      ← **이 검사가 잡는 것**
//
// ②는 「같은 모듈을 쓰는 여섯 개 중 다섯에 있는 줄이 이것만 없다」입니다.
// 액티비티 하나만 봐서는 알 수 없고, **형제를 모아 놓아야** 드러납니다.
// 호 repo 열한 개에 액티비티가 1,200개 있으니 형제는 늘 있습니다.
//
// **짚은 것이 곧 결함은 아닙니다.** 일부러 다르게 만든 자리도 걸립니다.
// 그래서 이 검사는 막지 않고 **알립니다** — 사람이 볼 자리를 좁혀 주는 자입니다.
// 막는 것은 스펙에 적은 관계(1-2)가 할 일입니다.
//
// 자리를 고르는 일은 `surveycompare.ts` 의 `compare()` 가 이미 합니다. 여기서 새로
// 세지 않고 그 결과에서 **수상한 자리만 골라내** 표본 이름을 붙입니다 —
// `compare()` 는 자리의 성격만 알려 주고 「어느 표본이 그랬나」는 말하지 않습니다.
//
// **처음 돌렸을 때 523군데가 나왔고 거의 다 헛말이었습니다** (2026-09-14).
// 무엇이 헛말이었나가 아래 세 군데의 까닭입니다 — 들여쓰기 차이, 블록 주석 안의
// 글, 그리고 까닭 하나에 줄 스무 개.

import { findUsers, listModules } from "./survey";
import { oddLines } from "./oddlines";
import { oddValues } from "./oddvalues";

// 표본이 적으면 「혼자만 다르다」가 말이 안 됩니다. 셋 중 하나가 다른 것은
// 「둘이 같다」에 가깝습니다. 넷부터 봅니다.
export const MIN_SAMPLES = 4;

export type Odd = {
  where: "Activity.ts" | "GameData.ts";
  kind: "빠짐" | "다름";
  code: string; // 혼자 다른 액티비티
  what: string; // 빠진 줄, 또는 값이 다른 자리
  mine?: string; // 「다름」일 때 이 액티비티의 값
  others?: string; // 「다름」일 때 나머지가 함께 가진 값
  otherCodes: string[]; // 나머지 액티비티
};

export type ModuleOdd = {
  subject: string;
  module: string;
  samples: string[]; // 견준 액티비티
  odds: Odd[];
  note?: string; // 못 견줬으면 그 까닭
};

// 모듈 하나. 2단계의 리소스 화면이 「양산 시작」 뒤에 부를 자리도 이것입니다.
export function findOdd(subject: string, module: string, min = MIN_SAMPLES): ModuleOdd {
  const users = findUsers(subject, module);
  const base: ModuleOdd = { subject, module, samples: users.map((u) => u.code), odds: [] };
  if (users.length < min) {
    return { ...base, note: `표본이 ${users.length}개뿐입니다 — ${min}개부터 견줍니다` };
  }
  return { ...base, odds: [...oddLines(users, min), ...oddValues(users, min)] };
}

// 전 호 전체. 이미 만들어진 것에서 같은 종류의 누락을 찾습니다.
export function findOddAll(min = MIN_SAMPLES): ModuleOdd[] {
  return listModules()
    .filter((row) => row.count >= min)
    .map((row) => findOdd(row.subject, row.module, min));
}


//
// **본문은 보는 파일마다 나눴습니다** (2026-09-30, 350줄이라 — 동작 변화 없음). 여기는 입구와 타입만.
//
//   oddlines       Activity.ts — 하나만 빠진 줄
//   oddvalues      GameData.ts — 하나만 다른 값 · 하나만 빠진 자리

