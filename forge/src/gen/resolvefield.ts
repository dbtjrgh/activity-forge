// 필드 해석 — 객체 한 겹 · 점 이름 묶기 · 필드 하나.
//
// 2026-09-30 에 `resolve.ts` 에서 옮김 — 960줄이라. **동작 변화 없음.** 입구(`resolveGameData`)와 전체 그림은 `resolve.ts`.

import type { SpecField, SpecVariants } from "./types";
import type { Ctx, Entry, Node } from "./resolve";
import { checkVariant, discriminatorKey, relaxed, variantUnused } from "./resolvevariant";
import { resolveValue } from "./resolvevalue";
import { err, isPlainObject, typeName, warn } from "./resolveissue";

// ─── 필드 해석 ───────────────────────────────────────────────────────────

export function resolveObject(
  fields: SpecField[],
  raw: unknown,
  path: string,
  ctx: Ctx,
  variants?: SpecVariants,
  series?: SpecField["series"],
): Node {
  const obj = isPlainObject(raw) ? raw : {};
  if (!isPlainObject(raw) && raw !== undefined) {
    err(ctx, "type", path, `객체여야 하는데 ${typeName(raw)} 입니다.`);
  }

  const entries: Entry[] = [];
  const used = new Set<string>();

  for (const f of fields) {
    const e = resolveEntry(f, obj, path, ctx);
    if (e) entries.push(e);
    used.add(f.key);
  }

  // 배리언트 — 판정 키가 있느냐 없느냐로 갈립니다.
  if (variants) {
    const disc = discriminatorKey(variants);
    const active = disc in obj ? variants.cases[0] : variants.cases[1];
    const other = disc in obj ? variants.cases[1] : variants.cases[0];
    if (active) {
      // **하나도 안 채워졌으면 「그것을 안 씁니다」입니다** (2026-09-16).
      // 아래 `variantUnused` 에 까닭이 적혀 있습니다. 「안 쓰는」 자리를
      // 필수라고 우기면 이미 나가 있는 액티비티가 막힙니다.
      const idle = variantUnused(active, disc, obj);
      const ease = (f: SpecField): SpecField => (idle ? relaxed(f) : f);
      for (const f of active.fields) {
        const top = f.key.split(".")[0]!;
        used.add(top);
        if (f.key.includes(".")) continue; // 아래에서 통째로 처리
        const e = resolveEntry(ease(f), obj, path, ctx);
        if (e) entries.push(e);
      }
      // ani.idle 처럼 점이 든 키는 중첩 객체 하나로 묶어 냅니다.
      for (const group of groupDotted(active.fields)) {
        used.add(group.key);
        const e = resolveEntry(ease(group), obj, path, ctx);
        if (e) entries.push(e);
      }
      checkVariant(active, other, disc, obj, path, ctx);
    }
    for (const c of variants.cases) for (const f of c.fields) used.add(f.key.split(".")[0]!);
  }

  // 번호로 늘어나는 열쇠(c1·c2·…). 몇 개인지는 스펙이 아니라 **값이** 정합니다.
  if (series) {
    const re = new RegExp(`^${series.prefix}(\\d+)$`);
    const numbered = Object.keys(obj)
      .map((k) => ({ key: k, n: Number(re.exec(k)?.[1] ?? NaN) }))
      .filter((x) => Number.isFinite(x.n))
      .sort((a, b) => a.n - b.n);
    // **번호 열쇠가 하나도 없으면 낱말 열쇠가 곧 칸이다** (2026-09-28). ENL3M01W2S2 의
    // cards 가 c1 이 아니라 brush·wash… 로 나가 있고, 이닝이 그 열쇠를 그대로 가리켜
    // 돈다. 번호만 세면 0개라 완성본이 막혔다. 번호가 이어지나는 번호 열쇠에만 본다.
    const nums = numbered.length
      ? numbered
      : Object.keys(obj).filter((k) => !used.has(k)).map((k, i) => ({ key: k, n: i + 1 }));

    if (series.min !== undefined && nums.length < series.min) {
      err(ctx, "minLength", path,
        `${series.label ?? series.prefix} 가 ${series.min}개 이상이어야 하는데 ${nums.length}개입니다.`);
    }
    // **번호가 이어져야 합니다.** c1·c2·c4 처럼 비면 어느 쪽이 맞는지 알 수
    // 없습니다 — 지우다 만 것일 수도, 이닝이 가리키는 열쇠가 사라진 것일 수도
    // 있습니다. 값은 그대로 두고 사람에게 넘깁니다.
    const gaps = nums.filter((x, i) => x.n !== i + 1);
    if (gaps.length) {
      warn(ctx, "series-gap", path,
        `${series.prefix}1 부터 이어지지 않습니다 — ${nums.map((x) => x.key).join(" · ")}`,
        "이닝이 가리키던 열쇠가 사라졌을 수 있습니다.");
    }
    for (const { key } of nums) {
      used.add(key);
      const e = resolveEntry({ ...series.of, key }, obj, path, ctx);
      if (e) entries.push(e);
    }
  }

  // 스펙에 없는 키 — 모듈이 조용히 무시하므로 경고하고, 값은 살려 둡니다.
  for (const key of Object.keys(obj)) {
    if (used.has(key)) continue;
    warn(
      ctx,
      "unknown-field",
      `${path}.${key}`,
      `스펙에 없는 키입니다. 모듈이 읽지 않습니다.`,
    );
    entries.push({
      key,
      node: { kind: "raw", js: JSON.stringify(obj[key]) },
      warn: "스펙에 없는 키 — 모듈이 읽지 않습니다",
    });
  }

  return { kind: "object", entries };
}

export function groupDotted(fields: SpecField[]): SpecField[] {
  const groups = new Map<string, SpecField[]>();
  for (const f of fields) {
    if (!f.key.includes(".")) continue;
    const [head, ...rest] = f.key.split(".");
    const list = groups.get(head!) ?? [];
    list.push({ ...f, key: rest.join(".") });
    groups.set(head!, list);
  }
  return [...groups].map(([key, fields]) => ({
    key,
    type: "object" as const,
    fields,
  }));
}

export function resolveEntry(
  f: SpecField,
  obj: Record<string, unknown>,
  parentPath: string,
  ctx: Ctx,
): Entry | null {
  const path = `${parentPath}.${f.key}`;
  const has = f.key in obj;
  let raw = obj[f.key];

  if (!has) {
    if (f.default !== undefined) {
      raw = f.default;
    } else if (f.required === true) {
      err(ctx, "required", path, `빠졌습니다. ${f.desc ?? ""}`.trim());
      return null;
    } else if (f.optional || f.requiredIf) {
      return null; // 조건부·선택 필드는 없으면 그냥 안 씁니다
    } else if (f.type === "object" || f.type === "array") {
      // 하위가 통째로 없는 경우도 스펙대로 껍데기를 냅니다
      raw = f.type === "array" ? [] : {};
    } else {
      return null;
    }
  }

  // 키는 있는데 값이 빈 문자열인 것도 「빠진 것」입니다.
  // 화면에서 칸만 만들어 두고 안 채운 경우가 여기 걸립니다.
  if (f.required === true && (raw === "" || raw === null || raw === undefined)) {
    err(ctx, "required", path, `비어 있습니다. ${f.desc ?? ""}`.trim());
  }

  return {
    key: f.key,
    node: resolveValue(f, raw, path, ctx),
    ...(f.desc ? { desc: f.desc } : {}),
  };
}

