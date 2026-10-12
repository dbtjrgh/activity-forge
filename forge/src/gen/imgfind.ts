/**
 * **화면 그림 안에서 리소스 그림을 찾는다 — 그리고 스스로 검산한다** (2026-09-28).
 *
 * 좌표는 figma 가 정본인데 API 는 한도로 닫았고(함정), 「CSS(모든 레이어)」는 부모 없는
 * 퍼센트라 못 쓴다(함정). 사람이 이닝 화면을 **원래 크기(1920×1080)** 로 붙여 주면, 리소스
 * 그림이 그 화면 어디에 있는지 픽셀로 찾는다. AI 를 안 부른다.
 *
 * 차례 — ① 원래 크기에서 2px 걸러 적은 점으로 화면 전체를 훑고 ② 후보 몇 곳을 1px 단위로 다듬고
 * ③ **그림의 불투명한 픽셀 전부를 그 자리에 겹쳐 맞는 비율**(`ratio`)을 잰다.
 * 비율이 낮으면 좌표로 쓰지 않는다 — 부르는 쪽이 앞 회차 값을 두고 알린다. 키운 그림
 * (110% 북)·가려진 그림·다른 그림은 여기서 걸린다. **찾았다고 믿지 않고 겹쳐서 본다.**
 *
 * 반투명한 가장자리(알파 < 250)는 안 본다 — 뒤 배경과 섞여 있어 어느 자리에서도 안 맞는다.
 */

import type { Bitmap } from "./png";

export type Found = {
  /** 화면 기준 왼쪽 위 */
  x: number;
  y: number;
  /** 불투명 픽셀 가운데 색이 맞는 비율 0~1 */
  ratio: number;
  /** 불투명 픽셀의 평균 색 차이(0~255) */
  diff: number;
};

const OPAQUE = 250;
/** 한 채널이 이만큼까지 달라도 같은 색으로 본다 — figma 내보내기와 리소스의 압축 차이 */
const TOL = 24;
/** 훑을 때 몇 칸씩 건너뛰나 — 다듬기가 그 둘레를 1px 로 본다 */
const STEP = 2;

/** 불투명 픽셀 자리들 — 많으면 고르게 `max` 개만 */
function points(t: Bitmap, max: number): number[] {
  const all: number[] = [];
  for (let i = 0; i < t.w * t.h; i += 1) if ((t.data[i * 4 + 3] as number) >= OPAQUE) all.push(i);
  if (all.length <= max) return all;
  const step = all.length / max;
  return Array.from({ length: max }, (_, k) => all[Math.floor(k * step)] as number);
}

/**
 * 점들의 **평균** 색 차이. `hide` 가 있으면 가려진 화면 픽셀은 안 센다 — 센 점이 너무 적으면
 * (절반 밑) 그 자리는 못 믿으므로 가장 나쁜 값을 준다. `stop` 을 넘으면 바로 그만둔다.
 */
function sad(s: Bitmap, t: Bitmap, pts: number[], ox: number, oy: number, stop: number, hide?: Uint8Array): number {
  let sum = 0, n = 0;
  const budget = stop * pts.length;
  for (const p of pts) {
    const tx = p % t.w, ty = (p - tx) / t.w;
    const at = (oy + ty) * s.w + ox + tx;
    if (hide && hide[at]) continue;
    const so = at * 4, to = p * 4;
    sum +=
      Math.abs((s.data[so] as number) - (t.data[to] as number)) +
      Math.abs((s.data[so + 1] as number) - (t.data[to + 1] as number)) +
      Math.abs((s.data[so + 2] as number) - (t.data[to + 2] as number));
    n += 1;
    if (!hide && sum > budget) return Infinity;
  }
  return n * 2 < pts.length ? Infinity : sum / n;
}

/** 이미 찾은 그림들이 덮는 화면 픽셀 — 1 이면 가려진 자리 */
export function hideOf(s: Bitmap, others: Placed[]): Uint8Array {
  const out = new Uint8Array(s.w * s.h);
  for (const o of others) {
    for (let y = 0; y < o.t.h; y += 1) {
      for (let x = 0; x < o.t.w; x += 1) {
        const sx = o.x + x, sy = o.y + y;
        if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
        if ((o.t.data[(y * o.t.w + x) * 4 + 3] as number) >= OPAQUE) out[sy * s.w + sx] = 1;
      }
    }
  }
  return out;
}

/** 이미 찾은 그림 하나 — 다른 그림을 가렸을 수 있다 */
export type Placed = { t: Bitmap; x: number; y: number };

/** 화면 한 점이 `others` 가운데 하나의 불투명 픽셀 밑인가 */
function covered(others: Placed[], sx: number, sy: number): boolean {
  for (const o of others) {
    const px = sx - o.x, py = sy - o.y;
    if (px < 0 || py < 0 || px >= o.t.w || py >= o.t.h) continue;
    if ((o.t.data[(py * o.t.w + px) * 4 + 3] as number) >= OPAQUE) return true;
  }
  return false;
}

/**
 * 그 자리에 겹쳐 본 결과 — 불투명 픽셀 **전부**. `others` 를 주면 그 그림들에 **가려진 픽셀은
 * 빼고** 잰다 (2026-09-28). 북 위에 캐릭터가 올라타 있어, 자리는 0px 로 맞는데 북의 맞음이
 * 84~88% 로 떨어졌다. 무엇이 위에 그려졌는지는 모르므로, 겹친 곳은 어느 쪽 탓으로도 안 센다.
 */
