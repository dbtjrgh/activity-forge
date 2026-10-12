// **짝 · 홀 M 이 판을 가르는 모듈인가** — 완성본으로 센다 (2026-09-30).
//
// 9호 KOL1M08W1S3(K30)을 바로 앞 8호(M07)에서 떴더니 판이 달랐다 — 2 · 4 · 7호(M02 · M04 · M06)는 폴라로이드,
// 3 · 5 · 8호는 편지다. 그런데 「짝은 짝에서」를 모든 모듈에 걸 수는 없다. 완성본 302칸을 재 보니
// (버린 측정 스크립트 — 2026-09-30 대화 기록) 국어는 K04 · K11 · K18 · K25 · K29 · K30 · K31 · K33 이 다섯 번 다 짝 · 홀 쪽이 닮았고,
// 영어 · 수학은 거의 차이가 없거나 바로 앞이 닮았다(MA M01 은 9 : 3 으로 바로 앞). 그래서 **모듈마다** 센다.
//
// 재는 법 — 그 모듈 완성본 X(M03~M07)마다, 같은 칸의 바로 앞 M 과 두 칸 앞 M(짝 · 홀이 같음) 가운데
// X 의 png **크기 묶음**을 더 많이 가진 쪽(10%p 넘게 차이 날 때만, 같으면 바이트까지 같은 파일 몫)을 이긴 쪽으로 친다.
// **짝 · 홀 쪽이 두 번 넘게 · 바로 앞의 두 배 넘게 · 차이 없음보다 많이 이겨야** 그 모듈을 짝 · 홀로 뜬다.
// 스펙에 적지 않는 까닭은 공용 가져오기와 같다 — 완성본이 늘 때마다 두 벌을 맞춰야 한다.

import path from "node:path";
import { printOf, rscOfDone } from "./common";
import { walkPng } from "./commonfresh";
import type { Cell } from "./layout";
import { pngSize } from "./png";

export type Parity = { prefers: boolean; same: number; near: number; tie: number };

type Look = { sizes: string[]; prints: Set<string> };
const looks = new Map<string, Look | null>();
function lookOf(code: string): Look | null {
  if (looks.has(code)) return looks.get(code) ?? null;
  const dir = rscOfDone(code);
  const files = walkPng(dir);
  const sizes: string[] = [];
  for (const f of files) {
    const s = pngSize(path.join(dir, f));
    if (s) sizes.push(`${s.w}x${s.h}`);
  }
  const out = sizes.length ? { sizes, prints: new Set(files.map((f) => printOf(path.join(dir, f)) ?? "")) } : null;
  looks.set(code, out);
  return out;
}

/** X 의 크기 묶음 가운데 c 에도 있는 몫 — 같은 크기가 여럿이면 그 수만큼만 */
function sizeShare(x: Look, c: Look): number {
  const pool = new Map<string, number>();
  for (const s of c.sizes) pool.set(s, (pool.get(s) ?? 0) + 1);
  let hit = 0;
  for (const s of x.sizes) {
    const n = pool.get(s) ?? 0;
    if (n) {
      hit += 1;
      pool.set(s, n - 1);
    }
  }
  return hit / x.sizes.length;
}
const printShare = (x: Look, c: Look): number => [...x.prints].filter((p) => c.prints.has(p)).length / x.prints.size;

const cache = new Map<string, Parity>();
export function parityOf(subject: string, module: string, cells: Cell[]): Parity {
  const key = `${subject}|${module}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const at = new Map(cells.map((c) => [`${c.slot}|${c.issue}`, c]));
  const pad = (m: number): string => String(m).padStart(2, "0");
  const code = (slot: string, m: string): string => `${subject}${slot.slice(0, 2)}M${m}${slot.slice(2)}`;
  const out: Parity = { prefers: false, same: 0, near: 0, tie: 0 };
  for (const c of cells) {
    const n = Number(c.issue);
    if (c.module !== module || n < 3 || n > 7) continue;
    const a = at.get(`${c.slot}|${pad(n - 1)}`);
    const b = at.get(`${c.slot}|${pad(n - 2)}`);
    if (a?.module !== module || b?.module !== module) continue;
    const x = lookOf(code(c.slot, c.issue));
    const la = lookOf(code(c.slot, a.issue));
    const lb = lookOf(code(c.slot, b.issue));
    if (!x || !la || !lb) continue;
    const ds = sizeShare(x, la) - sizeShare(x, lb);
    const dp = printShare(x, la) - printShare(x, lb);
    const d = Math.abs(ds) >= 0.1 ? ds : Math.abs(dp) >= 0.1 ? dp : 0;
    if (d > 0) out.near += 1;
    else if (d < 0) out.same += 1;
    else out.tie += 1;
  }
  out.prefers = out.same >= 2 && out.same >= out.near * 2 && out.same >= out.tie;
  cache.set(key, out);
  return out;
}
