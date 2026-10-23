/**
 * **같은 배경 그림의 짝과 다른 자리** (2026-10-13, 대화로 만들기 · 인터북).
 *
 * 인터북(MIB) figma 는 누를 자리에 **별(어포던스 표시)** 을 그려 두고, 누른 뒤에는 **노란 테두리 · 양옆 파티클(효과)** 을 그린 판을 둔다.
 * 9호 MAL2M08W1S1 은 별이 그려진 판만으로 만들어 별이 처음부터 떠 있었다 — 모듈이 어포던스 로티를 따로 그리므로
 * 누르는 장면에는 **표시 없는 판**을 써야 한다. 6호 MAL2M06W1S1 은 누른 뒤 효과 판으로 자동 장면을 하나 두고(img03 · img05 · img07)
 * 효과 없는 판으로 다음 누르는 장면을 이었다. 호마다 인터북이 다섯 개쯤이라, 사람이 판을 가려 주지 않아도 되게 픽셀로 짝을 찾는다(사용자 요청).
 *
 * 하는 일 — 1920×1080 그림을 1/4 로 줄여 둘씩 견준다.
 * ① 픽셀까지 같은 그림을 짚는다(9호 `6-2.png` · `6-2 (1).png`)
 * ② 그림마다 **바뀐 칸이 가장 적은 짝**(화면의 15% 밑)을 고른다 — 별 있는 판과 없는 판, 효과 있는 판과 없는 판은 서로 가장 가깝다
 * ③ 그 짝의 다른 자리를 덩어리로 묶어 상자 · 가운데(모듈 좌표) · 노란 몫 · 채운 몫 · 무늬가 더 많은 쪽을 낸다
 *
 * **다른 것이 별(표시)인지 · 효과인지 · 새 내용인지는 가르지 않는다.** 6호로 재 보니 빈 칸에 새로 들어온 노란 공(img23)이
 * 별과 똑같이 「작고 둥글고 노랗다」였고, 9호 7-2 ↔ 7-4 는 내용이 바뀐 다음 장면인데 무늬로는 한쪽에 얹힌 것처럼 보였다.
 * 자리와 그 자리의 사실만 넘기고, 그림을 보는 쪽(Claude)이 그 자리를 열어 가른다. 가운데(`center`)는 그대로 MIB affPos 로 쓸 수 있는 꼴이다.
 */

import { marksOf, pageNeeds, type PageMarks, type PageNeed } from "./pagemarks";
import { pngSize, readPng, type Bitmap } from "./png";

export type PageBox = { x: number; y: number; w: number; h: number };
/**
 * 다른 자리 한 덩어리. `center` 는 화면 가운데가 (0,0) 인 좌표(모듈 좌표, MIB affPos 와 같은 꼴).
 * `yellow` 바뀐 칸 가운데 노란 칸의 몫(무늬가 더 많은 쪽에서), `fill` 상자 안을 바뀐 칸이 채운 몫(테두리 · 흩어진 파티클은 작다),
 * `more` 무늬(가장자리)가 더 많은 쪽 — 별 · 효과는 밋밋한 칸 위에 얹힌다. 못 가르면 null
 */
export type PageDiff = { box: PageBox; center: { x: number; y: number }; yellow: number; fill: number; more: string | null };
/** 배경이 같고 몇 자리만 다른 두 그림. `ratio` 바뀐 칸의 몫. `diffs` 는 큰 것부터, `cut` 은 그 밖에 더 있던 덩어리 수 */
export type PageNear = { a: string; b: string; ratio: number; diffs: PageDiff[]; cut: number };
export type PagePairs = {
  near: PageNear[];
  /** 픽셀까지 같은 그림 */
  same: [string, string][];
  /** 1920×1080 이 아니거나 못 읽은 그림 — 견주지 않았다 */
  skipped: string[];
  /** 누를 자리 별이 그려진 그림과 별 자리 가운데(모듈 좌표 — MIB affPos 꼴) (`pagemarks.ts`) */
  stars: { rel: string; center: { x: number; y: number }; box: PageBox }[];
  /** 아직 없는 판 — 별을 숨긴 판 · 효과만 남긴 판 (`pagemarks.ts`) */
  needs: PageNeed[];
};

const W = 1920;
const H = 1080;
const S = 4;
const SW = W / S;
const SH = H / S;
/** 줄인 칸 하나가 바뀌었다고 보는 색 차이(채널 하나의 최대 차) */
const CELL_DIFF = 36;
/** 이보다 많이 바뀌면 다른 장면 */
const SCENE_RATIO = 0.15;
/** 이보다 작은 덩어리는 가장자리 번짐 */
const MIN_CELLS = 6;
/** 무늬가 이만큼 더 많아야 그쪽이라고 본다 */
const SIDE = 1.5;
/** 무늬로 못 가를 때 — 바뀐 칸이 이만큼 더 밝으면 그쪽(반짝이 · 빛무리) */
const LIGHT = 20;
/** 짝 하나에 싣는 덩어리 수 */
const DIFFS_MAX = 6;

