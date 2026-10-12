// 못 간 결과의 모양 — 던지지 않고 `{ ok: false, error }`.
//
// `api.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `api.ts` 에서 가져다 씁니다.

import { generateRecipe } from "./index";

export const SUBJECTS = ["MA", "KO", "EN"] as const;

export type Fail = { ok: false; error: string };
export type GenOut = ReturnType<typeof generateRecipe> | { ok: false; issues: never[]; error: string };

export function fail(e: unknown): Fail {
  return { ok: false, error: (e as Error).message };
}
