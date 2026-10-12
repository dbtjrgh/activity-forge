// 관계가 값을 찾아가는 **길**과, 못 찾았을 때 알리는 말.
//
// `relation.ts`(차례·목록)와 `relkinds.ts` 가 나눠 주는 값 갈래들이 같이 씁니다 (2026-09-23 에
// 떼어 냈습니다. 동작은 그대로입니다 — 두 파일이 서로를 부르지 않게 하려는 것입니다).

import type { AssetKind, SpecRelation } from "./types";

// 자리 하나. 어긋난 것을 짚을 때 실제 파일과 같은 꼴로 대야 합니다.
export type Hit = { path: string; value: unknown };

// **아무것도 못 찾았으면 그렇다고 말합니다.**
//
// 길을 한 글자 잘못 적으면 `select()` 가 빈 목록을 돌려주고 검사가 통째로
// 안 돕니다 — 그런데 화면에는 초록이 뜹니다. **막으려고 만든 것이 아무 말
// 없이 통과하는 것**이 이 도구에서 제일 나쁜 실패입니다. 8호 ①이 바로
// 「검사가 다 초록인데 결함이 살아 있는」 꼴이었습니다.
//
// error 가 아니라 warn 인 까닭 — 값이 통째로 빠진 레시피에서도 이리로 옵니다.
// 그것은 모양 검사가 이미 error 로 잡고 있어, 여기서 또 막으면 같은 일로
// 두 번 걸립니다.
export function idle(id: string, path: string, note: (message: string) => void): void {
  note(`${IDLE_HEAD}${path}' 에서 아무것도 못 찾아 검사가 안 돌았습니다. 관계 '${id}' 의 길을 확인하세요.`);
}

/** `idle()` 이 낸 말인지 가리는 머리. 칸마다 도는 관계가 이 말을 모아 한 번만 낸다. */
export const IDLE_HEAD = "길 '";

// ─── 칸마다 · 이럴 때만 (2026-09-23) ─────────────────────────────────────
//
// 값을 보는 갈래(`relkinds.ts` 가 나눠 주는 것) 어디에나 붙는 둘. 갈래마다 따로
// 넣지 않으려고 여기서 **볼 자리를 먼저 좁히고** 갈래는 그 자리만 본다.
//
//   each   그 길의 칸마다 따로 본다. 갈래의 길은 **그 칸 안에서** 찾는다
//          ex) each: sceneData → 씬 하나하나가 뿌리
//   when   이럴 때만 본다. `is` 면 그 값일 때, `isNot` 이면 그 값이 아닐 때
//          (칸이 없어도 「아니다」로 친다), 둘 다 없으면 그 칸이 있을 때
//          ex) when: { pick: "mode", is: "touch" }

export type When = { pick: string; is?: unknown; isNot?: unknown };

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function holds(w: When, u: Hit): boolean {
  const vals = select(u.value, w.pick, u.path)
    .filter((h) => h.value !== undefined)
    .map((h) => h.value);
  if ("is" in w) return vals.length > 0 && vals.every((v) => same(v, w.is));
  if ("isNot" in w) return vals.every((v) => !same(v, w.isNot));
  return vals.length > 0;
}

/** 볼 자리들. `each` 길이 아무것도 못 찾으면 null — 부르는 쪽이 「안 돌았다」고 말한다. */
export function scopesOf(rel: { each?: string; when?: When }, root: unknown, rootName: string): Hit[] | null {
  let units: Hit[] = [{ path: rootName, value: root }];
  if (rel.each) {
    const found = select(root, rel.each, rootName).filter((h) => h.value !== undefined);
    if (!found.length) return null;
    units = found.flatMap((h) =>
      Array.isArray(h.value) ? h.value.map((v, i) => ({ path: `${h.path}[${i}]`, value: v as unknown })) : [h],
    );
  }
  return rel.when ? units.filter((u) => holds(rel.when as When, u)) : units;
}

// ─── 자리 고르기 ─────────────────────────────────────────────────────────
//
// 아주 작은 길 문법입니다. **더 늘리지 마세요** — 스펙에 적는 것은 관계이지
// 질의문이 아닙니다. 필요한 것이 생기면 갈래(`kind`)를 더하는 쪽이 맞습니다.
//
//   a.b              객체 열쇠
//   a[]              배열의 칸 전부
//   a[correct]       그 배열에서 `correct` 가 참인 칸만
//
//   ex) inningData[].items[correct].popup
export function select(from: unknown, path: string, at: string): Hit[] {
  let hits: Hit[] = [{ path: at, value: from }];
  if (path === "") return hits;

  for (const seg of path.split(".")) {
    const m = /^([^[\]]*)(?:\[([^\]]*)\])?$/.exec(seg);
    if (!m) return [];
    const [, key = "", filter] = m;
    const next: Hit[] = [];
    for (const h of hits) {
      let v = h.value;
      let p = h.path;
      if (key) {
        if (!isPlainObject(v)) continue;
        v = v[key];
        p = `${p}.${key}`;
      }
      if (filter === undefined) {
        next.push({ path: p, value: v });
        continue;
      }
      if (!Array.isArray(v)) continue;
      v.forEach((item, i) => {
        // `[]` 는 전부, `[열쇠]` 는 그 열쇠가 참인 칸만.
        if (filter !== "" && !(isPlainObject(item) && item[filter])) return;
        next.push({ path: `${p}[${i}]`, value: item });
      });
    }
    hits = next;
  }
  return hits;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ─── 갈래들이 같이 쓰는 것 ───────────────────────────────────────────────

export type Add = (path: string, message: string) => void;
export type Note = (message: string) => void;

/** 적힌 값만. `undefined` 는 안 적은 칸이다 — 적어야 하는 칸이면 모양 검사가 잡는다. */
export const written = (hits: Hit[]): Hit[] => hits.filter((h) => h.value !== undefined);

/** 메시지에 쓸 값. 식(`{__expr}`)은 식 그대로 보인다. */
export function show(v: unknown): string {
  if (v && typeof v === "object" && "__expr" in v) return String((v as { __expr: unknown }).__expr);
  return JSON.stringify(v);
}

// ─── 관계 밖에서 쓰는 길 ─────────────────────────────────────────────────

/**
 * **열쇠가 alias 인 표**의 경로 → 갈래. `isAlias` · `of: "keys"` 관계가 곧 그 표의
 * 목록이다 — 자리를 새 이름으로 세울 때(`restock.ts`) 그 열쇠도 같이 바꾸려고 쓴다.
 * 틀(`template`)이 붙은 것은 열쇠가 alias 그대로가 아니라 뺀다.
 */
export function aliasKeyPaths(
  relations: SpecRelation[],
  data: unknown,
  root: string,
): Map<string, { kind: AssetKind; table: unknown }> {
  const out = new Map<string, { kind: AssetKind; table: unknown }>();
  for (const r of relations) {
    // 갈래(`as`)가 없으면 어느 갈래 이름인지 몰라 못 바꾼다
    if (r.kind !== "isAlias" || r.of !== "keys" || r.template || !r.as) continue;
    for (const unit of scopesOf(r, data, root) ?? []) {
      for (const h of select(unit.value, r.pick, unit.path)) out.set(h.path, { kind: r.as, table: h.value });
    }
  }
  return out;
}