export function overlay(s: Bitmap, t: Bitmap, x: number, y: number, others: Placed[] = []): Found {
  let n = 0, ok = 0, total = 0;
  for (let ty = 0; ty < t.h; ty += 1) {
    for (let tx = 0; tx < t.w; tx += 1) {
      const to = (ty * t.w + tx) * 4;
      if ((t.data[to + 3] as number) < OPAQUE) continue;
      const sx = x + tx, sy = y + ty;
      if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
      if (others.length && covered(others, sx, sy)) continue;
      const so = (sy * s.w + sx) * 4;
      const d = Math.max(
        Math.abs((s.data[so] as number) - (t.data[to] as number)),
        Math.abs((s.data[so + 1] as number) - (t.data[to + 1] as number)),
        Math.abs((s.data[so + 2] as number) - (t.data[to + 2] as number)),
      );
      n += 1;
      total += d;
      if (d <= TOL) ok += 1;
    }
  }
  return { x, y, ratio: n ? ok / n : 0, diff: n ? total / n : 255 };
}

/**
 * 화면 `s` 에서 그림 `t` 를 찾는다. 불투명 픽셀이 너무 적거나 화면보다 크면 null.
 *
 * `others` 는 **이미 확실히 찾은 그림들**이다. 그 밑에 깔린 픽셀은 찾을 때도 검산할 때도 안 본다 —
 * figma 에서는 북이 캐릭터 앞에 있어 캐릭터 아랫몸이 가려진다. 가려진 곳까지 견주면 엉뚱한 자리를 고른다.
 */
export function findImage(s: Bitmap, t: Bitmap, others: Placed[] = [], keep = 6): Found | null {
  if (t.w > s.w || t.h > s.h) return null;
  const hide = others.length ? hideOf(s, others) : undefined;
  // **줄여서 훑지 않는다** (2026-09-28, 재서 바꿨다). 1/4 로 줄이면 칸 경계가 그림 원점과
  // 어긋나(435 는 4 의 배수가 아니다) 복잡한 배경에서 합성 화면 17장 중 0장을 찾았다.
  // 원래 크기에서 **STEP 칸 걸러** 적은 점으로 훑고, 좋은 자리 둘레를 1px 로 다듬는다.
  const coarse = points(t, 200);
  if (coarse.length < 20) return null;

  // ① 걸러서 전체를 훑는다 — 좋은 자리 몇 곳을 서로 떨어뜨려 남긴다
  const best: { x: number; y: number; v: number }[] = [];
  for (let y = 0; y + t.h <= s.h; y += STEP) {
    for (let x = 0; x + t.w <= s.w; x += STEP) {
      const worst = best.length < keep ? Infinity : (best[best.length - 1] as { v: number }).v;
      const v = sad(s, t, coarse, x, y, worst, hide);
      if (v >= worst) continue;
      const near = best.findIndex((b) => Math.abs(b.x - x) <= 4 * STEP && Math.abs(b.y - y) <= 4 * STEP);
      if (near >= 0) {
        if (v < (best[near] as { v: number }).v) best.splice(near, 1);
        else continue;
      }
      best.push({ x, y, v });
      best.sort((a, b) => a.v - b.v);
      if (best.length > keep) best.pop();
    }
  }

  // ② 원래 크기에서 다듬고 ③ 전부 겹쳐 본다
  const fine = points(t, 3000);
  let out: Found | null = null;
  for (const c of best) {
    let bx = c.x, by = c.y, bv = Infinity;
    for (let y = c.y - STEP; y <= c.y + STEP; y += 1) {
      for (let x = c.x - STEP; x <= c.x + STEP; x += 1) {
        if (x < 0 || y < 0 || x + t.w > s.w || y + t.h > s.h) continue;
        const v = sad(s, t, fine, x, y, bv, hide);
        if (v < bv) (bv = v), (bx = x), (by = y);
      }
    }
    const got = overlay(s, t, bx, by, others);
    if (!out || got.ratio > out.ratio) out = got;
  }
  return out;
}

/**
 * **그 둘레에서만 찾는다** (2026-09-29, M6 「딱 맞추기」). 사람이 비교 캔버스에서 대충 끌어다 놓은 자리
 * (`x0`,`y0` — 왼쪽 위) ±`reach` px 를 1px 로 훑는다. 화면 전체를 훑는 `findImage` 보다 좁아 엉뚱한 곳(같은 그림을 쓰는
 * 다른 이닝 칸)으로 튀지 않는다. 받을지는 부르는 쪽이 `ratio` 로 정한다 — 문턱은 `placefind.ts` 의 0.9 그대로.
 */
export function findNear(s: Bitmap, t: Bitmap, x0: number, y0: number, reach = 40): Found | null {
  if (t.w > s.w || t.h > s.h) return null;
  const fine = points(t, 3000);
  if (fine.length < 20) return null;
  let bx = -1, by = -1, bv = Infinity;
  for (let y = Math.max(0, y0 - reach); y <= Math.min(s.h - t.h, y0 + reach); y += 1) {
    for (let x = Math.max(0, x0 - reach); x <= Math.min(s.w - t.w, x0 + reach); x += 1) {
      const v = sad(s, t, fine, x, y, bv);
      if (v < bv) (bv = v), (bx = x), (by = y);
    }
  }
  return bx < 0 ? null : overlay(s, t, bx, by);
}
