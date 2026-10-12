// 스펙 검사 ⑤ 담기 — 완성본 GameData 에 값이 있는데 스펙이 그것을 안 담나.
//
// **왜 따로 보나 (2026-10-02).** ② 왕복은 「에러 없이 통과하나」만 본다 — 항목이 0개인 스펙은 요구하는 것이 없어 늘 통과한다.
// K36 이 그랬다. 완성본 5개가 `export const activityData = {};` 를 먼저 두고 값을 `quizData` 에 담았는데, 스펙을 뽑을 때
// 앞엣것을 집어 「항목 0개」로 떴다. 9호를 만들면 quizData 가 통째로 빠졌고 검사 넷은 다 초록이었다. 재현 검사도 같은 읽기를 써서 못 봤다.
//
// 완성본 전부에서 셋을 봅니다.
//   가  스펙 항목이 0개(`unused` 아님)인데 스펙이 담는 export 에 값이 있다
//   나  `unused` 인데 스펙이 담는 export 에 값이 있다
//   다  액티비티가 GameData 에서 부르는 export 가운데 값이 있는 것을 스펙이 안 담는다(`codegen.gameDataExport` 가 아니다)
// 값이 있는데 아무도 안 부르는 export(ExploreMakeLv2 `quizData2`)는 걸지 않습니다 — 만들어도 빠질 것이 없습니다.

import fs from "node:fs";
import path from "node:path";
import { chalk } from "@/gen/color";
import { loadSpec } from "@/gen/spec";
import { findUsers, listModules, readExports } from "@/gen/survey";
import { ok } from "./checkSpecCount";

const empty = (v: unknown): boolean =>
  v == null || (Array.isArray(v) ? v.length === 0 : typeof v === "object" && Object.keys(v as object).length === 0);

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*["']\.\/GameData["']/g;

/** 액티비티 폴더의 ts 파일들이 `./GameData` 에서 부르는 이름 */
function importedFrom(dir: string): Set<string> {
  const out = new Set<string>();
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "GameData.ts");
  } catch {
    return out;
  }
  for (const f of names) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of text.matchAll(IMPORT))
      for (const one of (m[1] ?? "").split(",")) {
        const name = one.trim().split(/\s+as\s+/)[0]?.trim();
        if (name) out.add(name);
      }
  }
  return out;
}

export function checkFill(): void {
  console.log(chalk.bold("\n⑤ 담기 — 완성본 GameData 에 값이 있는데 스펙이 비었나"));
  const bad: string[] = [];
  let seen = 0;
  for (const row of listModules().filter((m) => m.hasSpec)) {
    let spec;
    try {
      spec = loadSpec(row.subject, row.module);
    } catch {
      continue; // 못 읽는 스펙은 ① 형식이 잡습니다
    }
    const g = spec.gameData;
    const fields = g.kind === "array" ? (g.of ? 1 : 0) : g.fields.length;
    const root = spec.codegen.gameDataExport;
    const hits: string[] = [];
    for (const u of findUsers(row.subject, row.module)) {
      const ex = readExports(path.join(u.dir, "GameData.ts"));
      if (!ex) continue;
      seen += 1;
      const full = !empty(ex.get(root));
      if (g.kind !== "unused" && fields === 0 && full) hits.push(`${u.code}: 항목이 0개인데 ${root} 에 값이 있습니다`);
      else if (g.kind === "unused" && full) hits.push(`${u.code}: unused 인데 ${root} 에 값이 있습니다`);
      const missed = [...importedFrom(u.dir)].filter((n) => n !== root && ex.has(n) && !empty(ex.get(n)));
      if (missed.length) hits.push(`${u.code}: 액티비티가 부르는 ${missed.join(", ")} 를 스펙이 안 담습니다(스펙은 ${root})`);
    }
    if (hits.length) bad.push(`${row.subject}/${row.module} — ${hits[0]}` + (hits.length > 1 ? ` (외 ${hits.length - 1}건)` : ""));
  }
  ok(bad.length === 0, `완성본 ${seen}개 · 걸림 ${bad.length}`);
  for (const b of bad) console.log(chalk.gray("      " + b));
}
