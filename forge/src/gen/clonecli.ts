// 명령줄 `forge clone`.
//
// `clone.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `clone.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import { chalk } from "./color";
import { repoPath } from "./paths";
import { cloneFrom, type Clone } from "./clone";
import { KINDS } from "./cloneassets";

// ─── 명령 ────────────────────────────────────────────────────────────────

export function runClone(originCode: string, newCode: string | undefined, write: boolean): boolean {
  let clone: Clone;
  try {
    clone = cloneFrom(originCode, newCode);
  } catch (e) {
    console.log(chalk.red((e as Error).message));
    return false;
  }

  const { recipe, notes } = clone;
  const counts = KINDS.map((k) => [k, recipe.assets?.[k]?.length ?? 0] as const).filter(
    ([, n]) => n > 0,
  );
  const aliasTotal = counts.reduce((n, [, c]) => n + c, 0);

  console.log();
  console.log(chalk.bold(`클론 — ${originCode} (${recipe.subject}/${recipe.module})`));
  console.log(`  값 ${countLeaves(recipe.gameData)}자리 · 별칭 ${aliasTotal}개` +
    (counts.length ? chalk.gray(`  (${counts.map(([k, n]) => `${k} ${n}`).join(" · ")})`) : ""));
  if (recipe.code !== originCode) console.log(`  새 학습코드 — ${recipe.code}`);
  for (const n of notes) console.log(chalk.yellow(`  ${n}`));

  if (!write) {
    console.log();
    console.log(chalk.gray("--write 를 붙이면 _recipe/ 에 남깁니다."));
    return true;
  }

  const file = repoPath("_recipe", `${recipe.code}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(recipe, null, 2), "utf8");
  console.log();
  console.log(chalk.green(`레시피를 썼습니다 — ${file}`));
  console.log(chalk.gray("값은 아직 원본의 것입니다 — 별칭과 문구를 이번 회차 것으로 고치세요."));
  console.log(chalk.gray(`만들려면 — yarn forge make ${recipe.code}.json`));
  return true;
}

// 잎(더 안 쪼개지는 값)이 몇 개인지. 「자리가 몇 개짜리 모듈인가」를 가늠하는 수입니다.
function countLeaves(v: unknown): number {
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + countLeaves(x), 0);
  if (typeof v === "object" && v !== null && !("__expr" in v)) {
    return Object.values(v).reduce<number>((n, x) => n + countLeaves(x), 0);
  }
  return 1;
}
