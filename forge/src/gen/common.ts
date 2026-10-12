// **공용 리소스 파일** — 같은 모듈의 완성본 전부가 그 자리에 **바이트까지 같은 파일**을
// 쓰는 것 (2026-09-23).
//
// 원본 값을 떠 오면서 이 파일들은 안 가져와서, 영상 하나만 새로 오는 MAL1M07W3S1 에
// 재생·정지·닫기 단추 · 프레임 · 효과음 아홉 자리가 「폴더에 넣어 주세요」로 나왔다.
// 사람은 앞 회차 폴더에서 복붙해 왔다 — 도구가 할 일이다.
//
// **짐작하지 않는다.** 「파일 이름이 같다」나 「여러 호에 나온다」로는 틀린다 — 다섯 호에
// 나오는 파일로 쟀더니 2,012 가운데 71이 틀렸다(회차마다 bgm 이 갈리는 모듈 · 한 호
// 안에서만 같은 bg). 그래서 **모듈 · 자리** 단위로, 그 모듈을 쓰는 완성본이 **하나도
// 빠짐없이** 같은 파일을 쓸 때만 공용이다. 잰 값은 `tool/commonrsc.ts` 머리말에.
//
// 완성본의 리소스는 호 저장소 `public/sparklab/<학습코드>` 에 있다 — `rscRoot` 를 보는
// `files.ts` 의 `rscDir()` 은 **만들 회차**의 자리라 여기서는 안 쓴다.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cloneFrom } from "./clone";
import { workPath } from "./paths";
import type { Fresh } from "./commonfresh";
import { findUsers } from "./survey";
import type { AssetKind, RecipeAsset } from "./types";

/** 공용으로 치려면 같은 파일을 쓰는 완성본이 적어도 이만큼. 둘이 같은 것은 우연일 수 있다. */
export const COMMON_MIN = 3;

const BASE_DIR: Record<string, string | null> = {
  root: "",
  images: "images",
  sounds: "sounds",
  animations: "animations",
  animation: "animation",
  font: null,
};
const DEFAULT_BASE: Record<AssetKind, string> = { image: "images", sound: "sounds", lottie: "animations", font: "font" };

/** 완성본의 리소스 폴더 (호 저장소 안). */
export const rscOfDone = (code: string): string =>
  path.join(workPath(`sparkon_m${code.slice(5, 7)}`), "public", "sparklab", code);

/**
 * 완성본 폴더 안 파일의 실제 경로. 레시피는 로티를 늘 `animations/` 로 적는데(`cloneassets.ts` 가 두 폴더 이름을
 * 하나로 읽는다) 완성본 359곳은 `animation/` 폴더다(`files.ts`). 그대로 붙이면 파일이 없다고 나와
 * 로티가 공용 · 돌려 쓰는 파일에서 통째로 빠졌다(2026-10-06, KOL2M08W2S2 로티 9개를 사람이 받으러 갔다).
 */
export function doneFile(dir: string, rel: string): string {
  const at = path.join(dir, rel);
  if (!rel.startsWith("animations/") || fs.existsSync(at)) return at;
  const alt = path.join(dir, `animation${rel.slice("animations".length)}`);
  return fs.existsSync(alt) ? alt : at;
}

/** 파일 내용의 지문. 큰 것은 크기 + 앞뒤 1MB — 영상이 수백 MB 다. 없으면 null. */
const prints = new Map<string, string | null>();
export function printOf(file: string): string | null {
  if (prints.has(file)) return prints.get(file) ?? null;
  let out: string | null = null;
  try {
    const st = fs.statSync(file);
    if (st.isFile()) {
      const h = crypto.createHash("sha1").update(String(st.size));
      const fd = fs.openSync(file, "r");
      const n = Math.min(st.size, 1 << 20);
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, 0);
      h.update(buf);
      if (st.size > n) {
        fs.readSync(fd, buf, 0, n, st.size - n);
        h.update(buf);
      }
      fs.closeSync(fd);
      out = h.digest("hex");
    }
  } catch {
    out = null;
  }
  prints.set(file, out);
  return out;
}

