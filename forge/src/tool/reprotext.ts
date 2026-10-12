// 재현 검사 — 글 견주기(주석 · 따옴표 · import 줄 고르기).
//
// `checkRepro.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `checkRepro.ts` 에서 가져다 씁니다.

import fs from "fs";
import os from "os";
import path from "path";
import { readExports } from "@/gen/survey";

export function stripComments(s: string): string {
  return s
    .split("\n")
    .map((l) =>
      l.trimStart().startsWith("//") ? "" : l.replace(/\s+\/\/.*$/, ""),
    )
    .filter((l) => l.trim() !== "")
    .join("\n");
}

// 홑따옴표·쌍따옴표를 맞춥니다. 액티비티 1188개가 두 가지를 섞어 씁니다
// (쌍 487 · 홑 271) — **어느 쪽으로 적었는지는 동작과 상관이 없습니다.**
export function normQuote(s: string): string {
  return s.replace(/'/g, '"');
}

// import 줄과 나머지를 가릅니다. **import 는 차례가 자유**라 줄 번호로 견주면
// 안 됩니다 — 첫 판에 113개 중 112개가 「1번째 줄이 다릅니다」로 걸렸는데,
// 들여온 것은 다 같고 적은 차례만 달랐습니다.
export function splitImports(s: string): { imports: string[]; body: string } {
  const imports: string[] = [];
  const body: string[] = [];
  for (const line of s.split("\n")) {
    if (/^\s*import\s/.test(line)) imports.push(normImport(line));
    else body.push(line);
  }
  return { imports: imports.sort(), body: body.join("\n").replace(/^\n+/, "") };
}

// 같은 import 를 적는 법이 여러 가지입니다. 실물에서 본 것을 다 맞춥니다 —
// 세미콜론이 있는 것과 없는 것, 경로 끝에 `.ts` 를 붙인 것과 안 붙인 것.
//
//   import { ActivityBase } from "@_common/sparkLib/ActivityBase"     원본
//   import { ActivityBase } from "@_common/sparkLib/ActivityBase";    생성기
//   import { K24 } from "@_common/module/KR/K24/K24.ts"               원본
//
// 맞추기 전에는 이것만으로 40건이 「안 들여왔습니다」로 걸렸습니다.
//   import {E07} from "@_common/module/EN"                            원본
//   import { E07 } from "@_common/module/EN"                          생성기
//
// 맞추기 전에는 이것만으로 40건이 「안 들여왔습니다」로 걸렸습니다.
// 중괄호 안쪽 띄어쓰기까지 맞춘 뒤 네 건이 더 사라졌습니다 (2026-09-02).
function normImport(line: string): string {
  return line
    .trim()
    .replace(/;+$/, "")
    .replace(/\.ts"/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\{\s*/g, "{ ")
    .replace(/\s*\}/g, " }")
    .replace(/\s*,\s*/g, ", ");
}

// **「안 들여왔습니다」를 두 갈래로 가릅니다.**
//
// 원본에만 있는 import 가 다 결함은 아닙니다. 원본에는 사람이 쓴 클래스 본문이
// 있고 그것이 `pixi.js` 를 직접 씁니다 — 생성기는 훅만 내놓으니 그 import 를
// 낼 수가 없고, 억지로 내면 **안 쓰는 import** 가 되어 컴파일이 막힙니다.
//
// 갈라 놓지 않아서 실제로 놓쳤습니다. M28 의 `SparkApp` 이 이 목록 맨 위에
// 있었는데 pixi 잡음 여덟 줄과 한 데 섞여 있어 「급하지 않다」고 낮춰 봤고,
// 그 스펙으로 뽑은 액티비티가 **활동이 안 끝나는 채로** 나갔습니다 (2026-09-02).
//
//   틀림   모듈·sparkLib·공용모듈    모듈을 돌리는 데 필요한 것입니다
//   알림   pixi.js·상대경로          원본의 손코드용입니다
export function mattersToModule(line: string): boolean {
  const from = /from\s+"([^"]+)"/.exec(line)?.[1] ?? "";
  if (from === "" || from.startsWith(".")) return false;
  if (from === "pixi.js" || from.startsWith("pixi.js/")) return false;
  return true;
}

// 첫 번째로 어긋난 줄. 글자 검사에서 "다릅니다" 만 말하면 손댈 수가 없습니다.
export function firstDiffLine(a: string, b: string): string {
  const la = a.split("\n");
  const lb = b.split("\n");
  for (let i = 0; i < Math.max(la.length, lb.length); i += 1) {
    if (la[i] === lb[i]) continue;
    return `${i + 1}번째 줄 — 원본 「${cut(la[i])}」 · 뽑은 것 「${cut(lb[i])}」`;
  }
  return "길이만 다릅니다";
}

export function cut(s: string | undefined): string {
  if (s === undefined) return "(줄 없음)";
  const t = s.trim();
  return t.length > 46 ? t.slice(0, 46) + "…" : t;
}

// 생성기는 글자를 돌려주고, 값 비교에는 파서가 필요합니다. 파서는 파일을
// 받으므로 임시 파일 한 장을 거칩니다.
export function parseText(text: string, name: string): Map<string, unknown> | null {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "genrepro-"));
  const file = path.join(dir, name);
  try {
    fs.writeFileSync(file, text, "utf8");
    return readExports(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
