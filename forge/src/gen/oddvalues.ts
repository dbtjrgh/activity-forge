// GameData.ts — 하나만 다른 값 · 하나만 빠진 자리.
//
// `odd.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `odd.ts` 에서 가져다 씁니다.

import { compare, leavesOf, type Sample } from "./survey";
import type { Odd } from "./odd";

// ─── GameData.ts — 하나만 다른 값 · 하나만 빠진 자리 ─────────────────────
export function oddValues(users: Sample[], min: number): Odd[] {
  const usable = users.filter((s) => !s.note && s.data !== undefined);
  if (usable.length < min) return [];
  const n = usable.length;

  // 어느 자리를 볼지는 `compare()` 가 이미 가려 놨습니다.
  //   가끔 + 하나만 없음  → 「빠짐」 후보
  //   칸 + 값이 두 가지    → 「다름」 후보 (1대 나머지인지는 아래에서 봅니다)
  const stats = compare(usable);
  const universe = stats.map((s) => s.path);
  const missingAt = new Set(
    stats.filter((s) => s.kind === "가끔" && s.inSamples === n - 1).map((s) => s.path),
  );
  const differAt = new Set(
    stats
      .filter((s) => s.kind === "칸" && s.values.length === 2)
      // **배열 칸 수는 견주지 않습니다.** 이닝이 몇 개인지는 액티비티마다
      // 다른 것이 정상이라, 다섯 중 넷이 우연히 같으면 나머지 하나가 매번
      // 걸립니다. 칸 수가 무엇을 따라가야 하는지는 스펙의 관계(1-2)가 봅니다.
      .filter((s) => !s.path.endsWith("⟨칸 수⟩"))
      .map((s) => s.path),
  );
  if (!missingAt.size && !differAt.size) return [];

  // 후보 자리만 표본별로 다시 펼칩니다. 여기서 비로소 이름이 붙습니다.
  const at = new Map<string, Map<string, Set<string>>>(); // 자리 → 액티비티 → 값
  for (const u of usable) {
    for (const leaf of leavesOf(u.data)) {
      if (!missingAt.has(leaf.path) && !differAt.has(leaf.path)) continue;
      const bag = at.get(leaf.path) ?? new Map<string, Set<string>>();
      const set = bag.get(u.code) ?? new Set<string>();
      set.add(JSON.stringify(leaf.value) ?? "undefined");
      bag.set(u.code, set);
      at.set(leaf.path, bag);
    }
  }

  const out: Odd[] = [];
  const gone = new Map<string, string[]>(); // 액티비티 → 빠진 자리들

  for (const [p, bag] of at) {
    if (missingAt.has(p)) {
      const who = usable.find((u) => !bag.has(u.code));
      if (!who) continue;
      const list = gone.get(who.code) ?? [];
      list.push(p);
      gone.set(who.code, list);
      continue;
    }
    // **한 자리에 값이 여럿인 표본은 건너뜁니다.** 배열 안쪽 자리
    // (`inningData[].popup`)가 그렇습니다. 거기서 「하나만 다르다」를 말하려면
    // 이닝 번호를 따라가는 관계가 필요합니다 — 1-2 의 몫입니다.
    if ([...bag.values()].some((s) => s.size !== 1)) continue;
    if (bag.size !== n) continue;

    const byValue = new Map<string, string[]>();
    for (const [code, set] of bag) {
      const v = [...set][0] as string;
      const list = byValue.get(v) ?? [];
      list.push(code);
      byValue.set(v, list);
    }
    if (byValue.size !== 2) continue;
    const [lone, rest] = [...byValue.entries()].sort((a, b) => a[1].length - b[1].length);
    if (!lone || !rest || lone[1].length !== 1) continue;
    out.push({
      where: "GameData.ts",
      kind: "다름",
      code: lone[1][0] as string,
      what: p,
      mine: lone[0],
      others: rest[0],
      otherCodes: rest[1],
    });
  }

  for (const [code, paths] of gone) {
    for (const p of roll(paths, universe)) {
      out.push({
        where: "GameData.ts",
        kind: "빠짐",
        code,
        what: p,
        otherCodes: usable.map((u) => u.code).filter((c) => c !== code),
      });
    }
  }
  return out;
}

// 까닭 하나를 줄 하나로 말합니다.
//
// EN/E10 은 카드 다섯 벌(`cardAliasInfo.tshirt` …)이 통째로 다른 낱말이라
// 「빠진 자리」가 스무 줄로 나왔습니다. 까닭은 다섯입니다. 그래서 **그 아래가
// 통째로 없는 자리**를 찾아 그것으로 갈음합니다. 그 아래 일부만 없으면
// 갈음하지 않습니다 — 그때는 진짜로 그 자리들이 문제입니다.
function roll(missing: string[], universe: string[]): string[] {
  const miss = new Set(missing);
  const nodes = new Set<string>();
  for (const p of missing) for (const a of ancestors(p)) nodes.add(a);

  const cand = new Set(missing);
  for (const node of nodes) {
    const under = universe.filter((u) => isUnder(u, node));
    if (under.length && under.every((u) => miss.has(u))) cand.add(node);
  }
  const list = [...cand];
  return list.filter((p) => !list.some((q) => isUnder(p, q)));
}

// `cardAliasInfo.tshirt.front` → `cardAliasInfo` · `cardAliasInfo.tshirt`
function ancestors(p: string): string[] {
  const base = p.replace(/ ⟨칸 수⟩$/, "");
  const out = new Set<string>();
  const re = /\.|\[\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(base))) {
    if (m.index > 0) out.add(base.slice(0, m.index));
    if (m[0] === "[]") out.add(base.slice(0, m.index + 2));
  }
  out.delete(base);
  return [...out];
}

// `⟨칸 수⟩` 는 배열 자신을 가리키는 자리라 이름에서 떼고 견줍니다 —
// `a ⟨칸 수⟩` 는 `a` 아래이고, `a[].b` 의 형제가 아니라 부모 쪽입니다.
function isUnder(p: string, node: string): boolean {
  const base = p.replace(/ ⟨칸 수⟩$/, "");
  if (base === node) return p !== node;
  return base.startsWith(node + ".") || base.startsWith(node + "[]");
}
