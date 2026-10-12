// 타입 알아내기 · 값 꼴 가름.
//
// `draft.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `draft.ts` 에서 가져다 씁니다.

import type { AssetKind, SpecField } from "./types";
import { assetAliases, type Sample } from "./survey";

// ─── 타입 알아내기 ───────────────────────────────────────────────────────

export type AssetIndex = Map<string, AssetKind>;

export function assetIndex(samples: Sample[]): AssetIndex {
  // 별칭 이름이 액티비티마다 겹칠 수 있습니다. 많이 나온 갈래를 그 별칭의 갈래로 봅니다.
  const tally = new Map<string, Map<AssetKind, number>>();
  for (const s of samples) {
    for (const [alias, kinds] of assetAliases(s.dir)) {
      const bag = tally.get(alias) ?? new Map<AssetKind, number>();
      for (const kind of kinds) bag.set(kind, (bag.get(kind) ?? 0) + 1);
      tally.set(alias, bag);
    }
  }
  // 갈래가 하나로 정해지는 별칭만 씁니다.
  //
  // 액티비티마다 같은 이름을 다른 갈래로 쓰는 자리가 있습니다 —
  // PlaySparkLv2M2 의 `name` 은 어떤 표본에서 image, 다른 표본에서 lottie 였습니다.
  // 많이 나온 쪽으로 정했더니 「image 자리인데 lottie 로 등록돼 있습니다」로
  // 검사에서 걸렸습니다. 애매한 것은 아예 모르는 것으로 칩니다 — 그러면
  // 그 자리는 asset 이 아니라 string 이 되고, 틀린 말을 하지 않습니다 (2026-09-01).
  const out: AssetIndex = new Map();
  for (const [alias, bag] of tally) {
    if (bag.size !== 1) continue;
    const only = [...bag.keys()][0];
    if (only) out.set(alias, only);
  }
  return out;
}

// `_at`(그 값이 있던 자리 이름)은 아직 안 씁니다. 값만 보고 판정하는데,
// 자리 이름까지 보면 `*Path`·`*Nar` 처럼 이름으로 종류를 가릴 수 있습니다.
// 부르는 쪽이 이미 자리 이름을 들고 있으니 매개변수는 남겨 둡니다.
export function scalarType(
  values: unknown[],
  _at: string,
  assets: AssetIndex,
): SpecField["type"] {
  if (values.every((v) => typeof v === "boolean")) return "bool";
  if (values.every((v) => typeof v === "number")) return "number";
  if (!values.every((v) => typeof v === "string")) return "string";

  const strings = (values as string[]).filter((s) => s !== "");
  if (!strings.length) return "string";

  // 리소스 별칭인가. 빈 값은 빼고 셉니다 — `bg: ""` 처럼 안 쓰는 자리가 흔합니다.
  const kinds = new Map<AssetKind, number>();
  let known = 0;
  for (const s of strings) {
    const k = assets.get(s);
    if (!k) continue;
    known++;
    kinds.set(k, (kinds.get(k) ?? 0) + 1);
  }
  // 갈래가 **하나로 모여야** 리소스 자리라고 부릅니다.
  //
  // 많이 나온 쪽으로 정하면, 표본 대부분이 그림이고 하나가 로티인 자리를
  // `asset:image` 로 적게 됩니다. 그러면 그 하나짜리 액티비티는 제 스펙으로
  // 검사조차 통과 못 합니다 (E25 의 mySound, M22 의 drag). 갈리면 그냥
  // string 으로 둡니다 — 덜 말하는 편이 틀리게 말하는 것보다 낫습니다 (2026-09-01).
  // 그리고 **하나도 빠짐없이** 등록된 별칭이어야 합니다.
  //
  // 「거의 다 별칭이면 리소스 자리」로 봤더니, M01 의 narrationType 이 걸렸습니다.
  // 값이 대개 나레이션 별칭이지만 'ending' 이 섞여 있습니다 — 그건 리소스가
  // 아니라 **종류 이름**입니다. 그걸 asset:sound 로 적으면 앞으로 'ending' 을
  // 쓰는 액티비티는 만들 수조차 없습니다. 하나라도 모르는 값이 있으면
  // 리소스 자리가 아니라고 봅니다 (2026-09-01).
  const only = kinds.size === 1 ? [...kinds.keys()][0] : null;
  if (only && known === strings.length)
    return `asset:${only}` as SpecField["type"];

  // 몇 안 되는 값만 돌려 쓰면 고르는 칸입니다(M27 의 slide: top/bottom/…).
  const distinct = new Set(values as string[]);
  if (distinct.size <= 5 && values.length >= 6) return "enum";
  return "string";
}


// ─── 잔손 ────────────────────────────────────────────────────────────────

// 「같은 모양인가」를 가릴 때 쓰는 이름. `typeof` 만으로는 배열과 null 이
// 다 "object" 라 갈리지 않습니다.
export function shapeOf(v: unknown): string {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  if (isPlainObject(v)) return "object";
  return typeof v;
}

// 값이 아니라 코드가 적힌 자리. `survey.ts` 가 남기는 표시입니다.
export function isExpr(v: unknown): v is { __expr: string } {
  return isPlainObject(v) && typeof v.__expr === "string";
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isPoint(v: unknown): boolean {
  return (
    isPlainObject(v) && Object.keys(v).length === 2 && "x" in v && "y" in v
  );
}

export function isEmptyish(v: unknown): boolean {
  if (v === "" || v === null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (isPlainObject(v)) return Object.keys(v).length === 0;
  return false;
}
