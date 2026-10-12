// 명령줄에 뿌리기 — `forge layout` 의 진행판 · 순서 보기.
//
// 2026-09-30 에 `layout.ts` 에서 옮김 — 1007줄이라. **동작 변화 없음.** 까닭 · 전체 그림은 `layout.ts` 머리말이 정본이고, 바깥은 여태처럼 `layout.ts` 에서 가져다 쓴다.

import { chalk } from "./color";
import { boardOf, moduleOrder, skippedOf, type Stage } from "./layoutboard";
import { printWhy } from "./layoutwhy";

// 한 호를 통째로 보는 표. **두 가지를 뿌립니다.**
//
//   진행판   차시마다 지금 어디까지 왔나          매일 봅니다
//   --why    왜 그 모듈로 골랐나 (판정과 내력)    처음 한 번 봅니다
//
// 판정 근거를 늘 같이 뿌리면 줄이 길어서 진행 상황이 안 읽힙니다.
export type LayoutView = "진행판" | "왜" | "순서";

export function printLayout(subject: string, target: string, view: LayoutView = "진행판"): boolean {
  if (view === "왜") return printWhy(subject, target);
  if (view === "순서") return printOrder(subject, target);
  return printStatus(subject, target);
}

function printOrder(subject: string, target: string): boolean {
  const groups = moduleOrder(subject, target);
  if (!groups.length) {
    console.log(chalk.red(`${subject} 액티비티를 못 찾았습니다.`));
    return false;
  }
  const cells = groups.reduce((n, g) => n + g.codes.length, 0);

  console.log();
  console.log(chalk.bold(`${subject} ${Number(target) + 1}호(M${target}) 만드는 차례`));
  console.log(
    chalk.gray(
      `  모듈 ${groups.length}종 · 칸 ${cells}개 —` +
        " 한 모듈을 잡으면 그 모듈을 쓰는 칸을 다 끝내고 다음으로 갑니다",
    ),
  );
  console.log();

  let n = 0;
  let done = 0;
  for (const g of groups) {
    n += 1;
    const head =
      !g.decided ? chalk.yellow("모듈 못 정함")
      : !g.hasSpec ? chalk.yellow("스펙 먼저")
      : chalk.gray(`${g.codes.length}칸`);
    if (g.decided && g.hasSpec) done += g.codes.length;
    console.log(
      `  ${String(n).padStart(2)}. ${chalk.bold((g.decided ? "" : "? ") + g.module).padEnd(32)}${head}`,
    );
    console.log(chalk.gray(`      ${g.codes.join("  ")}`));
  }

  console.log();
  console.log(`  바로 손댈 수 있는 칸 ${chalk.green(String(done))}/${cells}`);
  console.log();
  return true;
}

export function printStatus(subject: string, target: string): boolean {
  const rows = boardOf(subject, target);
  if (!rows.length) {
    console.log(chalk.red(`${subject} 액티비티를 못 찾았습니다.`));
    return false;
  }

  console.log();
  console.log(chalk.bold(`${subject} ${Number(target) + 1}호(M${target}) 진행판`));
  console.log(
    chalk.gray(
      `  칸 ${rows.length}개 · 모듈은 배치표가 고릅니다` +
        " — 왜 그 모듈인지는 --why · 만드는 차례는 --order",
    ),
  );
  console.log();
  console.log(chalk.gray("  칸       모듈                   스펙  리소스  상태"));

  const tally = new Map<Stage, number>();
  const missing = new Map<string, number>();
  for (const r of rows) {
    tally.set(r.stage, (tally.get(r.stage) ?? 0) + 1);
    if (r.stage !== "모듈 못 정함") {
      for (const x of r.module.split("+")) {
        if (x && !r.hasSpec) missing.set(x, (missing.get(x) ?? 0) + 1);
      }
    }
    const paint =
      r.stage === "만들었음" ? chalk.gray
      : r.stage === "만들 수 있음" ? chalk.green
      : r.stage === "리소스 대기" ? chalk.cyan
      : chalk.yellow;
    // 못 정한 차시는 이름 앞에 물음표를 답니다 — 제일 잦았던 후보일 뿐입니다.
    const name = (r.stage === "모듈 못 정함" ? "? " : "") + (r.module || "-");
    console.log(
      `  ${r.slot.padEnd(8)}${name.padEnd(23)}` +
        `${r.hasSpec ? chalk.green("✔") : chalk.yellow("·")}   ` +
        `${String(r.files).padStart(5)}   ${paint(r.stage)}`,
    );
  }

  console.log();
  const order: Stage[] = ["만들었음", "만들 수 있음", "리소스 대기", "스펙 먼저", "모듈 못 정함"];
  console.log("  " + order.map((k) => `${k} ${tally.get(k) ?? 0}`).join(chalk.gray(" · ")));
  const sk = skippedOf(subject, target);
  if (sk.slots.length) {
    console.log(chalk.gray(`  뺀 칸 ${sk.slots.length} — ${sk.slots.map((x) => x.slot).join(" ")}`));
    if (sk.note) console.log(chalk.gray(`  ${sk.note}`));
  }
  if (missing.size) {
    const list = [...missing.entries()].sort((a, b) => b[1] - a[1]).map(([m, c]) => `${m}(${c})`);
    console.log(`  ${chalk.yellow("스펙이 없는 모듈")} — ${list.join(" · ")}`);
  }
  console.log();
  return true;
}