type Small = { rel: string; bmp: Bitmap; px: Uint8Array; marks: PageMarks };

function shrink(b: Bitmap): Uint8Array {
  const out = new Uint8Array(SW * SH * 3);
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      let r = 0;
      let g = 0;
      let bl = 0;
      for (let dy = 0; dy < S; dy++) {
        let o = ((y * S + dy) * W + x * S) * 4;
        for (let dx = 0; dx < S; dx++, o += 4) {
          // 투명 칸은 흰색으로 친다 — figma 화면은 다 불투명이지만 리소스 그림이 섞여 올 수 있다
          const a = (b.data[o + 3] as number) / 255;
          r += (b.data[o] as number) * a + 255 * (1 - a);
          g += (b.data[o + 1] as number) * a + 255 * (1 - a);
          bl += (b.data[o + 2] as number) * a + 255 * (1 - a);
        }
      }
      const i = (y * SW + x) * 3;
      out[i] = r / (S * S);
      out[i + 1] = g / (S * S);
      out[i + 2] = bl / (S * S);
    }
  }
  return out;
}

function diffMask(a: Uint8Array, b: Uint8Array): { mask: Uint8Array; n: number } {
  const mask = new Uint8Array(SW * SH);
  let n = 0;
  for (let i = 0; i < SW * SH; i++) {
    const o = i * 3;
    const d = Math.max(Math.abs((a[o] as number) - (b[o] as number)), Math.abs((a[o + 1] as number) - (b[o + 1] as number)), Math.abs((a[o + 2] as number) - (b[o + 2] as number)));
    if (d > CELL_DIFF) {
      mask[i] = 1;
      n++;
    }
  }
  return { mask, n };
}

/** 바뀐 칸을 덩어리로 — 반짝이 · 파티클이 한 덩어리로 묶이게 두 칸 넓혀 묶는다. 덩어리마다 원래 바뀐 칸 목록 */
function blobs(mask: Uint8Array): number[][] {
  const grown = new Uint8Array(SW * SH);
  const R = 2;
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      if (!mask[y * SW + x]) continue;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < SH && xx >= 0 && xx < SW) grown[yy * SW + xx] = 1;
        }
      }
    }
  }
  const label = new Int32Array(SW * SH).fill(-1);
  const out: number[][] = [];
  for (let s = 0; s < SW * SH; s++) {
    if (!grown[s] || label[s] !== -1) continue;
    const id = out.length;
    const cells: number[] = [];
    const stack = [s];
    label[s] = id;
    while (stack.length) {
      const c = stack.pop() as number;
      if (mask[c]) cells.push(c);
      const x = c % SW;
      const y = (c - x) / SW;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= SW || ny >= SH) continue;
        const n = ny * SW + nx;
        if (grown[n] && label[n] === -1) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    if (cells.length >= MIN_CELLS) out.push(cells);
  }
  return out.sort((p, q) => q.length - p.length);
}

function boxOf(cells: number[]): PageBox {
  let x0 = SW;
  let y0 = SH;
  let x1 = 0;
  let y1 = 0;
  for (const c of cells) {
    const x = c % SW;
    const y = (c - x) / SW;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x: x0 * S, y: y0 * S, w: (x1 - x0 + 1) * S, h: (y1 - y0 + 1) * S };
}

/** 그 상자 안 무늬 — 원본 크기에서 이웃 픽셀 밝기 차의 합. 민무늬 칸은 0 에 가깝다 */
function texture(b: Bitmap, box: PageBox): number {
  let sum = 0;
  const lum = (o: number): number => 0.3 * (b.data[o] as number) + 0.59 * (b.data[o + 1] as number) + 0.11 * (b.data[o + 2] as number);
  for (let y = box.y; y < Math.min(H - 1, box.y + box.h); y++) {
    for (let x = box.x; x < Math.min(W - 1, box.x + box.w); x++) {
      const o = (y * W + x) * 4;
      const d = Math.abs(lum(o) - lum(o + 4)) + Math.abs(lum(o) - lum(o + W * 4));
      if (d > 12) sum += d;
    }
  }
  return sum;
}

/** 바뀐 칸의 평균 밝기 */
function lightOf(px: Uint8Array, cells: number[]): number {
  let sum = 0;
  for (const c of cells) sum += 0.3 * (px[c * 3] as number) + 0.59 * (px[c * 3 + 1] as number) + 0.11 * (px[c * 3 + 2] as number);
  return sum / cells.length;
}

