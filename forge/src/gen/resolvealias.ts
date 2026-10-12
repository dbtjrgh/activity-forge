// alias 목록 — 이 액티비티가 쓸 수 있는 별칭 · fixedAlias 검사 · 번호로 짝인 무리 검사.
//
// 2026-09-30 에 `resolve.ts` 에서 옮김 — 960줄이라. **동작 변화 없음.** 입구(`resolveGameData`)와 전체 그림은 `resolve.ts`.

import type { AssetKind, Recipe, Spec } from "./types";
import { effectiveAssets } from "./spec";
import { followGaps, followNumbers } from "./aliasfollow";
import type { Ctx } from "./resolve";

// ─── alias 목록 ──────────────────────────────────────────────────────────

export function collectAliases(spec: Spec, recipe: Recipe): Map<string, Set<AssetKind>> {
  const map = new Map<string, Set<AssetKind>>();
  const kinds: AssetKind[] = ["image", "sound", "lottie", "font"];
  // **덮지 않고 보탭니다.** 한 이름이 그림이면서 소리일 수 있습니다.
  const add = (alias: string, kind: AssetKind) => {
    const set = map.get(alias) ?? new Set<AssetKind>();
    set.add(kind);
    map.set(alias, set);
  };

  // 모듈이 addAsset() 으로 이미 넣어 주는 것들
  const provided = spec.assets.providedByModule;
  if (provided) {
    for (const kind of kinds) {
      for (const alias of provided[kind] ?? []) add(alias, kind);
    }
  }
  // 액티비티가 AssetTable 에 넣을 것들 (스펙 defaults + 레시피)
  const assets = effectiveAssets(spec, recipe);
  for (const kind of kinds) {
    for (const a of assets[kind] ?? []) add(a.alias, kind);
  }
  return map;
}

// 스펙이 "이 alias 는 이름이 고정"이라고 못박은 것들이 실제로 등록됐는지.
// (M27 의 correct_ef 처럼 빠뜨려도 빌드가 통과하는 것들)
export function checkFixedAliases(ctx: Ctx): void {
  for (const req of ctx.spec.assets.required ?? []) {
    if (!req.fixedAlias) continue;
    if (!ctx.aliases.has(req.alias)) {
      ctx.issues.push({
        level: "error",
        rule: "fixed-alias-registered",
        path: `assets.${req.kind}`,
        message: `alias '${req.alias}' 가 없습니다. 이름이 고정된 자원입니다.`,
        ...(req.note ? { why: req.note } : {}),
      });
    }
  }
}

// 번호로 짝인 이름 무리 — `aliasfollow.ts`. 정하는 쪽이 하나도 없으면 안 본다(그 무리를 안 쓰는 회차).
export function checkAliasFollows(ctx: Ctx): void {
  for (const f of ctx.spec.aliasFollows ?? []) {
    if (!followNumbers(f.follows, ctx.aliases.keys()).size) continue;
    const { extra, lack } = followGaps(f, ctx.aliases.keys());
    if (!extra.length && !lack.length) continue;
    const say = [
      extra.length ? `${extra.join(" · ")} 는 짝이 없습니다` : "",
      lack.length ? `${f.alias.replace("{k}", lack.join("·"))} 가 빠졌습니다` : "",
    ].filter(Boolean).join(" · ");
    ctx.issues.push({
      level: "error",
      rule: "alias-follows",
      path: "assets",
      message: `${f.alias} 의 번호가 ${f.follows} 의 번호와 같아야 합니다 — ${say}.`,
      why: f.why ?? f.note,
    });
  }
}

