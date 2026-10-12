// 리소스 폴더에 실제로 놓인 파일을 읽어 옵니다.
//
// 리소스는 figma 에서 뽑거나 공유 폴더에서 받아 옵니다. 그것을 폴더에 부어 놓고
// 화면에서는 「고르기」만 하자는 것입니다. 파일명을 손으로 옮겨 적으면
// 오타가 나고, 오타는 빌드를 통과해서 브라우저에서 404 로 조용히 사라집니다.
//
// 폴더 위치는 생성기와 같은 규칙입니다 — 지금 서 있는 폴더 밑의 sparkon_mNN.
// (참고 폴더 열기의 refRoot 와는 다릅니다. 그쪽은 「남의 호를 구경하는」 자리고
//  여기는 「내가 지금 만드는 것」이라 생성기와 어긋나면 안 됩니다.)

import fs from "fs";
import path from "path";
import { parseStudyCode } from "./spec";
import { workPath } from "./paths";
import { loadUser } from "./user";
import type { AssetBase, AssetKind } from "./types";

export type RscFile = { name: string; base: AssetBase; kind: AssetKind };
export type RscListing = { dir: string; exists: boolean; files: RscFile[] };

// 폴더 이름이 곧 종류입니다. AssetTable 이 그렇게 나뉘어 있습니다.
// **로티 폴더 이름이 두 가지입니다** — `animation` 359곳 · `animations` 648곳
// (2026-09-02). 생성기는 늘 `animations` 로 쓰므로 새로 만드는 것은 한 가지인데,
// 이미 있는 회차를 읽을 때는 둘 다 봐야 합니다. 안 그러면 로티가 멀쩡히 있는데
// 「리소스 폴더에 없습니다」가 뜹니다.
const DIR_KIND: { base: AssetBase; dir: string; kind: AssetKind }[] = [
  { base: "images", dir: "images", kind: "image" },
  { base: "sounds", dir: "sounds", kind: "sound" },
  { base: "animations", dir: "animations", kind: "lottie" },
  { base: "animations", dir: "animation", kind: "lottie" },
  { base: "font", dir: "font", kind: "font" },
];

// 폴더 바로 아래 있는 것은 확장자로 봅니다 (애니메이션의 video.mp4 같은 것).
//
// **mp4 는 그림입니다** (2026-09-23). 전에는 소리로 적혀 있었는데, 완성본 66개의
// mp4 126자리가 **전부 AssetTable 의 image 목록**에 있습니다(소리 목록 0 —
// 폴더 맨 위 80 · `images/` 46). 소리로 가르면 끌어다 놓은 영상이 `sounds/` 로
// 들어가고, 그림 자리인 `video` 의 후보에 아예 안 올라와 고를 수도 없었습니다
// (MAL1M07W3S1).
const EXT_KIND: Record<string, AssetKind> = {
  ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image", ".gif": "image", ".mp4": "image",
  ".mp3": "sound", ".wav": "sound", ".ogg": "sound",
  ".json": "lottie",
  ".ttf": "font", ".otf": "font", ".woff": "font", ".woff2": "font",
};

// 리소스를 놓는 자리는 **여기 하나로 정합니다.** 맞추기·요구 카드·파일 목록·
// 생성기가 다 이 함수를 부릅니다 — 한 곳이라 사람이 자리를 옮겨도 갈라지지 않습니다.
//
// **정해 두었으면 `<그 자리>/<학습코드>`, 아니면 여태처럼 호 저장소 안.**
// 호 저장소는 이미 만든 회차가 들어 있는 남의 자리라, 시험 삼아 넣고 빼는
// 일까지 거기서 하면 멀쩡한 것을 건드리게 됩니다 (`.user.json` 의 `rscRoot`).
/**
 * 리소스를 놓는 자리 — 비면 호 저장소 안이다. **폴더를 고치는 일(이름 바꾸기·크기 줄이기)은
 * 이것이 있을 때만 한다** — 호 저장소는 남의 자리라서. 셈은 여기 하나다.
 * `FORGE_RSC_ROOT` 는 **그 프로세스에만** 자리를 바꾼다 (2026-09-28) — 일괄 측정이 복사해 둔
 * 리소스를 보게. `.user.json` 을 고치면 사람이 켜 둔 앱까지 그 자리를 본다.
 */
