/**
 * **figma 장면에 그려진 누를 자리 별 · 노란 테두리(효과)를 찾고, 내보내야 할 판을 센다** (2026-10-13, 인터북).
 *
 * 9호 인터북 figma 는 누를 자리에 반투명 노란 별을 그려 두고, 누른 뒤 상태에는 노란 테두리 · 파티클을 그린다. figma 에서는 이렇게만 와서
 * 사람이 별을 숨긴 판 · 효과만 남긴 판을 따로 내보내야 한다(사용자 말 — 「이짓거릴 계속 해야겠네? … 양산기에서 뭐 필요한지 얘기를 잘 해주면」).
 * 그래서 리소스 그림에서 별을 찾아, 아직 없는 판을 그림마다 적는다. 셈은 `pagepairs.ts` 가 그림을 한 번 읽을 때 같이 부른다.
 *
 * 별 — 노란 덩어리(반투명이라 밑의 숫자 · 막대가 비쳐 칸이 비어도 된다)가 아래를 다 맞을 때만:
 * - 크기 80~300px · 가로세로 0.85~1.2 · 상자를 채운 몫 0.42~0.68(꽉 찬 공 · 막대는 안 맞는다)
 * - 꼭짓점 4~6개(무게중심에서 각도마다 가장 먼 칸의 봉우리), 가장 먼/가까운 거리 1.5~2.3
 * - 둘레에 연노랑 빛무리가 25% 넘게 — 9호 놀이공원 그림의 노란 물건은 모양은 맞는데 빛무리가 0.07~0.14 였다(별은 0.32~0.78)
 * 위 기준은 9호 MAL2M08W1S1 과 9호 주스 인터북 그림으로 쟀다(별 11개 다 맞음, 별 아닌 것 0).
 *
 * 효과 — 노란 덩어리가 크고(250px 넘음) 속이 비었는데(채운 몫 0.3 밑) **같은 배경 그림의 절반 이상에는 그 자리에 없을 때**.
 * 판 테두리처럼 거의 모든 그림에 있는 노란 틀은 효과가 아니다. 파란 표시 · 파티클만 있는 효과는 못 본다 — 그때는 「별 숨긴 판」만 말한다.
 */

import type { Bitmap } from "./png";
import type { PageBox } from "./pagepairs";

const W = 1920;
const H = 1080;
const S = 2;
const SW = W / S;
const SH = H / S;

export type PageMarks = { star: PageBox | null; outlines: PageBox[] };
/** 그림 하나에 아직 없는 판 — `star` 는 별 자리(그 그림의 좌표) */
export type PageNeed = { rel: string; star: PageBox; missing: ("별을 숨긴 판" | "별만 숨긴 판(효과는 그대로)" | "별과 효과를 숨긴 판")[] };

const yellow = (r: number, g: number, b: number): boolean => r >= 180 && g >= 170 && b <= 120 && r - b >= 90 && Math.abs(r - g) <= 45;
const pale = (r: number, g: number, b: number): boolean => r >= 230 && g >= 215 && b >= 100 && b <= 238 && r - b >= 15 && Math.abs(r - g) <= 30;

type Blob = { x0: number; y0: number; x1: number; y1: number; cells: number[] };

function yellowBlobs(bmp: Bitmap): Blob[] {
  const mask = new Uint8Array(SW * SH);
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const o = (y * S * W + x * S) * 4;
      if (yellow(bmp.data[o] as number, bmp.data[o + 1] as number, bmp.data[o + 2] as number)) mask[y * SW + x] = 1;
    }
  }
  const seen = new Uint8Array(SW * SH);
  const out: Blob[] = [];
  for (let s = 0; s < SW * SH; s++) {
    if (!mask[s] || seen[s]) continue;
    const b: Blob = { x0: SW, y0: SH, x1: 0, y1: 0, cells: [] };
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop() as number;
      const x = p % SW;
      const y = (p - x) / SW;
      b.cells.push(p);
      b.x0 = Math.min(b.x0, x);
      b.y0 = Math.min(b.y0, y);
      b.x1 = Math.max(b.x1, x);
      b.y1 = Math.max(b.y1, y);
      // 두 칸 건너까지 한 덩어리 — 별 밑에 비친 숫자가 별을 끊어 놓는다
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= SW || ny >= SH) continue;
          const q = ny * SW + nx;
          if (mask[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    if (b.cells.length >= 60) out.push(b);
  }
  return out;
}

const boxOf = (b: Blob): PageBox => ({ x: b.x0 * S, y: b.y0 * S, w: (b.x1 - b.x0 + 1) * S, h: (b.y1 - b.y0 + 1) * S });
const fillOf = (b: Blob): number => b.cells.length / ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1));

/** 둘레의 연노랑 빛무리 몫 — 별 크기의 0.6 · 0.69 · 0.78 배 원 위 */
function glow(bmp: Bitmap, box: PageBox): number {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = Math.max(box.w, box.h) * 0.6;
  let n = 0;
  let ok = 0;
  for (let a = 0; a < 360; a += 3) {
    for (const k of [1, 1.15, 1.3]) {
      const x = Math.round(cx + Math.cos((a * Math.PI) / 180) * r * k);
      const y = Math.round(cy + Math.sin((a * Math.PI) / 180) * r * k);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const o = (y * W + x) * 4;
      n++;
      if (pale(bmp.data[o] as number, bmp.data[o + 1] as number, bmp.data[o + 2] as number)) ok++;
    }
  }
  return n ? ok / n : 0;
}

