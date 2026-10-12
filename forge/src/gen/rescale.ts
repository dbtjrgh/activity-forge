/**
 * **그림 크기에 맞춰 정한 배율을 다시 셈한다** — 스펙 필드의 `scalesWith` (2026-10-02, 사용자 요청).
 *
 * K36 `endScale` 은 사진을 끝에 얼마나 줄여 보일지다. 완성본 7개에서 값은 0.17~1 로 갈리는데 **값 × 사진 너비는 830~1250** 이다
 * (`tool/scalegate.ts`) — 사진 크기를 따라 정한 값이다. 9호는 원본(2호)의 0.2 를 그대로 받았는데 2호 사진은 6240px, 9호 사진은 1040px 이라
 * 그대로 두면 사진이 엽서만 하게 줄어든다. 사람이 손으로 0.83 을 넣었다.
 *
 * - 셈은 **원본과 같은 크기로 보이게** 하나다 — 새 값 = 원본 값 × 원본 그림 너비 ÷ 새 그림 너비. 잰 것이 그것뿐이라 다른 식을 짓지 않는다
 * - **값이 원본 것 그대로일 때만** 고친다. 크기가 5% 안쪽으로 같으면 안 고친다. 그림을 못 읽으면 안 고친다
 * - 사람 · AI 답은 이 뒤에 얹혀 이긴다(부르는 쪽 차례 — 앱 `assemblevalues.ts`)
 */

import path from "node:path";
import { fileOf, relOf, rscOfDone } from "./common";
import { pngSize } from "./png";
import type { Recipe } from "./types";
import type { Spec } from "./typesspec";
import type { SpecField } from "./typesfield";

type Rule = { at: string[]; key: string; image: string };

/** 스펙에서 `scalesWith` 가 붙은 필드 — `at` 은 뿌리에서 그 칸까지(`[]` 는 배열 칸 전부) */
export function scaleRules(spec: Spec): Rule[] {
  const out: Rule[] = [];
  const walk = (fields: SpecField[], at: string[], pre: string): void => {
    for (const f of fields) {
      const key = pre ? `${pre}.${f.key}` : f.key;
      if (f.scalesWith) out.push({ at, key, image: f.scalesWith.image });
      if (f.type === "object" && f.fields) walk(f.fields, at, key);
      if (f.type === "array" && f.of?.fields) walk(f.of.fields, [...at, key, "[]"], "");
    }
  };
  const g = spec.gameData;
  if (g.kind === "array") walk(g.of?.fields ?? [], ["[]"], "");
  else walk(g.fields, [], "");
  return out;
}

const get = (o: unknown, dotted: string): unknown =>
  dotted.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), o);

function set(o: unknown, dotted: string, value: unknown): void {
  const keys = dotted.split(".");
  const last = keys.pop() as string;
  const box = keys.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), o);
  if (box && typeof box === "object") (box as Record<string, unknown>)[last] = value;
}

/** 두 나무에서 같은 자리의 칸 쌍 — `[]` 는 같은 번호끼리 */
function pairs(a: unknown, b: unknown, at: string[], where = ""): { a: unknown; b: unknown; where: string }[] {
  if (!at.length) return [{ a, b, where }];
  const [head, ...rest] = at as [string, ...string[]];
  if (head === "[]") {
    if (!Array.isArray(a) || !Array.isArray(b)) return [];
    return b.flatMap((x, i) => (i < a.length ? pairs(a[i], x, rest, `${where}[${i}]`) : []));
  }
  return pairs(get(a, head), get(b, head), rest, where ? `${where}.${head}` : head);
}

export type Rescaled = { path: string; from: number; to: number; why: string };

/** 같은 크기로 본다 — 이만큼 안쪽이면 안 고친다 */
const SAME = 0.05;

/**
 * `recipe.gameData` 를 그 자리에서 고치고 고친 것을 돌려준다. `start` 는 원본을 떠 온 그대로의 레시피, `dir` 은 이 학습코드 리소스 폴더
 */
export function rescale(spec: Spec, start: Recipe, recipe: Recipe, origin: string, dir: string): Rescaled[] {
  const rules = scaleRules(spec);
  if (!rules.length) return [];
  const theirs = fileOf(origin);
  const mine = relOf(recipe);
  const out: Rescaled[] = [];
  for (const r of rules) {
    for (const p of pairs(start.gameData, recipe.gameData, r.at)) {
      const was = get(p.a, r.key);
      if (typeof was !== "number" || get(p.b, r.key) !== was) continue;
      const oldRel = theirs.get(`image|${String(get(p.a, r.image))}`);
      const newRel = mine.get(`image|${String(get(p.b, r.image))}`);
      const o = oldRel ? pngSize(path.join(rscOfDone(origin), oldRel)) : null;
      const n = newRel ? pngSize(path.join(dir, newRel)) : null;
      if (!o || !n || !n.w) continue;
      const k = o.w / n.w;
      if (Math.abs(k - 1) < SAME) continue;
      const to = Math.round(was * k * 1000) / 1000;
      set(p.b, r.key, to);
      const at = p.where ? `${p.where}.${r.key}` : r.key;
      out.push({ path: at, from: was, to, why: `그림 너비가 원본 ${o.w}px, 이번 ${n.w}px 이라 원본과 같은 크기로 보이게 다시 계산했습니다` });
    }
  }
  return out;
}
