// **다른 자리를 끌어와 견주는 관계** 다섯 갈래 (2026-09-23).
//
// `relvalue.ts` 의 갈래는 값 하나를 제 자리에서
// 봅니다. 여기 다섯은 **견줄 것을 다른 데서 가져옵니다** — 자기 목록의 칸 수,
// AssetTable 의 alias(값이 · 이름이), 다른 표의 열쇠, 다른 배열의 칸 수. 그래서 「그쪽이 비었을
// 때」를 따로 말해야 해서 갈랐습니다.
//
// 어떤 규칙 글에서 나왔는지와 넣는 기준은 `relkinds.ts` 머리말에 있습니다.

import type { AssetKind, SpecRelation } from "./types";
import { idle, isPlainObject, select, show, written, type Add, type Note } from "./relpath";

type Aliases = Map<string, Set<AssetKind>> | undefined;

export function indexes(
  rel: Extract<SpecRelation, { kind: "indexes" }>,
  root: unknown,
  rootName: string,
  add: Add,
  note: Note,
): void {
  const lists = written(select(root, rel.list, rootName)).filter((h) => Array.isArray(h.value));
  if (!lists.length) return idle(rel.id, rel.list, note);
  let looked = 0;
  if (rel.beside) {
    // 옆 목록의 번호 — 목록은 하나여야 뜻이 선다(여럿이면 첫 것이 아니라 「안 돌았다」로 알린다)
    if (lists.length !== 1) return idle(rel.id, rel.list, note);
    const list = lists[0] as { path: string; value: unknown[] };
    for (const h of written(select(root, rel.pick, rootName))) {
      looked += 1;
      const n = h.value;
      if (typeof n !== "number" || !Number.isInteger(n)) add(h.path, `번호가 아닙니다: ${show(n)}`);
      else if (n < 0 || n >= list.value.length) {
        add(h.path, `${n} 입니다. ${list.path} 는 ${list.value.length}칸이라 0~${list.value.length - 1} 이어야 합니다.`);
      }
    }
    if (!looked) idle(rel.id, rel.pick, note);
    return;
  }
  for (const list of lists) {
    const items = list.value as unknown[];
    items.forEach((item, i) => {
      for (const h of written(select(item, rel.pick, `${list.path}[${i}]`))) {
        looked += 1;
        const n = h.value;
        if (typeof n !== "number" || !Number.isInteger(n)) {
          add(h.path, `번호가 아닙니다: ${show(n)}`);
        } else if (n < 0 || n >= items.length) {
          add(h.path, `${n} 입니다. ${list.path} 는 ${items.length}칸이라 0~${items.length - 1} 이어야 합니다.`);
        }
      }
    });
  }
  if (!looked) idle(rel.id, rel.pick, note);
}

/**
 * 표에서 **alias 가 아닌 열쇠**를 빼는 꼴. `{}` 는 숫자·글자 한 마디다.
 * ex) M05 `M05_Button.image` 에는 그림 alias 사이에 번호 딱지 `button_3_number` 가 섞여 있다.
 */
