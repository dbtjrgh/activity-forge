// 재현 검사 — 다 돌린 뒤 결과를 뿌린다(파일마다 통과 · 틀림 · 알림, 채운 자리, 틀린 것 목록).
//
// `checkRepro.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음).

import { chalk } from "@/gen/color";

/** 모으는 동안 쌓은 것 — `main()` 이 넘긴다 */
export type Report = {
  only: string | undefined;
  tally: Map<string, [number, number, number]>;
  bad: string[];
  notes: string[];
  filledIn: string[];
  filled: number;
  ran: number;
  skipped: number;
};

export function printReport(r: Report): void {
  const { only, tally, bad, notes, filledIn, filled, ran, skipped } = r;
  if (ran === 0) {
    console.log(
      chalk.red(only ? `표본이 없습니다: ${only}` : "돌릴 것이 없습니다."),
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `액티비티 ${ran}개를 다시 뽑았습니다.` +
      (skipped ? ` (표본 없음 ${skipped})` : ""),
  );
  console.log();
  console.log("  파일             통과   틀림   알림   견주는 법");
  const HOW: Record<string, string> = {
    "GameData.ts": "값으로",
    "Activity.ts": "코드로 (주석·따옴표·차례 빼고)",
    "AssetTable.ts": "별칭으로",
    "index.html": "글자로 — 다르면 템플릿이 갈린 것",
    "App.vue": "글자로 — 다르면 템플릿이 갈린 것",
    "main.ts": "글자로 — 다르면 템플릿이 갈린 것",
    "style.css": "글자로 — 다르면 템플릿이 갈린 것",
  };
  for (const [file, [pass, fail, note]] of tally) {
    const line =
      `  ${file.padEnd(16)} ${String(pass).padStart(4)}  ${String(fail).padStart(5)}  ` +
      `${String(note).padStart(5)}   ${HOW[file] ?? ""}`;
    console.log(
      fail > 0
        ? chalk.red(line)
        : note > 0
          ? chalk.yellow(line)
          : chalk.green(line),
    );
  }

  if (filled > 0) {
    console.log();
    console.log(
      chalk.cyan(
        `  스펙이 채운 기본값 ${filled}자리 (액티비티 ${filledIn.length}개).`,
      ) + chalk.gray(" 원본에 없던 자리입니다 — 실패가 아닙니다."),
    );
    console.log(
      chalk.gray(
        "  다만 그 기본값이 모듈의 기본값과 다르면 사고입니다. --filled 로 봅니다.",
      ),
    );
    if (process.argv.includes("--filled")) {
      for (const f of filledIn.slice(0, 20))
        console.log(chalk.gray("      · " + f));
    }
  }

  if (notes.length > 0) {
    console.log();
    console.log(
      chalk.yellow(`  템플릿이 갈린 것 ${notes.length}건.`) +
        chalk.gray(" 생성기가 틀린 것이 아닙니다 — --notes 로 봅니다."),
    );
    if (process.argv.includes("--notes")) {
      for (const n of notes.slice(0, 20))
        console.log(chalk.gray("      · " + n));
      if (notes.length > 20)
        console.log(chalk.gray(`      …외 ${notes.length - 20}건`));
    }
  }

  console.log();
  if (bad.length === 0) {
    console.log(chalk.green("값과 코드는 전부 원본과 같습니다."));
    return;
  }
  const cap = process.argv.includes("--all") ? bad.length : 25;
  console.log(
    chalk.red(
      `틀린 것 ${bad.length}건` +
        (bad.length > cap ? ` — 앞의 ${cap}건입니다 (--all 로 전부)` : ""),
    ),
  );
  for (const b of bad.slice(0, cap)) console.log(chalk.gray("  · " + b));
  if (bad.length > cap) console.log(chalk.gray(`  …외 ${bad.length - cap}건`));
  process.exitCode = 1;
}
