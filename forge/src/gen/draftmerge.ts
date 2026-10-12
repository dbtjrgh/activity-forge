// 사람이 쓴 글을 새 초안에 도로 얹기.
//
// `draft.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `draft.ts` 에서 가져다 씁니다.

import type { Spec, SpecField } from "./types";

// 자리가 몇 개인지. 배열 속·객체 속까지 셉니다.
export function countFields(fields: SpecField[]): number {
  let n = 0;
  for (const f of fields) {
    n++;
    if (f.fields) n += countFields(f.fields);
    if (f.of?.fields) n += countFields(f.of.fields);
  }
  return n;
}

// ─── 사람이 쓴 글 얹기 ───────────────────────────────────────────────────

// **제목을 채웠다고 스펙 전체가 얼면 안 됩니다.**
//
// 예전에는 `title` 이 있으면 사람 것으로 보고 `--force` 로도 안 덮었습니다.
// 그래서 `draft.ts` 를 일곱 군데 고쳐 GameData 재현을 65 → 113 으로 올린 날,
// 손으로 쓴 세 장(ANI·M27·M28)만 그 혜택을 하나도 못 받았습니다. M28 은
// `onStart` 마지막 줄이 빠진 채로 굳어 있다가 실물에서 터졌습니다 (2026-09-02).
//
// **잠글 것은 사람이 쓴 글이지 스펙 전체가 아닙니다.** 기계가 다시 뽑고,
// 사람 글은 자리(키 경로)를 맞춰 도로 얹습니다. 얹을 자리가 사라졌으면
// 버리지 않고 말해 줍니다 — 모듈이 바뀐 것일 수도 있으니까요.
// 자리마다 붙는 사람 글. `figmaBase` 도 여기 둡니다 — 「무엇을 기준으로 잰
// 좌표인가」는 표본을 봐서는 알 수 없어 기계가 못 뽑습니다.
const HUMAN_FIELD_KEYS = [
  "desc",
  "itemLabels",
  "minLengthWhy",
  "figmaBase",
] as const;

export function mergeHuman(
  fresh: Spec,
  old: Spec,
): { spec: Spec; kept: number; lost: string[] } {
  const lost: string[] = [];
  let kept = 0;

  // 스펙 한 장에 하나씩 있는 것.
  for (const k of ["title", "summary", "aliasNote"] as const) {
    const v = old[k];
    if (typeof v === "string" && v !== "") {
      (fresh as Record<string, unknown>)[k] = v;
      kept += 1;
    }
  }
  // 사람이 적는 것뿐이라 기계 것과 겨룰 일이 없습니다.
  // `reference`(표본 목록)는 뺍니다 — 그건 기계가 매번 새로 셉니다.
  for (const k of ["rules", "relations", "figma"] as const) {
    if (old[k] !== undefined) {
      (fresh as Record<string, unknown>)[k] = old[k];
      kept += 1;
    }
  }

  // 리소스 목록은 **통째로** 지킵니다.
  //
  // 초안은 `assets: { required: [] }` 빈 껍데기만 냅니다 — 「이 모듈이 어떤
  // 리소스를 반드시 요구하는가」는 모듈 소스를 읽어야 알 수 있어서 표본 견주기로는
  // 안 나옵니다. M28 의 `required` 8칸에 붙은 메모(`Character.ts:16 하드코딩` 같은)가
  // 그래서 사람 것입니다.
  const oldAssets = old.assets;
  const hasHand =
    (oldAssets?.required?.length ?? 0) > 0 ||
    oldAssets?.providedByModule !== undefined ||
    oldAssets?.defaults !== undefined;
  if (hasHand && oldAssets) {
    fresh.assets = oldAssets;
    kept += 1;
  }

  // 값 자리는 키 경로로 맞춥니다. **두 판으로 나눕니다.**
  //
  // `variants`(갈래)는 기계가 못 만듭니다 — 표본을 봐서는 「이 칸이 저 값일 때만
  // 나오는 자리」인지 알 수 없습니다. 그런데 갈래를 얹으면 그 **속에 있는 자리**가
  // 새로 생깁니다. 그래서 갈래를 먼저 얹고, 다시 훑은 뒤에 설명을 붙입니다.
  const oldAt = new Map<string, SpecField>();
  indexFields(old.gameData?.fields ?? [], "", oldAt);

  let freshAt = new Map<string, SpecField>();
  indexFields(fresh.gameData?.fields ?? [], "", freshAt);
  for (const [at, o] of oldAt) {
    if (!o.variants) continue;
    const f = freshAt.get(at);
    if (!f) continue;
    f.variants = o.variants;
    kept += 1;
  }
  freshAt = new Map<string, SpecField>();
  indexFields(fresh.gameData?.fields ?? [], "", freshAt);

  for (const [at, o] of oldAt) {
    const f = freshAt.get(at);
    for (const k of HUMAN_FIELD_KEYS) {
      const v = (o as Record<string, unknown>)[k];
      if (v === undefined || v === "") continue;
      if (!f) {
        lost.push(`${at}.${k}`);
        continue;
      }
      (f as Record<string, unknown>)[k] = v;
      kept += 1;
    }
  }

  return { spec: fresh, kept, lost };
}

function indexFields(
  list: SpecField[],
  at: string,
  out: Map<string, SpecField>,
): void {
  for (const f of list) {
    // 배열 칸(`of`)은 이름이 없습니다. 점을 덧붙이면 `…[].undefined` 가 됩니다.
    const here = f.key ? (at ? `${at}.${f.key}` : f.key) : at;
    out.set(here, f);
    if (f.fields) indexFields(f.fields, here, out);
    if (f.of) indexFields([f.of as SpecField], `${here}[]`, out);
    for (const c of f.variants?.cases ?? [])
      indexFields(c.fields, `${here}<${c.name}>`, out);
  }
}
