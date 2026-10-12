// 모듈 스펙 · 레시피의 타입 정의.
//
// 스펙(spec/{과목}/{모듈}.json)   모듈 하나가 요구하는 값의 목록. 사람이 씁니다.
// 레시피(recipe.json)            액티비티 하나에 넣을 실제 값. 사이트나 손으로 씁니다.
// 생성기                          스펙 + 레시피 → 액티비티 폴더 8개 파일.

export type AssetKind = "image" | "sound" | "lottie" | "font";

export type Point = { x: number; y: number };

// 레시피가 좌표를 적는 두 가지 방법.
//   {x,y}                    이미 계산된 값 (캔버스 중앙 기준)
//   {fx,fy,w,h,anchor?}      figma 값 (좌상단 기준) — 생성기가 변환합니다
export type FigmaPoint = {
  fx: number;
  fy: number;
  w: number;
  h: number;
  anchorX?: number;
  anchorY?: number;
};

export type PointInput = Point | FigmaPoint;

// ─── 레시피 ──────────────────────────────────────────────────────────────

export type AssetBase = "root" | "images" | "sounds" | "animations" | "font";

export type RecipeAsset = {
  alias: string;
  file: string;
  // 파일이 놓이는 곳. 안 적으면 kind 에 맞는 곳(images/sounds/animations)입니다.
  // 애니메이션의 video.mp4 처럼 액티비티 폴더 바로 아래인 것만 "root" 로 적습니다.
  base?: AssetBase;
};

export type Recipe = {
  recipeVersion: number;
  code: string; // 학습코드. ex) MAL1M07W3S2
  module: string; // ex) M27
  subject?: string; // 없으면 학습코드에서 뽑습니다
  info?: {
    devTeam?: string;
    developer?: string;
    description?: string;
    devFinished?: boolean;
    finishedDate?: string;
  };
  // 스펙에 defaults 가 있으면 생략할 수 있습니다.
  assets?: Partial<Record<AssetKind, RecipeAsset[]>>;
  // 스펙의 `gameData.kind` 가 `array` 면 여기도 배열입니다 — 뿌리가
  // `export const quizData = [ … ]` 인 모듈은 감싸는 객체가 없습니다.
  gameData?: Record<string, unknown> | unknown[];
};

// ─── 결과 ────────────────────────────────────────────────────────────────

export type Issue = {
  level: "error" | "warn";
  rule: string;
  path: string;
  message: string;
  why?: string;
};

export type GenResult = {
  ok: boolean;
  issues: Issue[];
  files: { path: string; bytes: number }[];
  dirs: string[];
  // `--dry` 일 때만 채워집니다 — 파일 이름 → 쓰려던 글자.
  // 화면의 미리보기와 재현 검사(`check:repro`)가 이것을 봅니다.
  preview?: Record<string, string>;
  // **에러가 있어 안 쓸 글.** `--dry` 일 때만 채워집니다.
  //
  // 안 될 때야말로 만들려던 GameData 를 봐야 합니다 — 「무엇이 모자란지 알려
  // 주고 그 자리에서 GameData 와 리소스를 볼 수 있게」가 양산 화면의 요구
  // 사항입니다 (`_document/양산계획.md` 3-2). 렌더는 검증과 상관없이 이미
  // 끝나 있으므로 버리지 않고 담아 둡니다.
  //
  // **`preview` 와 한 칸으로 합치면 안 됩니다.** 재현 검사(`check:repro`)가
  // `preview` 가 비었는지로 「에러가 있어 렌더까지 못 갔다」를 가립니다.
  // 합치면 그것을 「견줄 것」으로 착각합니다.
  draft?: Record<string, string>;
};

//
// **스펙 쪽은 조각으로 나눴습니다** (2026-09-30, 469줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   typesfield     스펙의 자리 — 훅 한 벌 · 필드 · 배리언트 · 규칙
//   typesrelation  스펙의 값 관계 (`relations`)
//   typesspec      스펙 한 장 — 들여올 것 · 파일 표 · 번호 짝 · `Spec`

export * from "./typesfield";
export * from "./typesrelation";
export * from "./typesspec";
