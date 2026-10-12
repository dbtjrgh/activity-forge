// 견주기 — 표본끼리 자리마다 값 · 타입.
//
// `survey.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `survey.ts` 에서 가져다 씁니다.

import type { Sample } from "./survey";
import { isPlainObject } from "./surveyread";

// ─── 견주기 ──────────────────────────────────────────────────────────────

// 표본을 나란히 놓고 자리마다 「늘 같은 값인가, 매번 다른가」를 가립니다.
//
// 스펙을 쓸 때 정작 정해야 하는 것이 이것뿐입니다.
//   늘 같다  → 스펙에 박아 둡니다. 사람이 볼 일 없습니다.
//   다르다   → 입력칸으로 냅니다. 액티비티마다 새로 적을 값입니다.
//   더러 없다 → optional 입니다.
// 손으로 M27·M28 스펙을 쓸 때 제가 눈으로 하던 일이라, 기계에 넘깁니다.

export type FieldStat = {
  path: string; // inningData[].question 처럼 뿌리에서 센 자리
  kind: "고정" | "칸" | "가끔";
  inSamples: number; // 이 자리가 있던 표본 수
  total: number; // 전체 표본 수
  values: string[]; // 서로 다른 값들. JSON 글자꼴
  type: string; // string · number · bool · 좌표 · 식 · 섞임
};

export function compare(samples: Sample[]): FieldStat[] {
  const usable = samples.filter((s) => !s.note && s.data !== undefined);
  const order: string[] = []; // 처음 나온 차례를 지킵니다. 가나다순보다 읽기 쉽습니다.
  const seenPath = new Set<string>();
  const hits = new Map<string, number>(); // 자리 → 그 자리가 있던 표본 수
  const vals = new Map<string, Map<string, unknown>>(); // 자리 → 서로 다른 값

  for (const s of usable) {
    const leaves: Leaf[] = [];
    walk(s.data, "", leaves);
    const here = new Set<string>();
    for (const leaf of leaves) {
      if (!seenPath.has(leaf.path)) {
        seenPath.add(leaf.path);
        order.push(leaf.path);
      }
      here.add(leaf.path);
      const bag = vals.get(leaf.path) ?? new Map<string, unknown>();
      bag.set(JSON.stringify(leaf.value) ?? "undefined", leaf.value);
      vals.set(leaf.path, bag);
    }
    // 한 표본 안에서 배열 때문에 여러 번 나와도 「있었다」는 한 번만 셉니다.
    for (const p of here) hits.set(p, (hits.get(p) ?? 0) + 1);
  }

  const total = usable.length;
  return order.map((path) => {
    const bag = vals.get(path) ?? new Map();
    const inSamples = hits.get(path) ?? 0;
    const values = [...bag.keys()];
    const kind: FieldStat["kind"] =
      inSamples < total ? "가끔" : values.length === 1 ? "고정" : "칸";
    return { path, kind, inSamples, total, values, type: typeOf([...bag.values()]) };
  });
}

export type Leaf = { path: string; value: unknown };

// 값 하나를 자리별로 펼친 것. **`compare` 가 안에서 쓰는 것과 같은 것**입니다.
//
// `compare` 는 자리별 통계만 내놓아 「어느 표본이 그랬나」를 알 수 없습니다.
// 스펙을 쓸 때는 그것으로 됩니다 — 자리의 성격만 알면 되니까요. 그런데
// 「혼자만 다른 것」 검사(`gen/odd.ts`)는 **표본 이름을 대야** 합니다.
// 펼치는 규칙이 갈리면 두 검사가 서로 다른 자리를 가리키므로 여기 것을 내줍니다.
export function leavesOf(data: unknown): Leaf[] {
  const out: Leaf[] = [];
  walk(data, "", out);
  return out;
}

// 값 하나를 자리별로 펼칩니다.
//
// 배열은 칸 번호를 지웁니다 — `inningData[0].question` 과 `[1].question` 은
// 같은 자리로 봐야 「매번 다른 값」이라는 것이 드러납니다. 대신 배열이 몇 칸
// 이었는지는 따로 한 줄 남깁니다. 스펙의 minLength 를 정할 때 쓰는 값입니다.
function walk(v: unknown, path: string, out: Leaf[]): void {
  if (Array.isArray(v)) {
    out.push({ path: path + " ⟨칸 수⟩", value: v.length });
    for (const item of v) walk(item, path + "[]", out);
    return;
  }
  if (isPlainObject(v)) {
    // 계산식으로 적힌 자리. 더 파고들 것이 없습니다.
    if ("__expr" in v) {
      out.push({ path, value: v });
      return;
    }
    // {x, y} 는 쪼개지 않고 좌표 한 덩이로 봅니다. 스펙에도 point 로 적습니다.
    const keys = Object.keys(v);
    if (keys.length === 2 && "x" in v && "y" in v) {
      out.push({ path, value: v });
      return;
    }
    if (keys.length === 0) {
      out.push({ path, value: v });
      return;
    }
    for (const k of keys) walk(v[k], path ? path + "." + k : k, out);
    return;
  }
  out.push({ path, value: v });
}

function typeOf(values: unknown[]): string {
  const kinds = new Set(values.map(oneType));
  if (kinds.size === 0) return "?";
  if (kinds.size === 1) return [...kinds][0] as string;
  return "섞임(" + [...kinds].join("·") + ")";
}

function oneType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (isPlainObject(v)) {
    if ("__expr" in v) return "식";
    if ("x" in v && "y" in v) return "좌표";
    return "object";
  }
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return "number";
  return typeof v;
}
