// 「혼자만 다른 것」 검사.   yarn check:odd [과목/모듈] [--min n] [--all]
//
// 견주는 규칙은 `gen/odd.ts` 에 있습니다. 여기는 **찍는 일만** 합니다 —
// 2단계의 리소스 화면이 같은 결과를 다른 모양으로 보여 줄 자리라 갈라 둡니다.
//
// **막지 않습니다 (`exit 0`).** 짚은 것 중에는 일부러 다르게 만든 자리가
// 섞여 있습니다. 사람이 봐야 할 자리를 좁혀 주는 것이 이 검사의 일입니다.
// 막는 것은 스펙에 적은 관계가 합니다 — `check:spec` 과 셈이 다릅니다.

import { chalk } from "@/gen/color";
import { findOdd, findOddAll, MIN_SAMPLES, type ModuleOdd, type Odd } from "@/gen/odd";

const HELP = `
「혼자만 다른 것」 검사

  yarn check:odd                전 호를 훑어 짚을 것이 있는 모듈만 냅니다
  yarn check:odd MA/M28         모듈 하나만 견줍니다
  yarn check:odd --min 6        표본이 몇 개부터 견줄지 (기본 ${MIN_SAMPLES})
  yarn check:odd --all          짚을 것이 없는 모듈도 한 줄씩 냅니다
`;

function num(argv: string[], flag: string, or: number): number {
  const i = argv.indexOf(flag);
  const v = i < 0 ? NaN : Number(argv[i + 1]);
  return Number.isFinite(v) && v >= 2 ? v : or;
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("help")) {
    console.log(HELP);
    return;
  }
  const min = num(argv, "--min", MIN_SAMPLES);
  const target = argv.find((a) => !a.startsWith("--") && a !== String(min));

  console.log();
  console.log(chalk.bold("「혼자만 다른 것」 검사") +
    chalk.gray(` — 같은 모듈을 쓰는 액티비티끼리 견줍니다 (표본 ${min}개 이상)`));

  if (target) {
    const [subject = "", module = ""] = target.split("/");
    if (!subject || !module) {
      console.log(chalk.red("\n과목/모듈 꼴로 적어 주세요. ex) yarn check:odd MA/M28\n"));
      process.exit(1);
    }
    const one = findOdd(subject.toUpperCase(), module, min);
    console.log();
    printModule(one, true);
    console.log();
    return;
  }

  const rows = findOddAll(min);
  const hit = rows.filter((r) => r.odds.length);
  console.log();
  for (const r of argv.includes("--all") ? rows : hit) printModule(r, argv.includes("--all"));

  const odds = rows.reduce((n, r) => n + r.odds.length, 0);
  const seen = new Set(rows.flatMap((r) => r.samples)).size;
  console.log();
  console.log(chalk.bold("모두 ") +
    `모듈 ${rows.length}종 · 액티비티 ${seen}개 · ` +
    (odds ? chalk.yellow(`짚은 것 ${odds}군데 (모듈 ${hit.length}종)`) : chalk.green("짚을 것 없음")));
  console.log(chalk.gray("  짚은 것이 곧 결함은 아닙니다. 일부러 다르게 만든 자리도 걸립니다."));
  console.log();
}

const CAP = 8; // 한 모듈에서 보여 줄 줄 수

function printModule(r: ModuleOdd, verbose: boolean): void {
  const head = `${r.subject}/${r.module}`;
  if (r.note) {
    if (verbose) console.log(` ${chalk.gray("·")} ${head} — ${chalk.gray(r.note)}`);
    return;
  }
  if (!r.odds.length) {
    if (verbose) console.log(` ${chalk.green("✓")} ${head} — ${chalk.gray(`${r.samples.length}개 견줌, 짚을 것 없음`)}`);
    return;
  }
  console.log(` ${chalk.yellow("!")} ${chalk.bold(head)} ${chalk.gray(`— ${r.samples.length}개 견줌`)}`);
  for (const where of ["Activity.ts", "GameData.ts"] as const) {
    const list = r.odds.filter((o) => o.where === where);
    if (!list.length) continue;
    console.log(chalk.gray(`     ${where}`));
    // 한 모듈이 수십 줄을 쏟으면 다른 모듈이 안 보입니다. 자르고 남은 수를 말합니다.
    for (const o of verbose ? list : list.slice(0, CAP)) printOdd(o);
    if (!verbose && list.length > CAP) {
      console.log(chalk.gray(`       …외 ${list.length - CAP}군데. 다 보려면 --all`));
    }
  }
  console.log();
}

function printOdd(o: Odd): void {
  const rest = o.otherCodes.length;
  if (o.kind === "빠짐") {
    // 사촌 줄이 있으면 「없다」가 아니라 「이렇게 적혀 있다」입니다.
    const word = o.mine ? "만 다르게 적혀 있습니다" : "에만 없습니다";
    console.log(`       ${chalk.cyan(o.code)} ${chalk.gray(`${word} (나머지 ${rest}개는 같습니다)`)}`);
    console.log(`         ${o.what}`);
    if (o.mine) console.log(`         ${chalk.gray("이것은 →")} ${chalk.yellow(o.mine)}`);
  } else {
    console.log(`       ${chalk.cyan(o.code)} ${chalk.gray(`만 다릅니다 (나머지 ${rest}개는 같습니다)`)}`);
    console.log(`         ${o.what} = ${chalk.yellow(cut(o.mine ?? ""))}` +
      chalk.gray(`   나머지: ${cut(o.others ?? "")}`));
  }
  console.log(chalk.gray(`         ${o.otherCodes.slice(0, 6).join(" ")}` +
    (rest > 6 ? ` …외 ${rest - 6}개` : "")));
}

function cut(s: string, max = 44): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

main();
