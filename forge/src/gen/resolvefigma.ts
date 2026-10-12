// figma 좌표 풀기 — {fx, fy, w, h} → {x, y} · 무엇에 붙은 좌표인가.
//
// 2026-09-30 에 `resolve.ts` 에서 옮김 — 960줄이라. **동작 변화 없음.** 입구(`resolveGameData`)와 전체 그림은 `resolve.ts`.

import type { SpecField } from "./types";
import { isFigmaPoint, isPoint, toCanvasPoint } from "./spec";
import type { Ctx } from "./resolve";
import { atPath, err, round2 } from "./resolveissue";

// ─── 잡동사니 ────────────────────────────────────────────────────────────

// {fx, fy, w, h, ...나머지} → {...나머지, x, y}.
// figma 값은 남기지 않습니다 — 남으면 「스펙에 없는 키」로 잡힙니다.
export function unfigmaXY(f: SpecField, raw: unknown, path: string, ctx: Ctx): unknown {
  if (!isFigmaPoint(raw)) return raw;
  const p = toCanvasPoint(raw, ctx.spec.figma?.defaultAnchor);
  const b = figmaBase(f, path, ctx);
  const rest: Record<string, unknown> = {};
  const drop = new Set(["fx", "fy", "w", "h", "anchorX", "anchorY"]);
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!drop.has(k)) rest[k] = v;
  }
  return { ...rest, x: round2(p.x - b.x), y: round2(p.y - b.y) };
}

// 무엇에 붙어 다니는 좌표인지. 안 적혀 있으면 화면 한가운데(0,0)입니다.
export function figmaBase(f: SpecField, path: string, ctx: Ctx): { x: number; y: number } {
  const spec = f.figmaBase;
  if (!spec) return { x: 0, y: 0 };
  let p = { x: 0, y: 0 };
  if (spec.field) {
    const raw = atPath(ctx.root, spec.field);
    if (isPoint(raw) || isFigmaPoint(raw)) {
      p = toCanvasPoint(raw, ctx.spec.figma?.defaultAnchor);
    } else {
      // 기준을 못 찾으면 화면 기준으로 계산돼 엉뚱한 자리에 놓입니다.
      // 조용히 넘어가면 브라우저에서야 알게 되므로 여기서 잡습니다.
      err(ctx, "figma-base-missing", path,
        `figma 로 적었는데 기준 좌표 '${spec.field}' 를 찾지 못했습니다.`,
        "이 값은 그 자리에 붙어 다니는 좌표라 기준이 있어야 계산됩니다.");
    }
  }
  return { x: p.x + (spec.offset?.x ?? 0), y: p.y + (spec.offset?.y ?? 0) };
}

