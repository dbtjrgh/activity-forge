// **새 폴더에 다른 이름으로 온 새 판** — 공용 가져오기가 옛 판을 들여오지 않게 (2026-09-29). 쓰는 곳은 `common.ts` 의
// `commonToCopy` 와 앱 `carryrsc.ts` — 한 판에 한 번 만들어 둘이 같은 셈(`pool`)을 나눠 쓴다.

import fs from "node:fs";
import path from "node:path";
import { fileOf, printOf } from "./common";
import { pngSize } from "./png";

/** 다른 이름으로 온 새 판 — `takes` 가 참이면 그 원본 그림은 안 가져온다. 안 가져온 자리는 `skipped` 에. */
export type Fresh = { takes: (from: string, rel: string) => boolean; skipped: string[] };

/**
 * **새 폴더에 다른 이름으로 온 새 판**을 센다 (2026-09-29).
 *
 * 9호 KOL1M08W1S3 — 스티커는 2·4·7호가 같은 그림이라 공용인데, 9호는 디자이너가 새로 그려
 * figma 이름(`Mask group-3.png`)으로 줬다. 「그 이름이 폴더에 없다」만 보고 7호 `r_sticker3.png` 를
 * 가져와서, 맞추기가 그 옛 판에 짝을 지었다 — 오류 없이 옛 그림이 나갔다.
 *
 * 그래서 **원본 이름이 아닌 png 가 같은 크기로 와 있으면** 그 크기 공용 그림은 하나씩 덜 가져온다.
 * 빈 자리는 크기로 맞추기(앱 `sizematch.ts`)가 짝짓거나 차례를 묻는다. **같은 크기만** 본다 —
 * 절반 · 두 배까지 보면 영상 썸네일 같은 새 그림이 공용 프레임을 막는다.
 * 원본 이름으로 복사해 둔 파일의 원래 이름(`rscname`)은 셈에서 뺀다 — 같은 바이트다.
 */
export function freshPictures(originCode: string, newDir: string): Fresh {
  const named = new Set(fileOf(originCode).values());
  const family = familyCounts(newDir, named);
  const all = walkPng(newDir);
  const namedPrints = new Set(all.filter((r) => named.has(r)).map((r) => printOf(path.join(newDir, r))));
  const pool = new Map<string, number>();
  for (const rel of all) {
    if (named.has(rel) || namedPrints.has(printOf(path.join(newDir, rel)))) continue;
    const s = pngSize(path.join(newDir, rel));
    if (s) pool.set(`${s.w}x${s.h}`, (pool.get(`${s.w}x${s.h}`) ?? 0) + 1);
  }
  const skipped: string[] = [];
  const takes = (from: string, rel: string): boolean => {
    // 한 자리를 두 곳(공용 · 돌려 쓴 파일)이 물어도 한 번만 센다 — 앞에서 막은 자리를 뒤에서 가져오면 안 된다
    if (skipped.includes(rel)) return true;
    // 같은 종류(이름 무리)가 다른 이름으로 원본만큼 다 와 있으면 옛 판을 안 가져온다 — 로티 · 소리까지(아래 `familyCounts`)
    const f = familyOf(rel);
    if ((family.fresh.get(f) ?? 0) >= (family.origin.get(f) ?? Infinity)) {
      skipped.push(rel);
      return true;
    }
    const s = /\.png$/i.test(from) ? pngSize(from) : null;
    const n = s ? (pool.get(`${s.w}x${s.h}`) ?? 0) : 0;
    if (!s || !n) return false;
    pool.set(`${s.w}x${s.h}`, n - 1);
    skipped.push(rel);
    return true;
  };
  return { takes, skipped };
}

/** 학습코드가 이름 앞에 붙은 꼴 — `kol1m04w2s2_` · `Ko_L1_M03_W2_S2_`. 호마다 바뀌는 앞머리라 무리를 셀 때 뗀다 */
const CODE_HEAD = /^(ko|en|ma)_?l\d_?m\d\d_?w\d_?s\d_?/i;

/**
 * 이름 무리 — 갈래 폴더 · 학습코드 앞머리를 떼고 숫자를 `#` 로. `animations/kol1m08w2s2_robot_correct1.json` 과
 * `animations/Ko_L1_M03_W2_S2_robot_correct1.json` 은 같은 무리(`animations/robot_correct#.json`)다.
 */
export function familyOf(rel: string): string {
  const dir = path.posix.dirname(rel.replace(/\\/g, "/"));
  const name = path.posix.basename(rel.replace(/\\/g, "/")).toLowerCase().replace(CODE_HEAD, "").replace(/\d+/g, "#");
  return `${dir}/${name}`;
}

/**
 * **이름 무리마다 원본이 쓰는 수와, 새 폴더에 다른 이름으로 온 수** (2026-10-01).
 *
 * 9호 KOL1M08W2S2 — 디자이너가 로봇 애니메이션 25개를 `kol1m08w2s2_robot_*` 로 새로 줬는데, 원본이 6호(방학호)였을 때
 * 앱이 3호 `Ko_L1_M03_W2_S2_robot_*` 25개와 3호 내레이션 5개를 「돌려 쓴 파일」로 가져왔다(6호가 3호 것을 바이트까지 그대로 썼다).
 * 크기는 png 만 있어 위 셈이 로티 · 소리를 못 봤다. 무리 수가 원본만큼 와 있으면 그 무리는 새 판이 다 온 것이다.
 * 원본 이름 그대로인 파일은 새 판이 아니라 뺀다. 앞서 옛 원본에서 가져와 남은 파일은 앱이 원본이 바뀔 때 치운다(앱 `carrylog.ts`).
 */
function familyCounts(newDir: string, named: Set<string>): { origin: Map<string, number>; fresh: Map<string, number> } {
  const origin = new Map<string, number>();
  for (const rel of named) origin.set(familyOf(rel), (origin.get(familyOf(rel)) ?? 0) + 1);
  const fresh = new Map<string, number>();
  for (const rel of walkFiles(newDir)) {
    if (named.has(rel)) continue;
    const f = familyOf(rel);
    if (origin.has(f)) fresh.set(f, (fresh.get(f) ?? 0) + 1);
  }
  return { origin, fresh };
}

/** 폴더 안 파일 전부 — `walkPng` 와 같은 꼴, 확장자만 안 가린다 */
function walkFiles(dir: string, sub = ""): string[] {
  let names: fs.Dirent[] = [];
  try {
    names = fs.readdirSync(path.join(dir, sub), { withFileTypes: true });
  } catch {
    return [];
  }
  return names.flatMap((d) => {
    const rel = sub ? `${sub}/${d.name}` : d.name;
    if (d.isDirectory()) return d.name.startsWith("_") ? [] : walkFiles(dir, rel);
    return [rel];
  });
}

/** 폴더 안 png 전부 — `images/x.png` 꼴. `_` 로 시작하는 폴더(`_원본` · `_figma`)는 안 본다. */
export function walkPng(dir: string, sub = ""): string[] {
  let names: fs.Dirent[] = [];
  try {
    names = fs.readdirSync(path.join(dir, sub), { withFileTypes: true });
  } catch {
    return [];
  }
  return names.flatMap((d) => {
    const rel = sub ? `${sub}/${d.name}` : d.name;
    if (d.isDirectory()) return d.name.startsWith("_") ? [] : walkPng(dir, rel);
    return /\.png$/i.test(d.name) ? [rel] : [];
  });
}

