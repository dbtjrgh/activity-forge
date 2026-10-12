// AssetTable.ts 쓰기 — 갈래마다 기본 자리 · 선언 차례.
//
// `render.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `render.ts` 에서 가져다 씁니다.

import type { AssetBase, AssetKind, Recipe, Spec } from "./types";
import { effectiveAssets } from "./spec";

// ─── AssetTable.ts ───────────────────────────────────────────────────────

// kind 마다 파일이 놓이는 기본 자리. `base` 로 뒤집을 수 있습니다.
// 실제 폴더는 어느 호나 `animations` 입니다 —
// `_default/AssetTable.ts` 의 주석만 `animation` 이라 잘못 퍼져 있습니다.
export const DEFAULT_BASE: Record<AssetKind, AssetBase> = {
  image: "images",
  sound: "sounds",
  lottie: "animations",
  font: "font",
};

const BASE_VAR: Record<AssetBase, string> = {
  root: "RscPath",
  images: "RscImagePath",
  sounds: "RscSoundPath",
  animations: "RscAniPath",
  font: "FontPath",
};

const BASE_DECL: Record<AssetBase, string> = {
  root: "const RscPath=`/sparklab/${ActivityCode}`;",
  images: "const RscImagePath=`/sparklab/${ActivityCode}/images`;",
  sounds: "const RscSoundPath=`/sparklab/${ActivityCode}/sounds`;",
  animations: "const RscAniPath=`/sparklab/${ActivityCode}/animations`;",
  font: "const FontPath=`/sparklab/font`;",
};

const BASE_ORDER: AssetBase[] = [
  "root",
  "font",
  "images",
  "sounds",
  "animations",
];

export function renderAssetTable(
  code: string,
  recipe: Recipe,
  spec: Spec,
): string {
  const kinds: AssetKind[] = ["font", "image", "sound", "lottie"];
  const assets = effectiveAssets(spec, recipe);
  const out: string[] = [];

  // 실제로 쓰인 자리만 상수를 냅니다.
  // 안 쓰는 상수를 남기면 noUnusedLocals 에 걸립니다 —
  // `_default` 가 전부 주석 처리해 둔 것도 같은 이유입니다.
  const usedBases = new Set<AssetBase>();
  for (const kind of kinds) {
    for (const a of assets[kind] ?? [])
      usedBases.add(a.base ?? DEFAULT_BASE[kind]);
  }

  out.push(``);
  out.push(`const ActivityCode='${code}';`);
  out.push(``);
  for (const base of BASE_ORDER) {
    out.push(usedBases.has(base) ? BASE_DECL[base] : `// ${BASE_DECL[base]}`);
  }
  out.push(``);

  const provided = spec.assets.providedByModule;
  if (provided) {
    out.push(
      `// ${spec.module}.addAsset() 이 이미 넣어 주는 것 — 여기에 다시 넣지 마세요.`,
    );
    for (const kind of kinds) {
      const list = provided[kind];
      if (list?.length) out.push(`//   ${kind}: ${list.join(", ")}`);
    }
    out.push(``);
  }

  for (const kind of kinds) {
    const list = assets[kind] ?? [];
    out.push(`export const ${kind}=[`);
    for (const a of list) {
      const note = spec.assets.required?.find(
        (r) => r.alias === a.alias && r.fixedAlias,
      )
        ? ` // 이름 고정`
        : "";
      const v = BASE_VAR[a.base ?? DEFAULT_BASE[kind]];
      out.push(`  {alias:'${a.alias}',src:\`\${${v}}/${a.file}\`},${note}`);
    }
    out.push(`]`);
    out.push(``);
  }

  return out.join("\n");
}
