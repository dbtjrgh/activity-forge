// 명령줄 「왜」 보기 — 칸마다 왜 그 모듈인가.
//
// 2026-09-30 에 `layout.ts` 에서 옮김 — 1007줄이라. **동작 변화 없음.** 까닭 · 전체 그림은 `layout.ts` 머리말이 정본이고, 바깥은 여태처럼 `layout.ts` 에서 가져다 쓴다.

import { listSpecs } from "./spec";
import { chalk } from "./color";
import { runs, scanCells, type Verdict } from "./layoutcore";
import { placementOf } from "./layoutplace";

// ─── 왜 그 모듈인가 ──────────────────────────────────────────────────────

export function printWhy(subject: string, target: string): boolean {
  const cells = scanCells(subject);
  if (!cells.length) {
    console.log(chalk.red(`${subject} 액티비티를 못 찾았습니다.`));
    return false;
  }

  const specs = new Set(listSpecs(subject));
  const slots = [...new Set(cells.map((c) => c.slot))].sort();
  const issues = [...new Set(cells.map((c) => c.issue))].sort();
  const builtIssue = (i: string): boolean => cells.some((c) => c.issue === i && c.module !== "");
  const before = issues.filter((i) => i < target && builtIssue(i));
  const after = issues.filter((i) => i > target && builtIssue(i));

  console.log();
  console.log(chalk.bold(`${subject} ${Number(target) + 1}호(M${target}) 모듈 배치표`));
  console.log(
    chalk.gray(
      `  칸마다 어느 모듈이 들어가는지 앞선 호에서 찾습니다` +
        ` — 칸 ${slots.length}개 · 근거로 삼은 앞선 호 ${before.length}개 (${before.join(" ")})`,
    ),
  );
  if (after.length) {
    console.log(chalk.gray(`  뒤 호 ${after.join(" ")} 는 참고로만 뿌립니다 — 칸 짜임이 다릅니다`));
  }
  console.log(chalk.gray("  ✔ 스펙 있음 (지금 뽑을 수 있습니다) · · 스펙 없음 (먼저 써야 합니다)"));
  console.log();

  const tally: Record<Verdict, number> = { 사람: 0, 한가지: 0, 교대: 0, 갈림: 0, 없음: 0 };
  let ready = 0;
  const missing = new Map<string, number>();
  const undecided: string[] = [];

  for (const slot of slots) {
    const p = placementOf(subject, target, slot, cells);
    tally[p.verdict] += 1;

    // 여러 모듈을 같이 쓰는 차시가 있습니다. 전부 스펙이 있어야 뽑힙니다.
    const parts = p.module ? p.module.split("+") : [];
    const have = parts.length > 0 && parts.every((x) => specs.has(x));
    if (p.verdict !== "갈림" && p.verdict !== "없음") {
      if (have) ready += 1;
      for (const x of parts) if (!specs.has(x)) missing.set(x, (missing.get(x) ?? 0) + 1);
    } else {
      undecided.push(slot);
    }

    const paint =
      p.verdict === "사람" ? chalk.bold
      : p.verdict === "한가지" ? chalk.green
      : p.verdict === "교대" ? chalk.cyan
      : p.verdict === "갈림" ? chalk.yellow
      : chalk.gray;
    const seen = p.before.filter((i) => p.at.get(i));
    const tail =
      p.verdict === "사람" ? chalk.gray(`사람이 정했습니다 · ${runs(p.before, p.at)}`)
      : p.verdict === "한가지"
        ? chalk.gray(
            seen.length === p.before.length
              ? `앞선 호 ${seen.length}개가 다 같습니다`
              : `${seen.join("·")} 호에만 있고 다 같습니다`,
          )
      : p.verdict === "교대" ? chalk.gray(`반대쪽은 ${p.other} · ${runs(p.before, p.at)}`)
      : chalk.gray(runs(p.before, p.at));
    const later = after.map((i) => p.at.get(i)).filter(Boolean).join("/");

    console.log(
      `  ${slot.padEnd(7)}${have ? chalk.green("✔") : chalk.gray("·")} ` +
        `${chalk.gray((p.wbs?.code ?? "").padEnd(4))}${(p.wbs?.title ?? "").padEnd(15)}` +
        `${paint(p.verdict.padEnd(3))} ${(p.module || "-").padEnd(21)}${tail}` +
        (later ? chalk.gray(`  [뒤 ${later}]`) : ""),
    );
  }

  console.log();
  console.log(
    `  사람 ${chalk.bold(String(tally["사람"]))} · ` +
      `한가지 ${chalk.green(String(tally["한가지"]))} · 교대 ${chalk.cyan(String(tally["교대"]))} · ` +
      `갈림 ${chalk.yellow(String(tally["갈림"]))} · 없음 ${chalk.gray(String(tally["없음"]))}`,
  );
  console.log(
    `  ${chalk.bold("모듈이 정해지고 스펙도 있어 지금 뽑을 수 있는 칸")} ` +
      `${chalk.green(String(ready))}/${slots.length}`,
  );
  if (missing.size) {
    const list = [...missing.entries()].sort((a, b) => b[1] - a[1]).map(([m, c]) => `${m}(${c})`);
    console.log(`  ${chalk.yellow("스펙이 없는 모듈")} — ${list.join(" · ")}`);
  }
  if (undecided.length) {
    console.log(`  ${chalk.yellow("아직 못 정한 칸")} — ${undecided.join(" ")}`);
  }
  console.log();
  return true;
}

