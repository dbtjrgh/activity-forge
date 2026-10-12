// 재현 검사 — Activity.ts 견주기 · 훅 줄 · 별칭.
//
// `checkRepro.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `checkRepro.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import { HOOK_KEYS } from "@/gen/types";
import { normText, isPlainObject } from "./reprovalue";
import { stripComments, normQuote, splitImports, mattersToModule, firstDiffLine, cut, parseText } from "./reprotext";
import { type Verdict } from "./reproone";

export function cmpActivity(dir: string, genText: string | undefined): Verdict {
  const name = "Activity.ts";
  if (genText === undefined)
    return { file: name, level: "fail", why: "뽑히지 않았습니다" };
  let real: string;
  try {
    real = fs.readFileSync(path.join(dir, name), "utf8");
  } catch {
    return { file: name, level: "ok" };
  }
  const a = splitImports(normQuote(stripComments(normText(real))));
  const b = splitImports(normQuote(stripComments(normText(genText))));

  const missing = a.imports.filter(
    (i) => !b.imports.includes(i) && !isOursToShape(i),
  );
  const real_ = missing.filter(mattersToModule);
  if (real_.length > 0) {
    return {
      file: name,
      level: "fail",
      why: `안 들여왔습니다 — ${cut(real_[0])}`,
    };
  }
  if (missing.length > 0) {
    return {
      file: name,
      level: "note",
      why: `원본만 들여온 것 — ${cut(missing[0])}`,
    };
  }
  // **훅이 통째로 빠진 것은 알림이 아니라 틀림입니다.**
  //
  // 몸통이 다른 것은 대개 「덜 담았다」이지만, **메서드가 아예 없는 것**은
  // 그 훅에 걸린 동작이 통째로 사라진다는 뜻입니다. 컴파일은 되고 조용히
  // 안 돌기만 합니다 — M28 이 `onStart` 의 `SparkApp.eop.show()` 를 흘려
  // **엔딩이 안 뜬** 것이 이 갈래입니다.
  //
  // 그리고 이 검사는 그때 이미 그 줄을 보고 있었는데 **「알림」으로 낮춰**
  // 놓아서 사람이 지나쳤습니다. 뒤에 재 보니 같은 구멍이 **스펙 53장**에
  // 있었습니다 — onAffordanceOn 35 · onAffordanceCanceled 32 · onUpdate 23 ·
  // onResize 14 (2026-09-02). 그래서 이 한 갈래만 끌어올립니다.
  // **빈 훅은 세지 않습니다.** `onResize(): void {}` 처럼 속이 빈 것은
  // `ActivityBase` 가 이미 빈 채로 두었으니 안 내도 동작이 같습니다 —
  // 인터북(`MA/MIB`) 표본 넷이 그 꼴입니다.
  const gone = HOOK_KEYS.filter(
    (h) =>
      (hookLines(a.body, h) ?? "").trim() !== "" &&
      hookLines(b.body, h) === null,
  );
  if (gone.length > 0) {
    return {
      file: name,
      level: "fail",
      why: `훅이 통째로 빠졌습니다 — ${gone.join("·")} (원본에는 있고 뽑은 것에는 없습니다)`,
    };
  }

  if (a.body !== b.body) {
    // **이것은 결함이 아니라 덜 된 것입니다.** 생성기가 내놓는 것은 뼈대고,
    // 원본에는 사람이 쓴 로직이 들어 있습니다. 스펙의 `codegen.hooks` 에
    // 그 줄들을 옮겨 적은 만큼만 같아집니다 — **그래서 이 숫자는 결함 수가
    // 아니라 「스펙이 Activity 를 얼마나 담았나」입니다.**
    return { file: name, level: "note", why: firstDiffLine(a.body, b.body) };
  }
  return { file: name, level: "ok" };
}

// 그 훅을 **선언했으면 속을**, 안 했으면 `null`.
//
// 부르는 것(`M27.handle.onResize()`)과 갈라야 하므로 앞에 `.` 이 붙은 것은
// 안 봅니다. 반환형(`onResize(): void {`)도 넘깁니다 — 원본 517개가 그 꼴이고
// `onResize() {` 은 8개뿐입니다.
function hookLines(body: string, hook: string): string | null {
  const head = new RegExp(
    `(?:^|[^.\\w$])(?:async\\s+)?${hook}\\s*\\([^)]*\\)\\s*(?::[^{]*)?\\{`,
  ).exec(body);
  if (!head) return null;
  const from = head.index + head[0].length;
  let depth = 1;
  for (let i = from; i < body.length; i += 1) {
    if (body[i] === "{") depth += 1;
    else if (body[i] === "}") {
      depth -= 1;
      if (depth === 0) return body.slice(from, i);
    }
  }
  return body.slice(from);
}

// 생성기가 **제 나름의 꼴로 적는** import. 원본이 어떻게 적었든 견주지 않습니다.
//
// `import * as AssetTable from "./AssetTable"` 로 적은 액티비티가 있는데,
// 생성기는 늘 `import { font, image, lottie, sound } from "./AssetTable"` 로
// 적습니다. **둘은 같은 것을 들여옵니다** — 쓰는 꼴만 다릅니다.
function isOursToShape(line: string): boolean {
  return /from\s+"\.\/(AssetTable|GameData)(\.ts)?"/.test(line);
}

// 복사만 하는 파일. 따옴표만 맞추고 글자 그대로 견줍니다.
export function cmpText(
  dir: string,
  gen: Record<string, string>,
  name: string,
): Verdict {
  const genText = gen[name];
  if (genText === undefined)
    return { file: name, level: "fail", why: "뽑히지 않았습니다" };
  let real: string;
  try {
    real = fs.readFileSync(path.join(dir, name), "utf8");
  } catch {
    // 원본에 없는 파일은 견줄 것이 없습니다.
    return { file: name, level: "ok" };
  }
  const a = normQuote(normText(real));
  const b = normQuote(normText(genText));
  return a === b
    ? { file: name, level: "ok" }
    : { file: name, level: "note", why: firstDiffLine(a, b) };
}

export function firstExport(ex: Map<string, unknown> | null): unknown {
  if (!ex) return undefined;
  for (const [, v] of ex) return v;
  return undefined;
}

export function aliasesOfText(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const ex = parseText(text, "AssetTable.ts");
  if (!ex) return out;
  for (const kind of ["image", "sound", "lottie", "font"]) {
    const list = ex.get(kind);
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (isPlainObject(item) && typeof item["alias"] === "string") {
        out.set(item["alias"] as string, kind);
      }
    }
  }
  return out;
}
