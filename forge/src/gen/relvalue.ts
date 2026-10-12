// **제 자리의 값을 보는 관계** 여섯 갈래 (2026-09-23) — oneOf · absent · present ·
// range · count · distinct. 갈래 목록과 나눠 주기, 어떤 규칙 글에서 나왔는지는
// `relkinds.ts` 머리말에 있습니다.
//
// ─── 안 적은 칸은 건너뜁니다 ─────────────────────────────────────────────
//
// `select()` 는 열쇠가 없어도 `undefined` 값으로 자리를 돌려줍니다. 그것은
// **안 적은 칸**이라 여기서 보지 않습니다 — 적어야 하는 칸이면 모양 검사가
// 이미 error 로 잡습니다. 같은 일로 두 번 걸리지 않게 합니다(`idle()` 과 같은 까닭).
// 다만 **길이 통째로 아무것도 못 찾으면** 그렇다고 알립니다 — 길을 잘못 적은
// 관계가 조용히 초록이 되는 것이 제일 나쁩니다.

import type { SpecRelation } from "./types";
import { idle, isPlainObject, select, show, written, type Add, type Hit, type Note } from "./relpath";

export function oneOf(
  rel: Extract<SpecRelation, { kind: "oneOf" }>,
  root: unknown,
  rootName: string,
  add: Add,
  note: Note,
): void {
  const hits = select(root, rel.pick, rootName);
  if (!hits.length) return idle(rel.id, rel.pick, note);
  // **식은 식의 글로 견준다** (2026-09-23) — WordSparkLv1 `aniRotate: -(Math.PI / 4)`.
  // 값 쪽도 `{ "__expr": "-(Math.PI / 4)" }` 로 적는다. 글 `"Math.PI"` 와는 안 맞는다.
  const exprOf = (v: unknown): string | null =>
    isPlainObject(v) && typeof v.__expr === "string" ? v.__expr : null;
  for (const h of written(hits)) {
    const expr = exprOf(h.value);
    if (expr !== null) {
      if (!rel.values.some((v) => exprOf(v) === expr)) {
        add(h.path, `${expr} 입니다. ${rel.values.map(show).join(" · ")} 가운데 하나여야 합니다.`);
      }
      continue;
    }
    if (typeof h.value !== "string" && typeof h.value !== "number" && typeof h.value !== "boolean") {
      note(`${h.path} 가 글·수·참거짓이 아니라 견주지 못했습니다: ${show(h.value)}`);
      continue;
    }
    if (!rel.values.includes(h.value)) {
      add(h.path, `${show(h.value)} 입니다. ${rel.values.map(show).join(" · ")} 가운데 하나여야 합니다.`);
    }
  }
}

export function absent(
  rel: Extract<SpecRelation, { kind: "absent" }>,
  root: unknown,
  rootName: string,
  add: Add,
): void {
  // 못 찾은 것이 곧 바라는 것이라 `idle` 을 부르지 않는다.
  //
  // **한 줄로 모아 말한다** (2026-09-23). 이닝마다 같은 칸이 있으면 자리마다
  // 한 줄씩 나와 ENL1M07W1S3 에서 경고가 여섯 줄이 됐다 — 뜻은 하나다.
  const hits = written(select(root, rel.pick, rootName));
  if (!hits.length) return;
  const first = hits[0] as Hit;
  add(
    first.path,
    `이 자리는 없어야 합니다 — ${hits.length}자리에 들어 있습니다 (${show(first.value)}` +
      `${hits.length > 1 ? " …" : ""}). 모듈이 읽지 않는 칸입니다.`,
  );
}

/** 있어야 할 자리. 없는 것이 곧 어긋난 것이라 `idle` 을 부르지 않는다. */
export function present(
  rel: Extract<SpecRelation, { kind: "present" }>,
  root: unknown,
  rootName: string,
  add: Add,
): void {
  const has = rel.picks.map((p) => written(select(root, p, rootName)).length > 0);
  const ok = rel.any ? has.some(Boolean) : has.every(Boolean);
  if (ok) return;
  const missing = rel.picks.filter((_, i) => !has[i]);
  add(
    rootName,
    rel.any
      ? `${rel.picks.join(" · ")} 가운데 하나는 있어야 하는데 하나도 없습니다.`
      : `${missing.join(" · ")} 가 없습니다. 있어야 하는 자리입니다.`,
  );
}

export function range(
  rel: Extract<SpecRelation, { kind: "range" }>,
  root: unknown,
  rootName: string,
  add: Add,
  note: Note,
): void {
  const hits = select(root, rel.pick, rootName);
  if (!hits.length) return idle(rel.id, rel.pick, note);
  for (const h of written(hits)) {
    if (typeof h.value !== "number") {
      // 식(`Math.PI * 6`)은 여기서 못 푼다 — 못 봤다고 말하고 넘어간다.
      note(`${h.path} 가 수가 아니라 범위를 못 봤습니다: ${show(h.value)}`);
      continue;
    }
    if (rel.min !== undefined && h.value < rel.min) add(h.path, `${h.value} 입니다. ${rel.min} 이상이어야 합니다.`);
    if (rel.max !== undefined && h.value > rel.max) add(h.path, `${h.value} 입니다. ${rel.max} 이하여야 합니다.`);
  }
}

export function count(
  rel: Extract<SpecRelation, { kind: "count" }>,
  root: unknown,
  rootName: string,
  add: Add,
  note: Note,
): void {
  const hits = select(root, rel.pick, rootName);
  if (!hits.length) return idle(rel.id, rel.pick, note);
  for (const h of written(hits)) {
    // 표(열쇠 → 값)면 열쇠 수를 센다 — ExploreQuiz `cards` 는 {c1, c2, …} 이다.
    const n = Array.isArray(h.value)
      ? h.value.length
      : isPlainObject(h.value)
        ? Object.keys(h.value).length
        : null;
    if (n === null) {
      note(`${h.path} 가 배열도 표도 아니라 칸 수를 못 셌습니다: ${show(h.value)}`);
      continue;
    }
    if (rel.min !== undefined && n < rel.min) add(h.path, `${n}칸입니다. ${rel.min}칸 이상이어야 합니다.`);
    if (rel.max !== undefined && n > rel.max) add(h.path, `${n}칸입니다. ${rel.max}칸까지입니다.`);
  }
}

export function distinct(
  rel: Extract<SpecRelation, { kind: "distinct" }>,
  root: unknown,
  rootName: string,
  add: Add,
  note: Note,
): void {
  const hits = select(root, rel.pick, rootName);
  if (!hits.length) return idle(rel.id, rel.pick, note);
  const first = new Map<string, string>(); // 값 → 처음 나온 자리
  for (const h of written(hits)) {
    const key = show(h.value);
    const at = first.get(key);
    if (at === undefined) first.set(key, h.path);
    else add(h.path, `${key} 입니다. ${at} 와 같습니다 — 서로 달라야 합니다.`);
  }
}