export function rscRoot(): string {
  return (process.env["FORGE_RSC_ROOT"] ?? loadUser().rscRoot).trim();
}

export function rscDir(code: string): string | null {
  const study = parseStudyCode(code);
  if (!study) return null;
  const mine = rscRoot();
  if (mine) return path.join(mine, study.code);
  const repo = workPath("sparkon_m" + String(study.month).padStart(2, "0"));
  return path.join(repo, "public", "sparklab", study.code);
}

export function listFiles(code: string): RscListing | null {
  const dir = rscDir(code);
  if (!dir) return null;
  if (!fs.existsSync(dir)) return { dir, exists: false, files: [] };

  const files: RscFile[] = [];
  for (const d of DIR_KIND) {
    const sub = path.join(dir, d.dir);
    if (!fs.existsSync(sub)) continue;
    for (const name of walk(sub, "")) files.push({ name, base: d.base, kind: d.kind });
  }
  // 폴더 바로 아래. 하위 폴더는 위에서 이미 봤으니 파일만 봅니다.
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isFile()) continue;
    const kind = EXT_KIND[path.extname(e.name).toLowerCase()];
    if (kind) files.push({ name: e.name, base: "root", kind });
  }
  return { dir, exists: true, files };
}

/**
 * 폴더 안에서의 경로(`images/crayon.png`)가 **어느 갈래인가.**
 *
 * `swap` 의 `spare` 는 이 꼴로 옵니다 — 갈래가 안 붙어 있습니다. 부르는 쪽이
 * 폴더 이름을 다시 읽으면 위의 `DIR_KIND` 와 두 벌이 되고, `animation` 과
 * `animations` 처럼 **두 이름이 같은 갈래인 자리**에서 갈립니다.
 * 폴더 이름으로 못 가리면 확장자로 봅니다. 그것도 아니면 null 입니다.
 */
export function kindOfRel(rel: string): AssetKind | null {
  const at = rel.indexOf("/");
  if (at > 0) {
    const dir = rel.slice(0, at).toLowerCase();
    const one = DIR_KIND.find((d) => d.dir === dir);
    if (one) return one.kind;
  }
  return EXT_KIND[path.extname(rel).toLowerCase()] ?? null;
}

/**
 * 갈래를 받아 **새로 넣을 때의 폴더 이름**을 줍니다 (`image` → `images`).
 *
 * 위 표에서 먼저 잡히는 것입니다 — 로티는 `animation`·`animations` 두 이름이
 * 다 돌아다니지만, **새로 넣는 것은 생성기와 같이 `animations` 하나**로 씁니다.
 * 앱의 리소스 인박스가 끌어다 놓은 파일을 나눌 때 이 함수를 부릅니다.
 * 규칙을 그쪽에서 다시 적으면 두 벌이 되고, 갈리는 날 엉뚱한 폴더에 들어갑니다.
 */
export function dirForKind(kind: AssetKind): string | null {
  return DIR_KIND.find((d) => d.kind === kind)?.dir ?? null;
}

// images/tool/pattern1.png 처럼 한 겹 더 들어가는 것이 있습니다 (M30 의 도구 그림).
// AssetTable 이 `${RscImagePath}/tool/pattern1.png` 로 적으므로 경로째 이름입니다.
export function walk(root: string, rel: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const next = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(root, next));
    else out.push(next);
  }
  return out;
}

// 리소스를 부어 넣을 빈 폴더를 먼저 만들어 둡니다.
// 생성기도 같은 폴더를 만들지만, 순서가 반대입니다 — 리소스를 보고 값을 적으려면
// 액티비티를 만들기 「전에」 폴더가 있어야 합니다.
export function prepareDir(code: string): string | null {
  const dir = rscDir(code);
  if (!dir) return null;
  for (const sub of ["images", "sounds", "animations"]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  return dir;
}