/** 레시피 자리(`갈래|별칭`) → 리소스 폴더 안 경로(`images/x.png`). 폰트는 뺀다. */
export function relOf(recipe: { assets?: Partial<Record<AssetKind, RecipeAsset[]>> }): Map<string, string> {
  const out = new Map<string, string>();
  for (const kind of ["image", "sound", "lottie"] as AssetKind[]) {
    for (const a of recipe.assets?.[kind] ?? []) {
      const sub = BASE_DIR[a.base ?? DEFAULT_BASE[kind]];
      if (sub === null || sub === undefined) continue;
      out.set(`${kind}|${a.alias}`, sub === "" ? a.file : `${sub}/${a.file}`);
    }
  }
  return out;
}

/** 완성본 하나의 자리 → 경로. 못 읽으면 빈 표. */
const files = new Map<string, Map<string, string>>();
export function fileOf(code: string): Map<string, string> {
  const hit = files.get(code);
  if (hit) return hit;
  let out = new Map<string, string>();
  try {
    out = relOf(cloneFrom(code, code).recipe);
  } catch {
    // 읽히지 않는 완성본은 공용을 가리는 표본에서 빠진다
  }
  files.set(code, out);
  return out;
}

export type CommonFile = { print: string; rel: string; from: string; users: number };

/** 가져올 것 하나 — 원본 폴더의 파일 → 새 폴더 안 자리. */
export type CommonCopy = { from: string; to: string; bytes: number; slot: string };

/**
 * 원본의 공용 자리 가운데 **새 폴더에 아직 없는 것**을 가져올 목록.
 *
 * **폴더에 이미 있으면 안 가져온다** — 같은 이름으로 새 파일이 왔으면 그것이 이 회차
 * 것이다(호가 바뀌며 새로 그린 `bg.png`). 덮어쓰지 않는다. 가져오는 것은 원본 폴더의
 * 그 파일이 공용 파일과 **바이트까지 같을 때만**이다.
 */
export function commonToCopy(
  originCode: string,
  newCode: string,
  newDir: string,
  module: string,
  fresh?: Fresh,
): CommonCopy[] {
  const common = commonFiles(newCode.slice(0, 2), module, [newCode]);
  if (!common.size) return [];
  const out: CommonCopy[] = [];
  for (const [slot, rel] of fileOf(originCode)) {
    const c = common.get(slot);
    if (!c) continue;
    const from = doneFile(rscOfDone(originCode), rel);
    if (printOf(from) !== c.print) continue;
    if (fs.existsSync(path.join(newDir, rel))) continue;
    if (fresh?.takes(from, rel)) continue; // 다른 이름으로 새 판이 와 있다 (`commonfresh.ts`)
    out.push({ from, to: rel, bytes: fs.statSync(from).size, slot });
  }
  return out;
}

/**
 * 그 모듈의 공용 자리들 — `갈래|별칭` → 파일. **`except`(만드는 회차)는 표본에서 뺀다** —
 * 완성본을 다시 만들어 보는 시험에서 그 회차 답지가 끼면 가름이 답을 훔쳐 본다.
 */
export function commonFiles(subject: string, module: string, except: string[] = []): Map<string, CommonFile> {
  const skip = new Set(except);
  const seen = new Map<string, { prints: Set<string>; rel: string; from: string; users: number }>();
  for (const s of findUsers(subject, module)) {
    if (skip.has(s.code) || !fs.existsSync(rscOfDone(s.code))) continue;
    for (const [slot, rel] of fileOf(s.code)) {
      const p = printOf(doneFile(rscOfDone(s.code), rel));
      if (!p) continue; // 파일이 없는 자리는 표에서 뺀다 — 없는 것으로 공용을 깰 수는 없다
      const at = seen.get(slot) ?? { prints: new Set<string>(), rel, from: s.code, users: 0 };
      at.prints.add(p);
      at.users += 1;
      seen.set(slot, at);
    }
  }
  const out = new Map<string, CommonFile>();
  for (const [slot, at] of seen) {
    if (at.prints.size !== 1 || at.users < COMMON_MIN) continue;
    out.set(slot, { print: [...at.prints][0] as string, rel: at.rel, from: at.from, users: at.users });
  }
  return out;
}
