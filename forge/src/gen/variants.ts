// 모듈 안 갈래 — 스펙 `variantKey` 가 가리키는 값으로 모듈이 다른 구현(클래스 · 파일)을 고른다 (2026-10-13).
//
// 9호 MAL1M08W4S3(M01)은 이닝마다 문항 유형을 골라 만든다 — `settings.typeList` 의 이름으로 InningManager 가
// type1_1.ts · type2.ts · type3_2.ts … 를 만든다. 완성본마다 쓴 유형 묶음이 다르다(원본 MAL1M07W4S3 은 type3_1 다섯 이닝,
// type2 는 MAL2M01W4S3 하나, type3_2 는 MAL2M02W4S3 · MAL3M02W4S3 둘). 대화로 만들기가 원본과 같은 칸 L1 다섯 곳만 열어 줘서
// Claude 는 type2 · type3_2 를 만든 완성본을 못 보고 체크박스 · 스피커 · 숫자 그림을 사람에게 물었다.
// 그래서 스펙에 그 자리를 적고, 대화가 열 완성본을 고를 때 **값마다 그 값을 쓴 완성본 하나는 열리게** 한다(앱 `chatothers.ts`).
//
// - 값은 **대소문자를 가리지 않는다** — M01 `inningData[].type` 에 `type1_3` · `Type1_3` 이 섞여 있다(MAL1M03W4S3 · MAL2M03W4S3)
// - 모든 완성본이 같은 값 묶음을 쓰는 모듈은 표가 할 일이 없다 — 그래도 적어 두면 부르는 쪽이 「다 같다」로 안다
// - 읽기만 한다. 파일을 못 읽은 완성본은 값이 없는 것으로 둔다(부르는 쪽이 그 완성본을 덮개로 안 쓴다)

import { loadSpec, resolveModule } from "./spec";
import { select } from "./relpath";
import { readGameData } from "./surveyread";
import type { Spec } from "./types";

/** 스펙 자리의 값 — 처음 나온 차례로, 겹치지 않게, 소문자로. `ignore` 는 뺀다. 자리가 없으면 빈 목록 */
export function variantValues(spec: Spec, root: string, data: unknown): string[] {
  const key = spec.variantKey;
  if (!key) return [];
  const skip = new Set((key.ignore ?? []).map((x) => x.toLowerCase()));
  const out: string[] = [];
  for (const h of select(data, key.path, root)) {
    if (typeof h.value !== "string" && typeof h.value !== "number") continue;
    const v = String(h.value).toLowerCase();
    if (!skip.has(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

export type VariantTable = {
  path: string;
  note: string;
  /** 학습코드 → 쓴 값. 못 읽은 완성본은 빈 목록 */
  byCode: Map<string, string[]>;
};

/** 완성본들이 쓴 값. 스펙에 `variantKey` 가 없거나 스펙을 못 읽으면 null */
export function variantTable(subject: string, module: string, acts: { code: string; dir: string }[]): VariantTable | null {
  let spec: Spec;
  try {
    spec = loadSpec(subject, resolveModule(subject, module));
  } catch {
    return null;
  }
  if (!spec.variantKey) return null;
  const byCode = new Map<string, string[]>();
  for (const a of acts) {
    let got: string[] = [];
    try {
      const g = readGameData(a.dir);
      if (g) got = variantValues(spec, g.root, g.data);
    } catch {
      got = [];
    }
    byCode.set(a.code, got);
  }
  return { path: spec.variantKey.path, note: spec.variantKey.note, byCode };
}

/**
 * 값을 빠짐없이 덮게 완성본을 고른다. `order` 는 추천 차례(같은 칸 · 가까운 호 — `layoutorigin.ts`), `have` 는 이미 열린 것(원본)의 값.
 * **새로 덮는 값이 제일 많은 것을 먼저, 같으면 추천 차례** — 차례대로 하나씩 받으면 같은 칸 L1 다섯 곳을 다 받고 cap 에 걸린다.
 * `cap` 개를 넘으면 그만두고 못 덮은 값을 돌려준다(부르는 쪽이 알린다)
 */
export function coverValues(
  order: string[],
  byCode: Map<string, string[]>,
  have: Iterable<string>,
  cap: number,
): { picked: string[]; missing: string[] } {
  const all = new Set<string>();
  for (const c of order) for (const v of byCode.get(c) ?? []) all.add(v);
  const covered = new Set(have);
  const left = (): string[] => [...all].filter((v) => !covered.has(v));
  const picked: string[] = [];
  while (picked.length < cap && left().length) {
    let best = "";
    let gain = 0;
    for (const c of order) {
      if (picked.includes(c)) continue;
      const g = (byCode.get(c) ?? []).filter((v) => !covered.has(v)).length;
      if (g > gain) (best = c), (gain = g);
    }
    if (!best) break;
    picked.push(best);
    for (const v of byCode.get(best) ?? []) covered.add(v);
  }
  return { picked, missing: left() };
}