/** 꼭짓점 수와 가장 먼/가까운 거리 — 각도 72칸마다 가장 먼 칸, 이웃과 고른 뒤 봉우리 */
function tips(b: Blob): { peaks: number; spread: number } {
  let sx = 0;
  let sy = 0;
  for (const c of b.cells) {
    sx += c % SW;
    sy += Math.floor(c / SW);
  }
  const cx = sx / b.cells.length;
  const cy = sy / b.cells.length;
  const B = 72;
  const rad = new Array<number>(B).fill(0);
  for (const c of b.cells) {
    const x = c % SW;
    const y = Math.floor(c / SW);
    const k = Math.floor(((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI)) * B) % B;
    rad[k] = Math.max(rad[k] as number, Math.hypot(x - cx, y - cy));
  }
  const at = (i: number): number => rad[(i + B) % B] as number;
  const sm = rad.map((_, i) => (at(i - 1) + at(i) + at(i + 1)) / 3);
  const mean = sm.reduce((p, q) => p + q, 0) / B;
  const sat = (i: number): number => sm[(i + B) % B] as number;
  const peaks = sm.filter((v, i) => v > sat(i - 1) && v >= sat(i + 1) && v > mean * 1.1).length;
  return { peaks, spread: Math.max(...sm) / Math.max(1, Math.min(...sm)) };
}

function isStar(bmp: Bitmap, b: Blob): boolean {
  const box = boxOf(b);
  const fill = fillOf(b);
  if (Math.min(box.w, box.h) < 80 || Math.max(box.w, box.h) > 300) return false;
  if (box.w / box.h < 0.85 || box.w / box.h > 1.2 || fill < 0.42 || fill > 0.68) return false;
  const t = tips(b);
  if (t.peaks < 4 || t.peaks > 6 || t.spread < 1.5 || t.spread > 2.3) return false;
  return glow(bmp, box) >= 0.25;
}

/** 그림 하나 — 별(가장 큰 것 하나)과 속 빈 큰 노란 덩어리(효과 후보 · 판 틀) */
export function marksOf(bmp: Bitmap): PageMarks {
  const blobs = yellowBlobs(bmp);
  const stars = blobs.filter((b) => isStar(bmp, b)).sort((p, q) => q.cells.length - p.cells.length);
  const outlines = blobs.filter((b) => {
    const box = boxOf(b);
    return Math.max(box.w, box.h) >= 250 && fillOf(b) <= 0.3;
  });
  return { star: stars[0] ? boxOf(stars[0]) : null, outlines: outlines.map(boxOf) };
}

function iou(a: PageBox, b: PageBox): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const i = x * y;
  return i / (a.w * a.h + b.w * b.h - i);
}

const has = (list: PageBox[], box: PageBox): boolean => list.some((b) => iou(b, box) > 0.8);

/**
 * 아직 없는 판. `ratio(i, j)` 는 두 그림의 바뀐 칸 몫(배경이 다르면 1).
 * - 별만 있는 그림: 별 없는 그림이 거의 같게(바뀐 칸 3% 밑) 있으면 됐다
 * - 별과 효과가 같이 있는 그림: 그 효과는 있고 별은 없는 그림(3% 밑), 효과도 별도 없는 그림(8% 밑)이 다 있으면 됐다
 * 효과는 같은 배경의 다른 그림에 그 자리 노란 덩어리가 없을 때만 효과로 친다(판 틀은 어디에나 있다)
 */
export function pageNeeds(pages: { rel: string; marks: PageMarks }[], ratio: (i: number, j: number) => number): PageNeed[] {
  const out: PageNeed[] = [];
  pages.forEach((p, i) => {
    const star = p.marks.star;
    if (!star) return;
    const sibs = pages.map((q, j) => ({ q, j, r: j === i ? 1 : ratio(i, j) })).filter((s) => s.r <= 0.15);
    // 같은 배경 그림의 절반 이상에 없는 테두리만 효과 — 판의 노란 틀은 효과 장면(파티클이 붙어 모양이 갈라짐) 하나에서만 달랐다(주스 5-4)
    const effects = p.marks.outlines.filter((o) => sibs.length > 0 && sibs.filter((s) => !has(s.q.marks.outlines, o)).length * 2 >= sibs.length);
    // 짝이 될 그림 — 별이 없고, 이 그림의 효과를 `keep` 대로 갖고, **이 그림에 없는 노란 테두리가 없다**
    // (다음 장면 6-3 은 셋째 줄에 테두리가 있어 6-2 의 「별과 효과를 숨긴 판」이 아니다)
    const near = (limit: number, keep: boolean): boolean =>
      sibs.some(
        (s) =>
          s.r <= limit &&
          !s.q.marks.star &&
          effects.every((o) => has(s.q.marks.outlines, o) === keep) &&
          s.q.marks.outlines.every((o) => has(p.marks.outlines, o))
      );
    const missing: PageNeed["missing"] = [];
    if (!effects.length) {
      if (!near(0.03, true)) missing.push("별을 숨긴 판");
    } else {
      if (!near(0.03, true)) missing.push("별만 숨긴 판(효과는 그대로)");
      if (!near(0.08, false)) missing.push("별과 효과를 숨긴 판");
    }
    if (missing.length) out.push({ rel: p.rel, star, missing });
  });
  return out;
}
