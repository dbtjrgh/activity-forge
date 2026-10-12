// 배열 여럿의 칸 수가 같아야 (`sameCount`).
//
// `relref.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `relref.ts` 에서 가져다 씁니다.

import type { SpecRelation } from "./types";
import { idle, select, written, type Add, type Note } from "./relpath";

/**
 * 배열 여럿의 칸 수가 모두 같아야 한다. 이닝마다 따로는 `each` 로 **그 칸마다 따로**
 * 견준다 — M31 은 이닝 1이 3칸끼리, 이닝 2가 4칸끼리 같다. 한데 견주면
 * 멀쩡한 것이 다 걸린다(2026-09-23 에 후보를 적다 알았다).
 */
export function sameCount(
  rel: Extract<SpecRelation, { kind: "sameCount" }>,
  root: unknown,
  rootName: string,
  add: Add,
  note: Note,
): void {
  // 이닝마다 따로 견주는 것은 `each` 가 밖에서 한다 (`relation.ts`).
  // 길마다 센 것들 — 배열은 칸 수, 수는 그 수.
  const cols = rel.picks.map((pick) => written(select(root, pick, rootName)).flatMap(sized));
  let looked = 0;
  if (rel.zip) {
    const n = Math.min(...cols.map((c) => c.length));
    if (cols.some((c) => c.length !== n)) {
      note(`${rootName} — 짝지을 것의 수가 길마다 다릅니다 (${cols.map((c) => c.length).join(" · ")}). 짧은 쪽까지만 봅니다.`);
    }
    for (let i = 0; i < n; i += 1) looked += judge(rel, cols.map((c) => c[i] as Sized), rootName, add);
  } else {
    looked += judge(rel, cols.flat(), rootName, add);
  }
  if (!looked) idle(rel.id, rel.picks.join(" · "), note);
}

type Sized = { path: string; n: number };

/** 배열은 칸 수로, 0 이상의 정수는 그 수로 센다. 나머지는 셀 수 없다. */
function sized(h: { path: string; value: unknown }): Sized[] {
  if (Array.isArray(h.value)) return [{ path: h.path, n: h.value.length }];
  if (typeof h.value === "number" && Number.isInteger(h.value) && h.value >= 0) return [{ path: h.path, n: h.value }];
  return [];
}

/** 한 번 견준다. 견줄 짝이 있었으면 1. */
function judge(rel: Extract<SpecRelation, { kind: "sameCount" }>, seen: Sized[], at: string, add: Add): number {
  if (seen.length < 2) return 0; // 견줄 짝이 없다 — 그 칸을 안 쓰는 이닝
  const [head, ...rest] = seen as [Sized, ...Sized[]];
  const bad = rel.atLeast ? rest.some((s) => head.n < s.n) : new Set(seen.map((s) => s.n)).size > 1;
  if (bad) {
    const what = rel.atLeast ? `${head.path} 가 나머지보다 적습니다` : "칸 수가 서로 다릅니다";
    add(head.path ?? at, `${what} — ${seen.map((s) => `${s.path} ${s.n}`).join(" · ")}.`);
  }
  return 1;
}
