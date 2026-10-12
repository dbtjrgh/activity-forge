// 명령줄 뿌리기 (`forge survey`).
//
// `survey.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `survey.ts` 에서 가져다 씁니다.

import fs from "fs";
import { chalk } from "./color";
import { listSpecs } from "./spec";
import { surveyAll, findUsers, moduleDir } from "./surveyfind";
import { type FieldStat, compare } from "./surveycompare";

// ─── 화면에 뿌리기 ───────────────────────────────────────────────────────

// `gen survey` — 모듈이 몇 개 있고 어느 것에 스펙이 있는지.
// 많이 쓰는 모듈부터 스펙을 쓰는 것이 이득이라 그 차례로 보여 줍니다.
export function printSurvey(): void {
  const table = surveyAll();
  const have = new Set<string>();
  for (const subject of ["MA", "KO", "EN"]) {
    for (const m of listSpecs(subject)) have.add(subject + "/" + m);
  }

  const rows = [...table.entries()].sort((a, b) => b[1].length - a[1].length);
  const done = rows.filter(([k]) => have.has(k)).length;

  console.log();
  console.log(chalk.bold(`모듈 ${rows.length}종 · 스펙 있는 것 ${done}종`));
  console.log(chalk.gray("액티비티가 많은 모듈부터. ✔ 는 스펙이 이미 있는 것입니다."));
  console.log();
  for (const [key, list] of rows) {
    const mark = have.has(key) ? chalk.green("✔") : chalk.gray("·");
    const count = String(list.length).padStart(3);
    const name = key.padEnd(20);
    console.log(` ${mark} ${count}개  ${have.has(key) ? chalk.green(name) : name}`);
  }
  console.log();
  console.log(chalk.gray("자세히 보려면: yarn forge survey MA/M27"));
  console.log();
}

// `gen survey MA/M27` — 그 모듈을 쓰는 액티비티와, 값을 견준 표.
export function printModule(subject: string, module: string, all = false): boolean {
  const users = findUsers(subject, module);
  console.log();
  if (!users.length) {
    console.log(chalk.red(`${subject}/${module} 을 쓰는 액티비티가 없습니다.`));
    console.log(chalk.gray("모듈 이름을 확인하세요: yarn forge survey"));
    console.log();
    return false;
  }

  const dir = moduleDir(subject, module);
  const roots = new Set(users.map((s) => s.root).filter(Boolean));
  console.log(chalk.bold(`${subject}/${module} — 액티비티 ${users.length}개`));
  console.log(chalk.gray(`모듈 소스: ${dir}${fs.existsSync(dir) ? "" : "  (없습니다)"}`));
  console.log(chalk.gray(`GameData: export ${[...roots].join(" / ") || "(없음)"}`));

  // 표본 목록은 어디를 봤는지 알려 주는 정도면 됩니다. 짧게 냅니다.
  const codes = users.map((s) => (s.note ? chalk.yellow(s.code + "?") : s.code));
  console.log(chalk.gray(" 표본: ") + codes.slice(0, 12).join(" ") +
    (codes.length > 12 ? chalk.gray(` …외 ${codes.length - 12}개`) : ""));
  for (const s of users.filter((u) => u.note)) {
    console.log(chalk.yellow(`  ${s.code} — ${s.note}`));
  }

  printDiff(compare(users), all);
  return true;
}

// 견준 결과를 표로. 고정은 흐리게, 입력칸은 또렷하게 냅니다 —
// 스펙을 쓸 때 손이 가야 하는 것은 「칸」 줄뿐입니다.
export function printDiff(stats: FieldStat[], all: boolean): void {
  const CAP = 60;
  const rows = all ? stats : stats.slice(0, CAP);
  const width = Math.min(46, Math.max(...rows.map((r) => label(r.path).length), 10));

  const n = { 고정: 0, 칸: 0, 가끔: 0 };
  for (const s of stats) n[s.kind]++;

  console.log();
  console.log(chalk.bold(`값 견주기 — 자리 ${stats.length}개`) +
    chalk.gray(`  (칸 ${n["칸"]} · 고정 ${n["고정"]} · 가끔 ${n["가끔"]})`));
  console.log();
  for (const s of rows) {
    const name = label(s.path).padEnd(width);
    const type = chalk.gray(s.type.padEnd(8));
    if (s.kind === "고정") {
      console.log(` ${chalk.gray("고정")} ${chalk.gray(name)} ${type} ${chalk.gray(cut(s.values[0] ?? ""))}`);
    } else if (s.kind === "칸") {
      console.log(` ${chalk.cyan("칸  ")} ${name} ${type} ${chalk.gray(`${s.values.length}가지 · `)}${examples(s.values)}`);
    } else {
      console.log(` ${chalk.yellow("가끔")} ${name} ${type} ${chalk.gray(`${s.inSamples}/${s.total}개에만 · ${s.values.length}가지`)}`);
    }
  }
  if (!all && stats.length > CAP) {
    console.log(chalk.gray(`\n …${stats.length - CAP}줄 더 있습니다. 다 보려면 --all`));
  }
  console.log();
}

// 뿌리 자체를 가리키는 빈 자리는 눈에 보이게 이름을 붙여 줍니다.
function label(path: string): string {
  return path.startsWith(" ⟨") ? "(뿌리)" + path : path || "(뿌리)";
}

function examples(values: string[]): string {
  return values.slice(0, 2).map((v) => cut(v, 26)).join(chalk.gray(" / "));
}

function cut(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
