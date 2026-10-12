// 스펙 한 장 — 들여올 것 · 파일 표 · 번호 짝 · `Spec`.
//
// `types.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `types.ts` 에서 가져다 씁니다.

import type { AssetKind, Point, RecipeAsset } from "./types";
import { type HookKey, type SpecField, type SpecRule } from "./typesfield";
import { type SpecRelation } from "./typesrelation";

// 들여올 것 한 줄.
//
// `ns` 는 `import * as X from "…"` 입니다. M18·M23 처럼 **모듈이 AssetTable 을
// 통째로 받는** 자리가 있어서 필요합니다 — 이름을 하나씩 적는 꼴로는 못 씁니다
// (2026-09-02).
export type SpecImport = { symbol: string; from: string; ns?: boolean };

// **폴더 파일 이름이 표의 짜임을 정하는 자리** (2026-09-28). 원본을 베끼면 표의 짜임(이닝 수 ×
// 이닝마다 보기 수)도 원본 것이 오는데, 그 짜임은 이 회차 폴더의 파일 이름에 그대로 있다 —
// M05 완성본 15개에서 네 가지가 다 맞았다(`tool/m05shape.ts`). `{i}`·`{j}` 는 0부터의 숫자.
//   file   "images/view_{i}_{j}_basic.png"    폴더에서 찾을 꼴 (리소스 폴더 안 경로)
//   table  "M05_View.image"                    열쇠 표 — outer(i) 아래 inner(j)
//   rows   ["M05_Answer.value", …]             i 칸 × 이닝마다 j 칸인 배열
//   counts ["Com_Inning.length"]               i 와 같아야 하는 수
// 고치는 쪽은 앱의 `filetable.ts` 다. 빈틈 없이 0..N-1 이 다 있을 때만 짠다.
export type FileTable = {
  id: string;
  file: string;
  table: string;
  outer: string;
  inner: string;
  rows?: string[];
  counts?: string[];
  // **그 칸에 어느 그림이 뜨나** (2026-09-28). M05 는 `inning_i.view_s` 칸에
  // `view_i_{M05_View.answer[i][s]}` 를 띄운다(M05_View.ts:278~285) — 칸 번호와 파일 번호가 다르다.
  // 파일 번호는 **화면 왼쪽부터의 자리**다. 없으면 칸 번호가 곧 파일 번호다. 좌표 찾기(`placefind.ts`)가 쓴다.
  shows?: string;
  note: string;
  why?: string;
};

// **번호로 짝인 두 이름 무리** (2026-09-28). M05 는 `btn_sfx_${누른 단추}` 로 소리를 부른다
// (M05_Answer.ts:97) — 소리 파일 이름(`SL_drum_sfx05`)에는 그 번호가 없어, 폴더로는 짝을
// 못 찾는다. 그래서 스펙에 적는다 — `alias` 의 번호 모음이 `follows` 의 번호 모음과 같아야 한다.
//   alias   "btn_sfx_{k}"         따라가는 쪽
//   follows "button_{k}_basic"    정하는 쪽 (폴더 파일이 있는 무리)
// 검사는 `resolvealias.ts`, 고치는 쪽은 앱의 `aliasfollow.ts`(없는 번호를 덜어낸다).
export type AliasFollow = {
  id: string;
  alias: string;
  follows: string;
  note: string;
  why?: string;
};

