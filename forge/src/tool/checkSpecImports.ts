// 스펙 검사 ④ import — 훅이 부르는 것을 스펙이 다 들여왔나.
//
// `checkSpec.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음).

import fs from "fs";
import { chalk } from "@/gen/color";
import { listModules } from "@/gen/survey";
import { repoPath } from "@/gen/paths";
import type { Spec, SpecImport } from "@/gen/types";
import { PROVIDED_SYMBOLS } from "@/gen/render";
import { symbolsInMembers } from "@/gen/draft";
import { ok } from "./checkSpecCount";

// ─── ④ import ────────────────────────────────────────────────────────────

// 생성한 AssetTable.ts 가 내보내는 것 전부(`renderassets.ts` 의 renderAssetTable).
// `import * as AssetTable` 로 받은 훅이 이것 말고 다른 이름을 부르면,
// 그 스펙으로 만든 액티비티는 컴파일되지 않습니다.
const ASSET_TABLE_EXPORTS = ["font", "image", "sound", "lottie"];

// 들여올 것이 아닌 흔한 전역.
const GLOBALS = [
  "Math",
  "JSON",
  "Object",
  "Array",
  "Number",
  "String",
  "Boolean",
  "Date",
  "Promise",
];

// 멤버 줄의 타입 자리에 나오되 들여올 것이 아닌 것.
const BUILTIN_TYPES = [
  "string",
  "number",
  "boolean",
  "any",
  "unknown",
  "void",
  "null",
  "undefined",
];

// 따옴표 안은 글자입니다.
const QUOTED_TEXT = /"[^"]*"|'[^']*'|`[^`]*`/g;

// **아는 결함.** 여기 적는 것은 「고칠 줄 알지만 아직 안 고친 것」입니다.
// 낡으면 아래에서 알려 줍니다 — 고친 뒤에 지우세요.
const KNOWN_IMPORT: Array<{ spec: string; symbol: string; why: string }> = [
  {
    spec: "MA/M15",
    symbol: "AssetTable.*",
    why: "모듈이 나레이션 목록·경로 이름을 AssetTable 에서 받습니다(wrongNar·correctNar·spritePathLabel 등 7개) — 스펙이 아직 그런 자리를 못 적습니다",
  },
];

function symbolsInHooks(lines: string[]): Set<string> {
  const out = new Set<string>();
  for (const line of lines) {
    const bare = line.replace(/\/\/.*$/, "").replace(QUOTED_TEXT, "''");
    for (const m of bare.matchAll(/(^|[^.\w$])([A-Z][A-Za-z0-9_]*)\s*[.(]/g)) {
      if (m[2]) out.add(m[2]);
    }
  }
  return out;
}

// `AssetTable.wrongNar` 처럼 통째로 받은 것에서 꺼내 쓰는 이름.
function membersOf(lines: string[], ns: string): Set<string> {
  const out = new Set<string>();
  const re = new RegExp("\\b" + ns + "\\.(\\w+)", "g");
  for (const line of lines) {
    const bare = line.replace(/\/\/.*$/, "").replace(QUOTED_TEXT, "''");
    for (const m of bare.matchAll(re)) if (m[1]) out.add(m[1]);
  }
  return out;
}

export function checkImports(): void {
  console.log(chalk.bold("\n④ import — 훅이 부르는 것을 다 들여왔나"));
  let pass = 0;
  let excused = 0;
  const hit = new Set<string>();
  const bad: string[] = [];

  for (const row of listModules().filter((m) => m.hasSpec)) {
    const key = `${row.subject}/${row.module}`;
    const file = specFile(row.subject, row.module);
    if (!file) continue;
    const spec = JSON.parse(fs.readFileSync(file, "utf8")) as Spec;
    const c = spec.codegen;
    const imports = [c.import, ...(c.imports ?? [])].filter(
      Boolean,
    ) as SpecImport[];
    const lines = Object.values(c.hooks ?? {}).flat() as string[];
    const here: string[] = [];

    // ㉮ 생성기가 이미 써 주는 것을 또 적었나 — import 가 두 번 나갑니다.
    for (const i of imports) {
      if (PROVIDED_SYMBOLS.includes(i.symbol)) {
        here.push(
          `${key} — ${i.symbol} 은 생성기가 이미 들여옵니다. 스펙에서 빼세요.`,
        );
      }
    }

    // ㉯ 훅이 부르는데 안 들여왔나 — 컴파일이 안 됩니다.
    const have = new Set<string>([
      ...imports.map((i) => i.symbol),
      ...PROVIDED_SYMBOLS,
      c.gameDataExport,
      c.extends?.symbol ?? "ActivityBase",
      ...GLOBALS,
    ]);
    for (const s of symbolsInHooks(lines)) {
      if (!have.has(s))
        here.push(`${key} — 훅이 ${s} 을 부르는데 안 들여왔습니다.`);
    }

    // ㉯′ 멤버가 쓰는 **타입 이름**도 들여와 있어야 합니다.
    // `private mM05: M05 = new M05();` 에서 `M05` 가 없으면 컴파일이 안 됩니다.
    // 기본 타입(string·boolean·number 따위)은 들여올 것이 아닙니다.
    for (const s of symbolsInMembers(c.members ?? [])) {
      if (BUILTIN_TYPES.includes(s) || have.has(s)) continue;
      here.push(`${key} — 멤버가 ${s} 을 쓰는데 안 들여왔습니다.`);
    }

    // ㉰ 통째로 받은 AssetTable 에서 없는 것을 꺼내 쓰나.
    for (const i of imports) {
      if (!i.ns || !i.from.includes("AssetTable")) continue;
      for (const m of membersOf(lines, i.symbol)) {
        if (ASSET_TABLE_EXPORTS.includes(m)) continue;
        // `AssetTable.*` 는 그 통째 받은 것에서 꺼내 쓰는 것 전부를 뜻합니다.
        const known = KNOWN_IMPORT.find(
          (k) =>
            k.spec === key &&
            (k.symbol === `${i.symbol}.${m}` || k.symbol === `${i.symbol}.*`),
        );
        if (known) {
          hit.add(known.spec + known.symbol);
          excused += 1;
          continue;
        }
        here.push(`${key} — 만든 AssetTable 에 ${m} 이 없습니다.`);
      }
    }

    if (here.length) bad.push(...here);
    else pass += 1;
  }

  ok(
    bad.length === 0,
    `통과 ${pass} · 걸림 ${bad.length}` +
      (excused ? ` · 아는 결함 ${excused}` : ""),
  );
  for (const b of bad.slice(0, 10)) console.log(chalk.gray("      " + b));
  if (bad.length > 10)
    console.log(chalk.gray(`      …외 ${bad.length - 10}건`));
  for (const k of KNOWN_IMPORT) {
    if (!hit.has(k.spec + k.symbol)) {
      console.log(
        chalk.yellow(
          `      아는 결함이 낡았습니다 — ${k.spec} ${k.symbol} 은 이제 안 걸립니다. 지우세요.`,
        ),
      );
    } else {
      console.log(chalk.yellow(`      · ${k.spec} ${k.symbol} — ${k.why}`));
    }
  }
}

// 스펙 파일이 어디 있나. 과목 폴더에 없으면 `_common` 을 봅니다.
function specFile(subject: string, module: string): string | null {
  for (const dir of [subject, "_common"]) {
    const p = repoPath("_spec", dir, `${module}.json`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
