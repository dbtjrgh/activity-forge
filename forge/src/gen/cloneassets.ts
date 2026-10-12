// AssetTable.ts 읽기 — 별칭 · 파일 이름 · 놓이는 곳.
//
// `clone.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `clone.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import { readExports } from "./survey";
import type { AssetKind, AssetBase, RecipeAsset } from "./types";

export const KINDS: AssetKind[] = ["font", "image", "sound", "lottie"];

// AssetTable 이 쓰는 상수 이름 → 파일이 놓이는 곳.
// `renderassets.ts` 의 BASE_VAR 를 거꾸로 읽은 것입니다.
const BASE_OF_VAR: Record<string, AssetBase> = {
  RscPath: "root",
  RscImagePath: "images",
  RscSoundPath: "sounds",
  RscAniPath: "animations",
  FontPath: "font",
};

// AssetTable.ts → 별칭·파일 이름·놓이는 곳.
//
// 원본은 `{alias:'GreenBG', src:`${RscImagePath}/GreenBG.jpg`}` 꼴이라 `src` 가
// 값이 아니라 **식**으로 읽힙니다. 상수 이름에서 놓이는 곳을, 마지막 조각에서
// 파일 이름을 꺼냅니다.
export function readAssets(dir: string): {
  assets: Partial<Record<AssetKind, RecipeAsset[]>>;
  notes: string[];
} {
  const assets: Partial<Record<AssetKind, RecipeAsset[]>> = {};
  const notes: string[] = [];
  const table = path.join(dir, "AssetTable.ts");
  const ex = readExports(table);
  if (!ex) return { assets, notes: ["AssetTable.ts 를 못 읽었습니다."] };
  const vars = pathVars(fs.readFileSync(table, "utf8"));

  for (const kind of KINDS) {
    const list = ex.get(kind);
    if (!Array.isArray(list)) continue;
    const out: RecipeAsset[] = [];
    for (const item of list) {
      if (typeof item !== "object" || item === null) continue;
      const alias = (item as Record<string, unknown>)["alias"];
      if (typeof alias !== "string") continue;
      const src = srcText((item as Record<string, unknown>)["src"]);
      if (src === null) {
        notes.push(`${kind} 의 ${alias} — src 를 못 읽어 파일 이름을 비워 둡니다.`);
        out.push({ alias, file: "" });
        continue;
      }
      const v = varOf(src);
      const known = v ? vars.root.get(v) : undefined;
      const tail = fileOf(src, vars.frag);
      const base = known?.base ?? BASE_OF_VAR[v ?? ""];
      const file = known?.prefix ? `${known.prefix}/${tail}` : tail;
      out.push({ alias, file, ...(base ? { base } : {}) });
    }
    if (out.length) assets[kind] = out;
  }
  return { assets, notes };
}

// 값이면 그대로, 식이면 식의 글자를. 둘 다 아니면 null.
//
// 식은 ``${RscImagePath}/bg.png`` 처럼 감싸는 따옴표까지 들고 옵니다.
// 벗기지 않으면 파일 이름이 `bg.png`` 가 됩니다.
function srcText(v: unknown): string | null {
  const raw = plain(v);
  return raw === null ? null : raw.replace(/^["'`]/, "").replace(/["'`]$/, "");
}

function plain(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) {
    const e = (v as { __expr?: unknown }).__expr;
    if (typeof e === "string") return e;
  }
  return null;
}

// AssetTable 이 쓰는 경로 상수를 **파일에서 직접 읽습니다.**
//
// 전에는 이름 다섯 개를 표(BASE_OF_VAR)로 박아 뒀는데, 회차마다 제 나름의
// 상수를 더 만들어 씁니다 — `RscImagePath1 = …/images/inning1` ·
// `RscSoundNarrationPath = …/sounds/narration`. 표에 없으면 조용히 `images` 로
// 떨어져서 **하위 폴더가 통째로 사라진 이름**이 나왔습니다 (2026-09-02).
//
// 상수 값이 곧 답입니다. `/sparklab/${ActivityCode}/images/inning1` 이면
// 놓이는 곳은 `images`, 앞에 붙일 것은 `inning1` 입니다.
const DIR_BASE: Record<string, AssetBase | undefined> = {
  images: "images",
  sounds: "sounds",
  animations: "animations",
  // 로티 폴더 이름이 두 가지입니다. `files.ts` 도 둘 다 봅니다.
  animation: "animations",
  font: "font",
};

// 경로 상수는 두 갈래입니다.
//
//   뿌리   `/sparklab/${ActivityCode}/images`        놓이는 곳을 정합니다
//   조각   `/ining1` · `/nar`                        뿌리 뒤에 이어 붙입니다
//
// 조각을 쓰는 회차가 있습니다 — ``${RscImagePath}${RscIning1Path}/car.png``.
// 안 풀면 파일 이름에 `${RscIning1Path}` 가 글자 그대로 남습니다.
type PathVars = {
  root: Map<string, { base: AssetBase; prefix: string }>;
  frag: Map<string, string>;
};

function pathVars(text: string): PathVars {
  const out = new Map<string, { base: AssetBase; prefix: string }>();
  const frag = new Map<string, string>();
  const re = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*[`'"]([^`'"]*)[`'"]/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const name = m[1] as string;
    const value = (m[2] as string).trim().replace(/\/+$/, "");
    if (value === "/sparklab/font") {
      out.set(name, { base: "font", prefix: "" });
      continue;
    }
    const hit = /^\/sparklab\/\$\{ActivityCode\}\/?(.*)$/.exec(value);
    if (!hit) {
      // 뿌리가 아닌 것은 조각으로 둡니다. 빈 것과 남의 값은 거릅니다.
      if (value && !value.includes("${")) frag.set(name, value);
      continue;
    }
    const rest = hit[1] as string;
    const parts = rest.split("/").filter(Boolean);
    const base = DIR_BASE[parts[0] ?? ""];
    out.set(name, base ? { base, prefix: parts.slice(1).join("/") } : { base: "root", prefix: rest });
  }
  return { root: out, frag };
}

// 상수 뒤에 오는 것 전부. **하위 폴더까지 이름입니다.**
//
// `${RscSoundPath}/bgm/bgm.mp3` 에서 마지막 조각만 떼면 `bgm/` 이 사라져,
// 다시 뽑을 때 **없는 데를 가리킵니다** — 에러 없이 소리만 안 납니다
// (2026-09-02). `files.ts` 도 `images/tool/pattern1.png` 을 경로째 이름으로
// 다루고 있었는데, 여기만 어긋나 있었습니다.
function fileOf(src: string, frag: Map<string, string>): string {
  const cut = /^\$\{\s*[A-Za-z_$][\w$]*\s*\}/.exec(src);
  let rest = cut ? src.slice(cut[0].length) : (src.split("/").pop() ?? "");
  // 남은 조각을 값으로 바꿉니다. 모르는 것은 그대로 둬서 **검사에 걸리게** 합니다.
  rest = rest.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (all, n) => frag.get(n) ?? all);
  return rest.replace(/\/{2,}/g, "/").replace(/^\//, "");
}

// `` `${RscImagePath}/GreenBG.jpg` `` 에서 RscImagePath 를 꺼냅니다.
function varOf(src: string): string | null {
  return /\$\{\s*([A-Za-z_$][\w$]*)\s*\}/.exec(src)?.[1] ?? null;
}
