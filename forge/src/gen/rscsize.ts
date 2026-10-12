// **그림 크기가 정해진 자리** — 스펙 `assets.required[].size` (2026-09-23).
//
// 영상 모듈(VideoPlayActivity)은 재생할 때 플레이어를 `1080 ÷ 플레이어 높이` 로 키우는데,
// 그 높이가 **썸네일 그림의 높이**다. 완성본 썸네일은 1280×720(MA 12곳 · EN 24곳)이라
// 1.5배로 커진다. MAL1M07W3S1 에 1921×1081 이 와서 1배 — **영상이 확대되지 않았다.**
// 에러도 없고 화면도 멀쩡해서 띄워 봐야만 안다. 그래서 스펙에 크기를 적고 여기서 잰다.
//
// PNG 만 잰다(머리 24바이트 — 바깥 의존 없이). 다른 꼴은 모른다고 두고 막지 않는다.

import fs from "node:fs";
import path from "node:path";
import { rscDir } from "./files";
import { DEFAULT_BASE } from "./render";
import type { AssetKind, Issue, RecipeAsset, Spec } from "./types";

/** 허용 오차(px). 완성본에 1280×721 · 1281×720 이 있다. */
export const SIZE_SLACK = 2;

const SUB: Record<string, string> = { root: "", images: "images", sounds: "sounds", animations: "animations" };

/** PNG 의 가로·세로. PNG 가 아니거나 못 읽으면 null. */
export function imageSize(file: string): { w: number; h: number } | null {
  try {
    const fd = fs.openSync(file, "r");
    const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0);
    fs.closeSync(fd);
    if (b.readUInt32BE(0) !== 0x89504e47 || b.toString("ascii", 12, 16) !== "IHDR") return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } catch {
    return null;
  }
}

export const fits = (got: { w: number; h: number }, want: { w: number; h: number }): boolean =>
  Math.abs(got.w - want.w) <= SIZE_SLACK && Math.abs(got.h - want.h) <= SIZE_SLACK;

/** 크기가 정해진 자리 하나 — 폴더 안 경로와 지금 크기. */
export type SizedSlot = { alias: string; rel: string; file: string; want: { w: number; h: number; why?: string }; got: { w: number; h: number } | null };

/** 스펙이 크기를 정한 자리들을 레시피에서 찾아 지금 크기를 잰다. */
export function sizedSlots(spec: Spec, assets: Partial<Record<AssetKind, RecipeAsset[]>>, code: string): SizedSlot[] {
  const dir = rscDir(code);
  if (!dir) return [];
  const out: SizedSlot[] = [];
  for (const r of spec.assets?.required ?? []) {
    if (!r.size) continue;
    const a = (assets[r.kind] ?? []).find((x) => x.alias === r.alias);
    if (!a?.file) continue;
    const sub = SUB[a.base ?? DEFAULT_BASE[r.kind]] ?? "";
    const rel = sub ? `${sub}/${a.file}` : a.file;
    const file = path.join(dir, ...rel.split("/"));
    if (!fs.existsSync(file)) continue; // 없는 것은 파일 검사가 따로 잡는다
    out.push({ alias: r.alias, rel, file, want: r.size, got: imageSize(file) });
  }
  return out;
}

/** 크기가 어긋난 자리를 에러로. */
export function checkAssetSizes(spec: Spec, assets: Partial<Record<AssetKind, RecipeAsset[]>>, code: string): Issue[] {
  return sizedSlots(spec, assets, code)
    .filter((s) => s.got && !fits(s.got, s.want))
    .map((s) => ({
      level: "error" as const,
      rule: "asset-size",
      path: `assets.image.${s.alias}`,
      message: `${s.rel} 가 ${s.got?.w}×${s.got?.h} 입니다 — ${s.want.w}×${s.want.h} 이어야 합니다.`,
      ...(s.want.why ? { why: s.want.why } : {}),
    }));
}