export type Spec = {
  specVersion: number;
  module: string;
  subject: string;
  title: string;
  summary?: string;
  aliases?: string[];
  aliasNote?: string;
  reference?: { module?: string; activities?: string[] };
  // **학습코드마다 대사 성우의 성별** (2026-10-02 사용자 결정 — 「성우 성별 모듈에다가 넣어놓고 지정해서 쓰면」).
  // 같은 모듈이어도 호마다 박사가 남자 · 여자로 갈린다(K36 1호 남 · 2 · 5 · 6 · 7 · 9호 여). 소리 파일만으로는 모르고 기획서가 말한다 —
  // 그래서 사람이 한 번 적어 둔다. 앞 호 대사를 돌려 쓸 때 **같은 성별의 학습코드에서만** 가져온다(앱 `voice.ts`)
  voices?: Record<string, { gender: "여" | "남"; why: string }>;
  codegen: {
    // 안 적으면 ActivityBase 를 상속합니다.
    extends?: SpecImport;
    // 모듈 하나를 들여올 때. 여럿이면 imports 를 씁니다.
    import?: SpecImport;
    imports?: SpecImport[];
    // **클래스가 들고 있어야 하는 것.** 훅 위, `mStudyCode` 아래에 그대로
    // 나갑니다.
    //
    //   private mM05: M05 = new M05();
    //   public mCom_Content: Com_Content = new Com_Content();
    //
    // **왜 필요한가 (2026-09-08).** 옛 방식 모듈은 액티비티가 인스턴스를 들고
    // 있어야 합니다 — 훅이 `this.mM05.onLoad(…)` 를 부르니까요. 그런데 스펙에
    // 훅만 적을 수 있고 이 선언을 적을 자리가 없어서, 뽑은 액티비티가 **없는
    // 것을 부르고 컴파일이 막혔습니다.** 수학 21장·국어 29장이 그 꼴이었고,
    // 두 검사 다 초록이었습니다 — `check:spec` 은 import 만 보고, 재현 검사는
    // 본문이 다른 것을 「덜 담았다」로 낮춰 보기 때문입니다.
    //
    // **`mStudyCode` 는 여기 적지 않습니다** — 생성기가 늘 냅니다.
    // 여기 적은 이름의 타입은 `imports` 에도 있어야 합니다.
    members?: string[];
    hooks: Partial<Record<HookKey, string[]>>;
    gameDataExport: string;
  };
  assets: {
    providedByModule?: { note?: string } & Partial<Record<AssetKind, string[]>>;
    // 액티비티마다 똑같은 자원. 레시피가 안 적으면 이것이 그대로 들어갑니다.
    defaults?: Partial<Record<AssetKind, RecipeAsset[]>>;
    required?: {
      alias: string;
      kind: AssetKind;
      fixedAlias?: boolean;
      boundTo?: string;
      note?: string;
      // **그림 크기가 정해진 자리** (2026-09-23). 영상 모듈은 재생할 때 `1080 ÷ 썸네일 높이`
      // 로 확대해서, 썸네일이 1921×1081 로 오면 확대가 안 된다(MAL1M07W3S1). 생성기가
      // 파일 크기를 재서 막고(±2px), 앱은 비율이 같으면 이 크기로 줄인다(`imgsize.ts`).
      size?: { w: number; h: number; why?: string };
    }[];
  };
  // kind: "unused" 면 GameData 를 빈 배열로 냅니다(애니메이션처럼 넣을 값이 없는 것).
  // kind 는 **뿌리의 생김새**입니다.
  //   object   `export const quizData = { … }`   (대부분)
  //   unused   `export const quizData = []`      (넣을 값이 없는 모듈)
  //   array    `export const quizData = [ … ]`   (뿌리가 통째로 배열)
  //
  // **`array` 는 칸 하나의 모양을 `of` 에 적습니다** — `fields` 는 비웁니다.
  // 배열 칸(`type: "array"`)과 같은 짜임이라, 값 풀이도 그것을 그대로 씁니다.
  // 영어 WordSparkLv1·E06·E28 이 이 꼴입니다 (2026-09-03).
  gameData: {
    root: string;
    kind?: "object" | "unused" | "array";
    fields: SpecField[];
    of?: SpecField;
    minLength?: number;
    minLengthWhy?: string;
  };
  rules?: SpecRule[];
  relations?: SpecRelation[];
  fileTables?: FileTable[];
  aliasFollows?: AliasFollow[];
  figma?: {
    note?: string;
    formula?: { x: string; y: string };
    defaultAnchor?: Point;
  };
};
