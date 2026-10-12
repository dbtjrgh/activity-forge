/**
 * **폴더가 꼬리 칸을 없애라고 말하나** — 원본을 베낀 배열의 꼬리 칸이 가리키는 파일이
 * 이 회차 폴더에 없고, 그 무리 파일이 딱 앞 칸 수만큼만 있는 자리 (2026-09-28).
 *
 *   ENL3M07W3S1  원본(6호) 거품 5칸 · 이 회차 폴더 `icon01~04.png` → 4칸으로 보인다
 *
 * 조건 — 꼬리 칸 k..n-1 이 다 「죽은 칸」이고 앞 칸 0..k-1 은 다 아니다. 그리고
 * 칸마다 그 무리(`images/icon#.png`) 파일을 **딱 하나씩** 가리키며, 앞 칸 것은 폴더에
 * 다 있고, 폴더의 그 무리 파일 수가 k 와 같다. 죽은 칸 = 가리키는 파일이 폴더에 없고,
 * 그 무리의 형제가 폴더에 있고, 그 무리에 레시피가 안 가리키는 남는 파일이 없다.
 *
 * **짐작이지 판정이 아니다.** 완성본 495쌍에 대 보니 걸린 29자리 중 18만 완성본 칸 수와
 * 맞았다(`tool/tailwit.ts`) — 폴더에 파일이 덜 들어 있거나 이름이 다른 회차가 있다.
 * 그래서 **카드로만 쓴다.** 저절로 줄이지 않는다. 줄이기만 본다 — 늘어난 칸은 폴더에 증인이 없다.
 */

import { familyOf } from "./swap";

export type TailHint = { where: string; from: number; to: number; family: string };

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

/** 값 안의 배열 자리 전부 — 길(`a.b[1].c`, 뿌리 이름 없이) → 배열 */
export function arraysOf(v: unknown, at = "", out = new Map<string, unknown[]>()): Map<string, unknown[]> {
  if (Array.isArray(v)) {
    out.set(at, v);
    v.forEach((x, i) => arraysOf(x, `${at}[${i}]`, out));
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) arraysOf(x, at ? `${at}.${k}` : k, out);
  }
  return out;
}

/**
 * `rels` 는 레시피 자리(`갈래|별칭`) → 폴더 안 경로(`common.relOf`), `folder` 는 이 회차
 * 폴더의 파일 전부(`images/icon01.png`, 소문자).
 */
export function tailHints(gameData: unknown, rels: Map<string, string>, folder: Set<string>): TailHint[] {
  const refOf = new Map<string, string[]>();
  for (const [slot, rel] of rels) {
    const alias = slot.slice(slot.indexOf("|") + 1);
    refOf.set(alias, [...(refOf.get(alias) ?? []), rel.toLowerCase()]);
  }
  const claimed = new Set([...rels.values()].map((r) => r.toLowerCase()));
  const kinOf = new Map<string, string[]>();
  for (const f of folder) kinOf.set(familyOf(f), [...(kinOf.get(familyOf(f)) ?? []), f]);
  const refs = (cell: unknown): string[] => strings(cell).flatMap((s) => refOf.get(s) ?? []);
  const dead = (cell: unknown): boolean =>
    refs(cell).some((rel) => {
      if (folder.has(rel)) return false;
      const kin = kinOf.get(familyOf(rel)) ?? [];
      return kin.length > 0 && kin.every((f) => claimed.has(f));
    });

  const out: TailHint[] = [];
  for (const [where, arr] of arraysOf(gameData)) {
    if (arr.length < 2) continue;
    const d = arr.map(dead);
    const k = d.indexOf(true);
    if (k < 1 || d.slice(k).some((x) => !x)) continue; // 꼬리가 아니면 말하지 않는다
    const fams = new Set(refs(arr[k]).filter((r) => !folder.has(r)).map(familyOf));
    const family = [...fams].find((fam) => {
      const per = arr.map((c) => refs(c).filter((r) => familyOf(r) === fam));
      if (per.some((p) => p.length !== 1)) return false;
      if (per.slice(0, k).some((p) => !folder.has(p[0] as string))) return false;
      return (kinOf.get(fam) ?? []).length === k;
    });
    if (family) out.push({ where, from: arr.length, to: k, family });
  }
  return out;
}