function skipped(skip: string[] | undefined, key: string): boolean {
  if (!skip) return false;
  return skip.some((s) => new RegExp(`^${s.split("{}").map(escape).join("[A-Za-z0-9]+")}$`).test(key));
}
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function isAlias(
  rel: Extract<SpecRelation, { kind: "isAlias" }>,
  root: unknown,
  rootName: string,
  aliases: Aliases,
  add: Add,
  note: Note,
): void {
  if (!aliases) return note(`alias 목록을 못 받아 관계 '${rel.id}' 가 안 돌았습니다.`);
  const found = select(root, rel.pick, rootName);
  if (!found.length) return idle(rel.id, rel.pick, note);
  // 표를 가리키면 그 열쇠나 값을 하나씩 편다. 길 문법을 안 늘리려고 여기서 한다.
  const hits = !rel.of
    ? found
    : written(found).flatMap((t) => {
        if (!isPlainObject(t.value)) {
          note(`${t.path} 가 표가 아니라 ${rel.of === "keys" ? "열쇠" : "값"}를 못 폈습니다: ${show(t.value)}`);
          return [];
        }
        return Object.entries(t.value)
          .filter(([k]) => !skipped(rel.skip, k))
          .map(([k, v]) => ({
            path: `${t.path}.${k}`,
            value: rel.of === "keys" ? k : v,
          }));
      });
  for (const h of written(hits)) {
    // 틀에 끼울 때는 번호(수)도 받는다 — button_{3}_basic.
    const ok = typeof h.value === "string" || (rel.template && typeof h.value === "number");
    if (!ok) {
      note(`${h.path} 가 글이 아니라 alias 인지 못 봤습니다: ${show(h.value)}`);
      continue;
    }
    const v = String(h.value);
    if (v === "") continue; // 빈 글은 「안 씀」이다
    for (const name of rel.template ? rel.template.map((t) => t.replace("{}", v)) : [v]) {
      const kinds = aliases.get(name);
      if (!kinds) {
        add(h.path, `'${name}' 가 AssetTable 에 없습니다.`);
      } else if (rel.as && !kinds.has(rel.as)) {
        add(h.path, `'${name}' 는 ${[...kinds].join("·")} 로만 등록돼 있습니다. ${rel.as} 여야 합니다.`);
      }
    }
  }
}

/** 이 이름들이 AssetTable 에 다 있어야 한다. 조건은 `when` 이 건다(없으면 늘). */
export function hasAlias(
  rel: Extract<SpecRelation, { kind: "hasAlias" }>,
  rootName: string,
  aliases: Aliases,
  add: Add,
  note: Note,
): void {
  if (!aliases) return note(`alias 목록을 못 받아 관계 '${rel.id}' 가 안 돌았습니다.`);
  for (const name of rel.names) {
    const kinds = aliases.get(name);
    if (!kinds || (rel.as && !kinds.has(rel.as))) add(rootName, `'${name}'${rel.as ? ` (${rel.as})` : ""} 가 AssetTable 에 없습니다.`);
  }
}

/**
 * 값이 `in` 표의 열쇠(객체)나 칸 값(배열)이어야 한다. 열쇠는 늘 글이라
 * **수도 글로 바꿔 견준다** — `answerCardIndex: 2` 와 `cards: {"2": …}` 가 맞는다.
 */
export function keyIn(
  rel: Extract<SpecRelation, { kind: "keyIn" }>,
  root: unknown,
  rootName: string,
  add: Add,
  note: Note,
): void {
  const tables = written(select(root, rel.in, rootName));
  if (!tables.length) return idle(rel.id, rel.in, note);
  const keys = new Set<string>();
  for (const t of tables) {
    if (isPlainObject(t.value)) for (const k of Object.keys(t.value)) keys.add(k);
    else if (Array.isArray(t.value)) for (const v of t.value) keys.add(String(v));
    else note(`${t.path} 가 표도 배열도 아니라 열쇠를 못 모았습니다: ${show(t.value)}`);
  }
  const hits = select(root, rel.pick, rootName);
  if (!hits.length) return idle(rel.id, rel.pick, note);
  for (const h of written(hits)) {
    if (typeof h.value !== "string" && typeof h.value !== "number") {
      note(`${h.path} 가 글이나 수가 아니라 견주지 못했습니다: ${show(h.value)}`);
      continue;
    }
    const v = String(h.value);
    for (const name of rel.template ? rel.template.map((t) => t.replace("{}", v)) : [v]) {
      if (keys.has(name)) continue;
      const some = [...keys].slice(0, 8).join(" · ");
      add(h.path, `'${name}' 가 ${rel.in} 에 없습니다 (있는 것: ${some}${keys.size > 8 ? " …" : ""}).`);
    }
  }
}

//
// **칸 수 견주기는 떼어 냈습니다** (2026-09-30, 210줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   relrefcount    배열 여럿의 칸 수가 같아야 (`sameCount`)

export { sameCount } from "./relrefcount";
