// 명령줄 `forge swap` — 갈아끼운 것을 뿌리고, --write 면 _recipe 에 남긴다.
//
// 2026-09-30 에 `swap.ts` 에서 옮김 — 477줄이라. **동작 변화 없음.** 까닭 · 잰 값은 `swap.ts` 머리말.

import fs from "fs";
import path from "path";
import { chalk } from "./color";
import { repoPath } from "./paths";
import { RULE_LABEL, swapResources, type Swap, type SwapRule } from "./swap";
import { countBy } from "./swapnames";
import { families } from "./swapfolder";
// ─── 명령 ────────────────────────────────────────────────────────────────

export function runSwap(originCode: string, newCode: string, write: boolean): boolean {
  let swap: Swap;
  try {
    swap = swapResources(originCode, newCode);
  } catch (e) {
    console.log(chalk.red((e as Error).message));
    return false;
  }

  const { recipe, hits, misses, spare, notes } = swap;
  const total = hits.length + misses.length;

  console.log();
  console.log(chalk.bold(`갈아끼우기 — ${swap.from} → ${recipe.code} (${recipe.subject}/${recipe.module})`));
  console.log(chalk.gray(`  ${swap.dir}`));
  console.log(
    `  원본 별칭 ${total}개 · 새 폴더 파일 ${hits.length + spare.length}개`,
  );

  const by = countBy(hits, (h) => h.rule);
  const rules = (["same", "code", "ext", "num", "tail"] as SwapRule[])
    .filter((r) => by.get(r))
    .map((r) => `${RULE_LABEL[r]} ${by.get(r)}`);
  console.log(
    `  갈아끼움 ${chalk.green(String(hits.length))}` +
      (rules.length ? chalk.gray(`  (${rules.join(" · ")})`) : ""),
  );
  console.log(
    `  손댈 것  못 맞은 별칭 ${chalk.yellow(String(misses.length))} · ` +
      `새 폴더에 남은 파일 ${chalk.yellow(String(spare.length))}`,
  );
  for (const n of notes) console.log(chalk.yellow(`  ${n}`));

  if (misses.length || spare.length) {
    console.log();
    console.log(chalk.bold("무리로 묶어 봅니다"));
    console.log(chalk.gray("  무리                                         원본   새 폴더"));
    for (const f of families(swap)) {
      const mark = f.origin && f.folder ? chalk.yellow("↔") : " ";
      console.log(
        `  ${mark} ${f.family.padEnd(42)}` +
          `${String(f.origin || "").padStart(4)}  ${String(f.folder || "").padStart(6)}`,
      );
    }
    console.log();
    console.log(
      chalk.gray("  ↔ 는 양쪽에 다 있는 무리입니다 — 수가 다르면 이닝 수부터 맞춰야 합니다."),
    );
    console.log(chalk.gray("  원본 쪽만 있으면 버릴 자리, 새 폴더 쪽만 있으면 별칭을 새로 지을 자리입니다."));
  }

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
  if (misses.length) {
    console.log(
      chalk.gray(`못 맞은 ${misses.length}자리는 원본의 파일 이름 그대로입니다 — 사람이 골라야 합니다.`),
    );
  }
  return true;
}
