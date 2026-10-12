// codegen 뼈대 — 표본 Activity.ts 에서 베껴 온다.
//
// `draft.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `draft.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import type { Spec } from "./types";
import { HOOK_KEYS } from "./types";
import { type Sample } from "./survey";
import { PROVIDED_SYMBOLS } from "./render";
import { symbolsUsed, classMembers, symbolsInMembers, dropAssetLoops, hookBody } from "./draftsymbols";

// ─── codegen 뼈대 ────────────────────────────────────────────────────────

// 표본 하나의 Activity.ts 에서 뼈대를 베껴 옵니다.
// 어차피 이 모듈을 쓰는 액티비티는 이 부분이 거의 같습니다 — 다른 것은 GameData 뿐입니다.
export function codegenOf(samples: Sample[]): Spec["codegen"] {
  const first = samples[0];
  const out: Spec["codegen"] = {
    hooks: {},
    gameDataExport: first?.root ?? "quizData",
  };
  if (!first) return out;

  let text: string;
  try {
    text = fs.readFileSync(path.join(first.dir, "Activity.ts"), "utf8");
  } catch {
    return out;
  }

  const ext = /class\s+Activity\s+extends\s+([A-Za-z0-9_]+)/.exec(text);

  // **주석 줄은 빼고 봅니다.** ENL2M02W3S3 에 `// import { E39 } from "./E39/E39";`
  // 가 살아 있는 진짜 import 아래에 있어서, 나중 것이 앞의 것을 덮어썼습니다.
  // 그 스펙 하나가 모듈을 액티비티 폴더에서 들여오게 돼 있었습니다 (2026-09-02).
  const code = text
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

  // 표본이 들여오는 것 전부 — 어디서 왔는지까지. pixi.js 도 담습니다.
  const source = new Map<string, string>();
  for (const m of code.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g,
  )) {
    const from = m[2] ?? "";
    for (const raw of (m[1] ?? "").split(",")) {
      const symbol = (raw.split(" as ")[0] ?? "")
        .replace(/^type\s+/, "")
        .trim();
      if (symbol) source.set(symbol, from);
    }
  }
  // `import * as AssetTable from "./AssetTable"` 꼴도 담습니다.
  // M18·M23 처럼 모듈이 AssetTable 을 통째로 받는 자리가 있습니다.
  const nsNames = new Set<string>();
  for (const m of code.matchAll(
    /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
  )) {
    const symbol = m[1] ?? "";
    if (!symbol) continue;
    nsNames.add(symbol);
    source.set(symbol, m[2] ?? "");
  }

  if (ext?.[1] && source.has(ext[1])) {
    out.extends = { symbol: ext[1], from: source.get(ext[1]) as string };
  }

  // 훅 안에 적힌 줄을 옮깁니다. 표본 하나에서 베낀 것이니 눈으로 보세요.
  //
  // **리소스 등록 반복문은 뺍니다.** `renderActivity` 의 onLoad 가 같은 일을
  // 이미 합니다. 그대로 베끼면 자원을 두 번 등록하고, 표본이 쓰는
  // `AssetTable.font` 는 생성기가 안 들여오는 이름이라 컴파일도 안 됩니다.
  for (const hook of HOOK_KEYS) {
    const lines =
      hook === "onLoad"
        ? dropAssetLoops(hookBody(text, hook))
        : hookBody(text, hook);
    if (lines.length) out.hooks[hook] = lines;
  }

  // **들여올 것은 「모듈」과 「훅이 실제로 쓰는 것」뿐입니다.**
  //
  // 표본의 import 를 통째로 베끼면 생성기가 이미 써 주는 `AssetManager` 까지
  // 딸려 와 **두 번 나갑니다** — 그런 스펙이 115장 중 88장이었습니다. 거꾸로,
  // 훅이 쓰는 `Sprite`(pixi.js)는 예전 규칙(`_common` 만 담기)에 걸려 빠져
  // 컴파일이 안 됐습니다. 둘 다 여기서 갈립니다 (2026-09-02).
  // 클래스가 들고 있어야 하는 것. 훅이 `this.mM05` 를 부르는데 그 선언이
  // 없으면 뽑은 액티비티가 컴파일이 안 됩니다 (`codegen.members` 주석 참고).
  const mem = classMembers(code);
  if (mem.length) out.members = mem;

  const used = symbolsUsed(Object.values(out.hooks).flat());
  // 멤버가 쓰는 타입 이름도 들여와야 합니다 — `private mM05: M05` 의 `M05`.
  for (const s of symbolsInMembers(mem)) used.add(s);
  const imports: { symbol: string; from: string }[] = [];
  for (const [symbol, from] of source) {
    if (symbol === out.extends?.symbol) continue;
    if (symbol === out.gameDataExport) continue;
    if (PROVIDED_SYMBOLS.includes(symbol)) continue;
    if (!from.includes("_common/module") && !used.has(symbol)) continue;
    imports.push({
      symbol,
      from,
      ...(nsNames.has(symbol) ? { ns: true } : {}),
    });
  }
  const only = imports[0];
  if (imports.length === 1 && only) out.import = only;
  else if (imports.length > 1) out.imports = imports;

  return out;
}
