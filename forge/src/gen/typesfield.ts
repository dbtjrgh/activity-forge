// 스펙의 자리 — 훅 한 벌 · 필드 · 배리언트 · 규칙.
//
// `types.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `types.ts` 에서 가져다 씁니다.

import type { AssetKind, Point } from "./types";

// ─── 스펙 ────────────────────────────────────────────────────────────────

// **훅 한 벌.** 전에는 이 목록이 **네 군데에 따로** 있었습니다 — 타입(여기)·
// 표본에서 물어 오는 쪽(`draft.ts`)·내보내는 쪽(`render.ts`)·형식 검사
// (`specCheck.ts`). 넷이 어긋나서 **스펙 53장이 훅을 흘렸습니다** (2026-09-02).
//
//   onAffordanceOn 35장 · onAffordanceCanceled 32장 · onUpdate 23장 · onResize 14장
//
// 표본 전부가 부르는데 스펙에는 없으니, 뽑으면 **힌트 버튼도 리사이즈도 매
// 프레임 갱신도 통째로 빠집니다.** 컴파일은 되고 동작만 조용히 사라지는 갈래라
// M28 의 엔딩(`SparkApp.eop.show()`)과 같은 사고입니다.
//
// **차례가 곧 내보내는 차례입니다.** 원본이 쓰는 차례를 따랐습니다
// (`ENL1M02W1S1` — onStart → onAffordanceOn → onResize).
export const HOOK_KEYS = [
  "onLoad",
  "onInit",
  "onStart",
  "onEnd",
  "onUpdate",
  "onAffordanceOn",
  "onAffordanceCanceled",
  "onResize",
] as const;

export type HookKey = (typeof HOOK_KEYS)[number];

export type FieldType =
  | "string"
  | "number"
  | "bool"
  | "enum"
  | "point"
  | "posTable"
  | "object"
  | "array"
  | `asset:${AssetKind}`;

export type SpecField = {
  key: string;
  type: FieldType;
  desc?: string;
  required?: boolean;
  requiredIf?: string; // 사람이 읽는 조건. 생성기는 rules 로 검사합니다.
  optional?: boolean;
  // **AssetTable 에 없으면 「안 쓰는 것」인 그림·소리 자리** — 막지 않고 경고만 합니다.
  // 값은 왜 그런지. 완성본이 AssetTable 줄을 주석으로 막아 끄거나(K17 rocketEnd),
  // 모듈이 아예 안 읽는 자리(K21 timer)가 그렇습니다 (2026-09-28, `tool/donegate.ts`).
  aliasMayBeOff?: string;
  default?: unknown;
  // **왜 그 기본값인가.** `default` 가 있으면 그 자리는 다음 호부터 사람에게
  // 안 묻습니다 — 양산 화면이 「다음 호에도 같습니다」로 올린 것이 여기
  // 들어옵니다 (`_document/양산계획.md` 5단계). 까닭이 없으면 나중에
  // 「누가 왜 정했지」를 다시 묻게 되므로 올릴 때 늘 같이 씁니다.
  defaultWhy?: string;
  // **그림 크기에 맞춰 정한 배율** (2026-10-02). 같은 칸 안 `image` 자리(점 경로, 예 "texture.quiz")의 그림이 원본과 다른 크기로 오면
  // 화면에서 원본과 같은 크기로 보이게 다시 셈한다 — 새 값 = 원본 값 × 원본 그림 너비 ÷ 새 그림 너비(`gen/rescale.ts`).
  // 사람 · AI 답이 있으면 그 답이 이긴다. 어느 자리가 그런지는 `tool/scalegate.ts` 로 잰다
  scalesWith?: { image: string; why: string };
  figma?: boolean; // true 면 좌표 변환 대상
  // 화면 한가운데가 아니라 다른 것에 붙어 다니는 좌표일 때.
  // figma 로 적은 값에서 이 기준을 빼서 넣습니다.
  //   field   gameData 뿌리에서 센 경로. 그 자리의 좌표를 기준으로 씁니다
  //   offset  모듈 안에 박혀 있어 GameData 에 안 나오는 몫
  //   label   화면에 「무엇 기준인지」 보여 줄 이름
  figmaBase?: { field?: string; offset?: Point; label?: string };
  values?: string[]; // type === "enum"
  minLength?: number; // type === "array"
  minLengthWhy?: string; // 왜 그만큼 있어야 하는지. 「3개여야 함」만으로는 납득이 안 됩니다
  fixed?: boolean; // 칸 수가 정해진 배열. 화면에서 넣고 빼지 못하게 합니다
  // 칸마다 모양이 달라 `of` 를 **일부러** 안 적은 배열.
  // 값을 그대로 씁니다 — 화면은 칸을 그려 주지 못합니다.
  // 이 표시가 없는데 `of` 가 없으면 빠뜨린 것입니다(`specCheck.ts` 가 잡습니다).
  mixed?: boolean;
  itemLabels?: string[]; // 칸마다 붙일 이름. ex) ["왼쪽 자리", "가운데 자리", "오른쪽 자리"]
  keyedBy?: string; // type === "posTable"
  fields?: SpecField[]; // type === "object"
  // **열쇠가 번호로 늘어나는 객체.** `cards` 의 c1·c2·c3… 이 그것입니다.
  //
  // 전에는 스펙에 c1~c8 을 손으로 적어 두었습니다. 그런데 회차마다 낱말 수가
  // 다르고, 8호 ENL1M07W2S2 가 **열둘**로 왔습니다 — 스펙에 없는 c9 부터는
  // 화면에서 더할 수가 없었습니다. 올 때마다 스펙을 늘리는 것은 끝이 없습니다.
  //
  //   prefix  열쇠 앞머리. "c" 면 c1 · c2 · …
  //   of      한 칸의 모양. 칸이 다 같으므로 한 벌만 적습니다
  //   min     적어도 몇 칸이어야 하는지
  //   label   화면에서 부를 이름 ("낱말 카드")
  //
  // `fields` 와 같이 쓸 수 있습니다 — 고정 열쇠는 `fields` 에, 번호로 늘어나는
  // 것만 여기에 적습니다.
  series?: { prefix: string; of: SpecField; min?: number; label?: string };
  of?: SpecField & { type: "object" | string }; // type === "array"
  variants?: SpecVariants;
};

export type SpecVariants = {
  discriminator: string;
  note?: string;
  cases: { name: string; when: string; fields: SpecField[] }[];
};

export type SpecRule = {
  id: string;
  level: "error" | "warn";
  check: string;
  why?: string;
};
