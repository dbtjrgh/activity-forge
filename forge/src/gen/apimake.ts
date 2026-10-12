// 배치표와 클론 · 만들기.
//
// `api.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `api.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import type { Recipe } from "./types";
import { parseStudyCode } from "./spec";
import { repoPath } from "./paths";
import { generateRecipe } from "./index";
import { cloneFrom } from "./clone";
import { originFor } from "./layout";
import { type GenOut, fail } from "./apifail";

// ── 배치표와 클론 ───────────────────────────────────────────────────

// 학습코드 하나로 **「어느 모듈 · 어느 원본」**을 돌려줍니다. 화면에서 학습코드를
// 다 적으면 이걸 불러 모듈 칸과 원본 칸이 저절로 채워집니다.
//
// **못 고르면 까닭을 그대로 내보냅니다.** 「갈림」인 차시는 사람이 정해야 하는데,
// 화면이 조용히 아무거나 고르면 안 됩니다.
export function layoutFor(code: string) {
  try {
    return { ok: true as const, ...originFor(code) };
  } catch (e) {
    return fail(e);
  }
}

// 이미 있는 회차를 통째로 떠 옵니다. **파일은 안 건드리고 값만 내줍니다.**
// 자리가 800개쯤 되는 모듈에서 빈 폼부터 채우는 것은 못 할 짓입니다.
export function clone(from: string, to?: string) {
  try {
    const c = cloneFrom(from, to || undefined);
    return { ok: true as const, recipe: c.recipe, from: parseStudyCode(from)?.code ?? from, notes: c.notes };
  } catch (e) {
    return fail(e);
  }
}

// ── 만들기 ──────────────────────────────────────────────────────────

// 화면이 부르는 것도 명령이 부르는 것과 같은 함수입니다.
function run(recipe: Recipe, opts: { dry?: boolean; force?: boolean }): GenOut {
  try {
    return generateRecipe(recipe, opts);
  } catch (e) {
    return { ok: false, issues: [], error: (e as Error).message };
  }
}

export function check(recipe: Recipe): GenOut {
  return run(recipe, { dry: true });
}

export function generate(recipe: Recipe, force = false, save = true): GenOut {
  const out = run(recipe, { force });
  if (out.ok && save) saveRecipe(recipe);
  return out;
}

// 만든 것은 레시피로도 남깁니다. 다음에 고칠 때 처음부터 다시 적지 않게.
function saveRecipe(recipe: Recipe): void {
  const study = parseStudyCode(recipe.code ?? "");
  if (!study) return;
  const file = repoPath("_recipe", study.code + ".json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(recipe, null, 2) + "\n", "utf8");
}
