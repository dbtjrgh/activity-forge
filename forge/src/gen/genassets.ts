// AssetTable 이 가리키는 파일이 리소스 폴더에 정말 있나.
//
// `index.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `index.ts` 에서 가져다 씁니다.

import type { AssetBase, AssetKind, Issue } from "./types";
import { listFiles } from "./files";
import { DEFAULT_BASE } from "./render";

// AssetTable 이 가리키는 파일이 **리소스 폴더에 정말 있나.**
//
// 이걸 안 보면 리소스가 한 장도 없는 폴더로도 액티비티가 만들어집니다 —
// 클론이 떠 온 원본 회차의 파일 이름이 그대로 적히고, 띄우면 전부 404 입니다
// (2026-09-02). 자동 검증이 나중에 잡기는 하지만 그때는 이미 만들어 커밋한
// 뒤입니다. **여기서 막습니다.**
//
// **폴더를 훑는 일은 `files.ts` 것을 그대로 씁니다.** 화면의 리소스 탭이
// 쓰는 것과 같은 걸음걸이여야 합니다 — 두 벌을 만들면 화면에는 보이는데
// 검사는 없다고 하는 일이 생깁니다. 하위 폴더도 거기서 이미 걸어 줍니다
// (`sounds/bgm/bgm.mp3`).
//
// **대소문자가 다른 것도 없는 것으로 봅니다.** 만드는 자리는 Windows 라 그냥
// 열리지만 서버는 리눅스라 안 열립니다 — 여기서 안 잡으면 배포한 뒤에 압니다.
//
// **폰트는 뺍니다.** `/sparklab/font` 로 액티비티 폴더 밖에 있어 회차마다
// 갈리지 않습니다.
export function checkAssetFiles(
  assets: Partial<Record<AssetKind, { alias: string; file: string; base?: AssetBase }[]>>,
  code: string,
): Issue[] {
  const out: Issue[] = [];
  const listing = listFiles(code);
  const here = new Set<string>();
  const lower = new Map<string, string>();
  for (const f of listing?.files ?? []) {
    const key = `${f.base}/${f.name}`;
    here.add(key);
    lower.set(key.toLowerCase(), key);
  }

  for (const kind of ["image", "sound", "lottie"] as AssetKind[]) {
    for (const a of assets[kind] ?? []) {
      const base = a.base ?? DEFAULT_BASE[kind];
      if (base === "font") continue;
      if (!a.file) {
        out.push({
          level: "error",
          rule: "asset-file-empty",
          path: `assets.${kind}.${a.alias}`,
          message: `${a.alias} — 파일 이름이 비어 있습니다.`,
        });
        continue;
      }
      const key = `${base}/${a.file}`;
      if (here.has(key)) continue;
      const near = lower.get(key.toLowerCase());
      out.push({
        level: "error",
        rule: near ? "asset-file-case" : "asset-file-missing",
        path: `assets.${kind}.${a.alias}`,
        message: near
          ? `${a.alias} — 대소문자가 다릅니다. 적힌 것 ${key} · 폴더에 있는 것 ${near}`
          : `${a.alias} — 리소스 폴더에 ${key} 이 없습니다.`,
        why: near
          ? "만드는 자리(Windows)에서는 열리지만 서버(리눅스)에서는 404 입니다."
          : `리소스를 ${listing?.dir ?? "리소스 폴더"} 아래에 넣은 뒤 다시 만드세요.`,
      });
    }
  }
  return out;
}
