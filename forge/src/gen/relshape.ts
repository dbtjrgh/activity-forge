// **값의 꼴을 보는 관계** 세 갈래 (2026-09-23) — 칸의 **차례**와 **열쇠**.
//
// `relvalue.ts` 의 갈래는 모인 값을 하나씩 봅니다. 여기 셋은 **그 값이 어디에
// 놓였나**를 봅니다 — 배열의 몇 번째 칸인가, 어떤 열쇠 아래인가. 길 문법에
// 차례(`[0]`)나 아무 열쇠(`*`)를 더하지 않으려고 갈래로 냈습니다(`relpath.ts`
// 머리말 — 「필요한 것이 생기면 갈래를 더하는 쪽이 맞다」).
//
//   ends    첫 칸 · 끝 칸 · 가운데 칸이 저마다 이 가운데 하나   M05_Table.data
//   spans   칸마다 from < to, 앞 칸의 to 이후에 시작               subtitle[] start · end
//   noKey   어느 깊이에도 이 열쇠가 없어야                       rotata
//
// 넣는 기준은 `relkinds.ts` 머리말과 같습니다.

import type { SpecRelation } from "./types";
import { idle, isPlainObject, select, show, written, type Add, type Note } from "./relpath";

export function ends(
  rel: Extract<SpecRelation, { kind: "ends" }>,
  root: unknown,
  rootName: string,
  add: Add,
  note: Note,
): void {
  const lists = written(select(root, rel.pick, rootName)).filter((h) => Array.isArray(h.value));
  if (!lists.length) return idle(rel.id, rel.pick, note);
  for (const list of lists) {
    const items = list.value as unknown[];
    items.forEach((v, i) => {
      // 한 칸짜리는 첫 칸이자 끝 칸이다 — 둘 다 맞아야 한다
      const want: [string, (string | number)[] | undefined][] = [];
      if (i === 0) want.push(["첫 칸", rel.first]);
      if (i === items.length - 1) want.push(["끝 칸", rel.last]);
      if (i > 0 && i < items.length - 1) want.push(["가운데 칸", rel.middle]);
      for (const [where, ok] of want) {
        if (ok && !ok.some((o) => o === v)) {
          add(`${list.path}[${i}]`, `${where}이 ${show(v)} 입니다. ${ok.map(show).join(" · ")} 가운데 하나여야 합니다.`);
        }
      }
    });
  }
}

/**
 * 칸마다 `from` < `to` 이고, **앞 칸의 `to` 보다 뒤에서** 시작한다(같아도 된다 —
 * CreateSong 완성본 379줄 가운데 20줄이 앞줄 끝과 딱 붙어 시작한다).
 */
export function spans(
  rel: Extract<SpecRelation, { kind: "spans" }>,
  root: unknown,
  rootName: string,
  add: Add,
  note: Note,
): void {
  const lists = written(select(root, rel.pick, rootName)).filter((h) => Array.isArray(h.value));
  if (!lists.length) return idle(rel.id, rel.pick, note);
  for (const list of lists) {
    let prev: number | null = null;
    (list.value as unknown[]).forEach((row, i) => {
      if (!isPlainObject(row)) return;
      const a = row[rel.from];
      const b = row[rel.to];
      if (typeof a !== "number" || typeof b !== "number") return; // 모양 검사가 본다
      const at = `${list.path}[${i}]`;
      if (a >= b) add(at, `${rel.from} ${a} 가 ${rel.to} ${b} 보다 작아야 합니다.`);
      if (prev !== null && a < prev) add(at, `${rel.from} ${a} 가 앞 칸의 ${rel.to} ${prev} 보다 앞입니다 — 겹칩니다.`);
      prev = b;
    });
  }
}

export function noKey(
  rel: Extract<SpecRelation, { kind: "noKey" }>,
  root: unknown,
  rootName: string,
  add: Add,
  note: Note,
): void {
  const tops = written(select(root, rel.pick ?? "", rootName));
  if (!tops.length) return idle(rel.id, rel.pick ?? "", note);
  const bad = new Set(rel.keys);
  const walk = (v: unknown, at: string): void => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`));
    if (!isPlainObject(v)) return;
    for (const [k, x] of Object.entries(v)) {
      if (bad.has(k)) add(`${at}.${k}`, `'${k}' 는 적지 않는 열쇠입니다.`);
      else walk(x, `${at}.${k}`);
    }
  };
  for (const t of tops) walk(t.value, t.path);
}