/** 바뀐 칸 가운데 노란 칸(별 · 빛무리 · 노란 테두리)의 몫 */
function yellowShare(px: Uint8Array, cells: number[]): number {
  let n = 0;
  for (const c of cells) {
    const o = c * 3;
    if ((px[o] as number) > 200 && (px[o + 1] as number) > 170 && (px[o + 2] as number) < 150) n++;
  }
  return n / cells.length;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

function diffOf(a: Small, b: Small, cells: number[]): PageDiff {
  const box = boxOf(cells);
  const ta = texture(a.bmp, box);
  const tb = texture(b.bmp, box);
  let more = ta > tb * SIDE ? a : tb > ta * SIDE ? b : null;
  // 무늬로 못 가르면 밝기로 — 6호 img03 은 통 하나를 밝히고 반짝이를 둘렀다(무늬는 둘 다 공)
  if (!more) {
    const la = lightOf(a.px, cells);
    const lb = lightOf(b.px, cells);
    more = la > lb + LIGHT ? a : lb > la + LIGHT ? b : null;
  }
  return {
    box,
    center: { x: Math.round(box.x + box.w / 2 - W / 2), y: Math.round(box.y + box.h / 2 - H / 2) },
    yellow: r2(yellowShare((more ?? a).px, cells)),
    fill: r2(cells.length / ((box.w / S) * (box.h / S))),
    more: more?.rel ?? null
  };
}

export function pagePairs(files: { rel: string; file: string }[]): PagePairs {
  const out: PagePairs = { near: [], same: [], skipped: [], stars: [], needs: [] };
  const pages: Small[] = [];
  for (const f of files) {
    // 머리글로 크기부터 — 리소스 폴더의 작은 그림 수백 장을 다 풀지 않는다
    const size = pngSize(f.file);
    const bmp = size && size.w === W && size.h === H ? readPng(f.file) : null;
    if (!bmp || bmp.w !== W || bmp.h !== H) {
      out.skipped.push(f.rel);
      continue;
    }
    pages.push({ rel: f.rel, bmp, px: shrink(bmp), marks: marksOf(bmp) });
  }
  // 둘씩 바뀐 칸의 몫 — 짝 고르기와 아직 없는 판 세기가 같이 쓴다
  const n = pages.length;
  const ratios = new Float32Array(n * n).fill(1);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = diffMask((pages[i] as Small).px, (pages[j] as Small).px).n / (SW * SH);
      ratios[i * n + j] = r;
      ratios[j * n + i] = r;
    }
  }
  for (const p of pages) {
    const s = p.marks.star;
    if (s) out.stars.push({ rel: p.rel, box: s, center: { x: Math.round(s.x + s.w / 2 - W / 2), y: Math.round(s.y + s.h / 2 - H / 2) } });
  }
  // 픽셀까지 같은 그림은 하나만 적는다 — 내려받기가 붙인 「 (1)」 없는 이름을 남긴다(아래에서 `same` 으로 알린다)
  const copy = (rel: string): boolean => / \(\d+\)\.png$/i.test(rel);
  const twin = new Set<string>();
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (ratios[i * n + j] !== 0) continue;
      const [a, b] = [(pages[i] as Small).rel, (pages[j] as Small).rel];
      twin.add(copy(a) && !copy(b) ? a : b);
    }
  }
  out.needs = pageNeeds(pages, (i, j) => ratios[i * n + j] as number).filter((x) => !twin.has(x.rel));
  out.stars = out.stars.filter((s) => !twin.has(s.rel));
  // 픽셀까지 같은 그림은 앞의 것 하나만 짝을 찾는다 — 9호 `6-2 (1).png` 가 `6-2.png` 와 같은 줄을 한 번 더 냈다
  const dup = new Set<number>();
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      if (dup.has(i) || dup.has(j)) continue;
      const a = pages[i] as Small;
      const b = pages[j] as Small;
      if (ratios[i * n + j] === 0 && Buffer.compare(Buffer.from(a.bmp.data), Buffer.from(b.bmp.data)) === 0) {
        out.same.push([a.rel, b.rel]);
        dup.add(j);
      }
    }
  }
  // 그림마다 바뀐 칸이 가장 적은 짝
  const best = pages.map(() => ({ j: -1, r: Infinity }));
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      if (dup.has(i) || dup.has(j)) continue;
      const r = ratios[i * n + j] as number;
      if (r === 0 || r > SCENE_RATIO) continue;
      if (r < (best[i] as { r: number }).r) best[i] = { j, r };
      if (r < (best[j] as { r: number }).r) best[j] = { j: i, r };
    }
  }
  const seen = new Set<string>();
  best.forEach((p, i) => {
    if (p.j < 0) return;
    const [x, y] = i < p.j ? [i, p.j] : [p.j, i];
    const key = `${x}|${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    const a = pages[x] as Small;
    const b = pages[y] as Small;
    const groups = blobs(diffMask(a.px, b.px).mask);
    out.near.push({
      a: a.rel,
      b: b.rel,
      ratio: Math.round(p.r * 10000) / 10000,
      diffs: groups.slice(0, DIFFS_MAX).map((cells) => diffOf(a, b, cells)),
      cut: Math.max(0, groups.length - DIFFS_MAX)
    });
  });
  return out;
}
