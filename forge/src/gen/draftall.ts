// 스펙이 없는 모듈을 전부 (`forge draft --all`).
//
// `draft.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `draft.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import { chalk } from "./color";
import { listModules } from "./survey";
import { type Draft, draftSpec } from "./draftspec";
import { MIN_SAMPLES_FOR_DEFAULT } from "./draftshape";
import { targetFile, mergeInto } from "./draftrun";
import { countFields } from "./draftmerge";

export function runDraftAll(force: boolean): boolean {
  const rows = listModules().filter((r) => force || !r.hasSpec);
  const made: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  const lost: string[] = [];

  console.log();
  console.log(chalk.bold(`스펙이 없는 모듈 ${rows.length}종을 훑습니다.`));
  console.log();

  for (const r of rows) {
    const key = `${r.subject}/${r.module}`;
    let d: Draft;
    try {
      d = draftSpec(r.subject, r.module);
    } catch (e) {
      failed.push(`${key} — ${(e as Error).message}`);
      continue;
    }
    if (d.arrayRoot) {
      skipped.push(`${key} — GameData 뿌리가 배열입니다`);
      continue;
    }
    const file = targetFile(r.subject, r.module, d.samples);
    // **사람이 쓴 글은 걷어서 도로 얹습니다** — 건너뛰지 않습니다.
    //
    // 예전에는 제목이 있으면 통째로 건너뛰었습니다. 그랬더니 `draft.ts` 를
    // 일곱 군데 고쳐 GameData 재현을 65 → 113 으로 올린 날, 손으로 쓴 세 장만
    // 그 혜택을 하나도 못 받았습니다. **잠글 것은 사람이 쓴 글이지 스펙
    // 전체가 아닙니다** (2026-09-02, 위 `mergeHuman`).
    const merged = mergeInto(d.spec, file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(merged.spec, null, 2) + "\n", "utf8");
    made.push(key);
    if (merged.lost.length) {
      lost.push(
        `${key} — 얹을 자리가 없어졌습니다: ${merged.lost.join(" · ")}`,
      );
    }
    // 표본이 적으면 견줄 것이 없어 초안을 믿기 어렵습니다. 눈에 띄게 둡니다.
    const thin = d.samples.length < MIN_SAMPLES_FOR_DEFAULT;
    console.log(
      ` ${thin ? chalk.yellow("△") : chalk.green("✔")} ${key.padEnd(20)} ${chalk.gray(
        `자리 ${countFields(d.spec.gameData.fields)}개 · 표본 ${d.samples.length}개`,
      )}` +
        (thin ? chalk.yellow("  ← 표본이 적어 견줄 것이 없습니다") : "") +
        (merged.kept
          ? chalk.cyan(`  ← 사람이 쓴 글 ${merged.kept}자리 얹음`)
          : ""),
    );
  }

  if (lost.length) {
    console.log();
    console.log(chalk.yellow(`사람이 쓴 글을 못 얹은 것 ${lost.length}종`));
    for (const s of lost) console.log(chalk.gray("   " + s));
  }

  if (skipped.length) {
    console.log();
    console.log(chalk.yellow(`건너뛴 것 ${skipped.length}종`));
    for (const s of skipped) console.log(chalk.gray("   " + s));
  }
  if (failed.length) {
    console.log();
    console.log(chalk.red(`못 만든 것 ${failed.length}종`));
    for (const s of failed) console.log(chalk.gray("   " + s));
  }

  console.log();
  console.log(chalk.green(`${made.length}종을 spec/ 에 남겼습니다.`));
  console.log(
    chalk.gray(
      "제목과 자리별 설명은 그 모듈을 쓸 때 채우면 됩니다 — 채워도 다시 뽑을 수 있습니다.",
    ),
  );
  console.log();
  return made.length > 0;
}
