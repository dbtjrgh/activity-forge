// 배리언트 검사 — 고른 꼴의 필드가 다 있나 · 안 쓰는 꼴인가.
//
// 2026-09-30 에 `resolve.ts` 에서 옮김 — 960줄이라. **동작 변화 없음.** 입구(`resolveGameData`)와 전체 그림은 `resolve.ts`.

import type { SpecField, SpecVariants } from "./types";
import type { Ctx } from "./resolve";
import { err, isPlainObject, warn } from "./resolveissue";

// ─── 배리언트 검사 ───────────────────────────────────────────────────────

/**
 * 이 갈래를 **안 쓰는 것**인가.
 *
 * 갈림 열쇠(M27 의 `ani`)가 아예 없는 쪽은 사람이 **고른 것이 아니라 기본으로
 * 떨어진 것**입니다. 그 쪽의 필수 값이 하나도 안 채워져 있으면 「이 자리를
 * 안 씁니다」라는 뜻이지, 빠뜨린 것이 아닙니다.
 *
 * **표본으로 재고 넣었습니다** (2026-09-16, `forge/CLAUDE.md` 의 「막는 검사는
 * 표본 전부를 통과해야만 넣는다」). M27 을 쓰는 액티비티 24개 가운데 —
 *
 *   9개  `quiz.bg` 의 alias·alias_correct 가 **둘 다 빈 글** (안 쓰는 것)
 *   9개  둘 다 채움
 *   6개  `ani` 방식
 *   0개  반쯤 채운 것
 *
 * 즉 비면 다 비고 채우면 다 채웁니다. 그런데 이 검사가 그 **아홉을 막고**
 * 있었고, 8호에서는 세 차시에 요구 카드 열두 장으로 나왔습니다.
 *
 * **갈림 열쇠가 있는 쪽은 그대로 막습니다.** `ani` 키를 두고 속을 비우면
 * `QuizPanel.ts:118` 의 `hasOwnProperty` 가 애니 경로를 태워 진짜로 깨집니다 —
 * 그것은 「안 쓴다」가 아니라 빠뜨린 것입니다.
 */
export function variantUnused(
  active: SpecVariants["cases"][number],
  disc: string,
  obj: Record<string, unknown>,
): boolean {
  if (disc in obj) return false;
  const required = active.fields.filter((f) => f.required === true);
  if (required.length === 0) return false;
  return required.every((f) => {
    const value = dig(obj, f.key);
    return value === undefined || value === "";
  });
}

/** 필수를 풀어 둔 사본. 안 쓰는 갈래의 값은 그대로 내보내되 막지 않습니다. */
export function relaxed(f: SpecField): SpecField {
  return {
    ...f,
    required: false,
    optional: true,
    ...(f.fields ? { fields: f.fields.map(relaxed) } : {}),
  };
}

export function discriminatorKey(v: SpecVariants): string {
  // "ani 키의 존재 여부" → "ani"
  return v.cases[0]?.name ?? v.discriminator.split(" ")[0]!;
}

export function checkVariant(
  active: SpecVariants["cases"][number],
  other: SpecVariants["cases"][number] | undefined,
  disc: string,
  obj: Record<string, unknown>,
  path: string,
  ctx: Ctx,
): void {
  // 고른 쪽의 필수 값이 비어 있으면 안 됩니다.
  // (M27 의 ani:{idle:'',talk:'',correct:''} 같은 빈 플레이스홀더가 여기서 걸립니다)
  //
  // **다만 하나도 안 채워졌으면 「그것을 안 씁니다」입니다** (`variantUnused`).
  if (variantUnused(active, disc, obj)) return;
  for (const f of active.fields) {
    if (f.required !== true) continue;
    const value = dig(obj, f.key);
    if (value === undefined || value === "") {
      err(
        ctx,
        disc in obj ? "no-empty-ani-placeholder" : "image-variant-needs-alias",
        `${path}.${f.key}`,
        `'${active.name}' 방식을 골랐으면 비어 있으면 안 됩니다.`,
      );
    }
  }
  // 안 고른 쪽 값이 남아 있으면 헷갈립니다.
  for (const f of other?.fields ?? []) {
    const top = f.key.split(".")[0]!;
    if (top === disc) continue;
    const value = obj[top];
    if (value !== undefined && value !== "") {
      warn(
        ctx,
        "variant-leftover",
        `${path}.${top}`,
        `'${active.name}' 방식인데 '${other!.name}' 쪽 값이 남아 있습니다. 읽히지 않습니다.`,
      );
    }
  }
}

export function dig(obj: Record<string, unknown>, dotted: string): unknown {
  let cur: unknown = obj;
  for (const part of dotted.split(".")) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

