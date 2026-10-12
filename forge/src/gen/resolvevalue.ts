// 값 하나 해석 — 스펙 타입에 맞추고 figma 좌표를 캔버스로, 어긋나면 issues 에.
//
// 2026-09-30 에 `resolve.ts` 에서 옮김 — 960줄이라. **동작 변화 없음.** 입구(`resolveGameData`)와 전체 그림은 `resolve.ts`.

import type { AssetKind, SpecField } from "./types";
import { isFigmaPoint, isPoint, toCanvasPoint } from "./spec";
import type { Ctx, Entry, Node } from "./resolve";
import { resolveObject } from "./resolvefield";
import { unfigmaXY } from "./resolvefigma";
import { coord, err, isExpr, isPlainObject, typeName, warn } from "./resolveissue";

export function resolveValue(
  f: SpecField,
  raw: unknown,
  path: string,
  ctx: Ctx,
): Node {
  // 사람이 JS 로 적어 둔 자리는 검사하지 않고 그대로 내보냅니다.
  //
  // `y: 187.91 +20` 이나 `-Math.PI / 180` 같은 것입니다. `survey.ts` 가
  // `{ __expr: "…" }` 로 남기는데, 여기서 받아 줄 데가 없어 스펙의 타입과
  // 부딪쳤습니다. 값이 아니라 **코드**라 타입으로 걸러 낼 수가 없습니다 —
  // 걸러 내려면 JS 를 실행해 봐야 합니다.
  //
  // 이것 하나가 그 자리 **전체**를 망가뜨리고 있었습니다. 표본 20개 중 하나에
  // `+20` 이 붙어 있으면 그 자리는 숫자가 아니게 되고, 스펙이 `string` 으로
  // 적히고, 나머지 19개가 죄다 따옴표를 뒤집어씁니다 (2026-09-02).
  if (isExpr(raw)) return { kind: "raw", js: raw.__expr };

  // `null` 은 「이 칸은 비었다」입니다. 타입에 맞추려 들면 `""` 나 `0` 이 되는데,
  // 모듈이 `if (x === null)` 로 가르는 자리면 뜻이 뒤집힙니다. 그대로 씁니다.
  // 필수인 자리에 비어 있는 것은 이 앞(`resolveEntry`)에서 이미 걸러냈습니다.
  if (raw === null) return { kind: "raw", js: "null" };

  // `mixed` 는 「이 자리는 모양이 하나가 아니다」입니다. 배열은 `of` 를 안 적는
  // 것으로 칸마다 그대로 쓰고(아래 array 갈래), 나머지는 여기서 통째로 씁니다.
  if (f.mixed === true && f.type !== "array") {
    return { kind: "raw", js: JSON.stringify(raw) };
  }

  switch (f.type) {
    case "object":
      // figma: true 인 객체는 좌표 말고 다른 값도 함께 든 것입니다
      // (quizItemPos 의 {x, y, scale} 처럼). x·y 만 figma 로 받아 바꿔 넣습니다.
      return resolveObject(
        f.fields ?? [], f.figma ? unfigmaXY(f, raw, path, ctx) : raw,
        path, ctx, f.variants, f.series);

    case "array": {
      if (!Array.isArray(raw)) {
        err(ctx, "type", path, `배열이어야 하는데 ${typeName(raw)} 입니다.`);
        return { kind: "array", items: [] };
      }
      if (f.minLength !== undefined && raw.length < f.minLength) {
        err(ctx, "minLength", path, `${f.minLength}개 이상이어야 하는데 ${raw.length}개입니다.`,
          f.minLengthWhy);
      }
      // `of` 가 없는 것은 **칸마다 모양이 달라 하나로 못 부른 칸**입니다.
      // 그대로 씁니다. 식은 JSON 으로 굳으면 코드가 아니라 글자가 되니 따로 봅니다.
      const of = f.of;
      const items = raw.map((v, i) =>
        of
          ? resolveValue(of as SpecField, v, `${path}[${i}]`, ctx)
          : ({ kind: "raw", js: isExpr(v) ? v.__expr : JSON.stringify(v) } as Node),
      );
      return { kind: "array", items };
    }

    case "point": {
      if (!isPoint(raw) && !isFigmaPoint(raw)) {
        err(ctx, "type", path, `좌표는 {x,y} 또는 {fx,fy,w,h} 여야 합니다.`);
        return { kind: "raw", js: "{ x: 0, y: 0 }" };
      }
      const converted = isFigmaPoint(raw);
      const p = toCanvasPoint(raw, ctx.spec.figma?.defaultAnchor);
      return {
        kind: "raw",
        js: `{ x: ${coord(p.x)}, y: ${coord(p.y)} }`,
        ...(converted
          ? { desc: `figma(${(raw as any).fx},${(raw as any).fy} ${(raw as any).w}x${(raw as any).h}) 에서 계산` }
          : {}),
      };
    }

    case "posTable": {
      if (!isPlainObject(raw)) {
        err(ctx, "type", path, `{개수: [좌표...]} 형태여야 합니다.`);
        return { kind: "object", entries: [] };
      }
      const entries: Entry[] = [];
      for (const [count, list] of Object.entries(raw)) {
        if (!Array.isArray(list)) {
          err(ctx, "type", `${path}.${count}`, `좌표 배열이어야 합니다.`);
          continue;
        }
        if (String(Number(count)) === count && list.length !== Number(count)) {
          err(
            ctx,
            "posTable-length",
            `${path}.${count}`,
            `${count}개짜리 자리인데 좌표가 ${list.length}개입니다.`,
          );
        }
        entries.push({
          key: count,
          desc: `선지 ${count}개일 때`,
          node: {
            kind: "array",
            items: list.map((v, i) =>
              resolveValue({ key: String(i), type: "point" }, v, `${path}.${count}[${i}]`, ctx),
            ),
          },
        });
      }
      return { kind: "object", entries };
    }

    case "enum": {
      const s = String(raw ?? "");
      if (f.values && !f.values.includes(s)) {
        err(
          ctx,
          "enum",
          path,
          `'${s}' 는 쓸 수 없습니다. 가능한 값: ${f.values.map((v) => `'${v}'`).join(", ")}`,
        );
      }
      return { kind: "raw", js: JSON.stringify(s) };
    }

    case "bool": {
      if (typeof raw !== "boolean") {
        err(ctx, "type", path, `true/false 여야 하는데 ${typeName(raw)} 입니다.`);
        return { kind: "raw", js: "false" };
      }
      return { kind: "raw", js: String(raw) };
    }

    case "number": {
      if (typeof raw !== "number") {
        err(ctx, "type", path, `숫자여야 하는데 ${typeName(raw)} 입니다.`);
        return { kind: "raw", js: "0" };
      }
      return { kind: "raw", js: String(raw) };
    }

    case "string":
      return { kind: "raw", js: JSON.stringify(String(raw ?? "")) };

    default: {
      // asset:image / asset:sound / asset:lottie / asset:font
      const kind = f.type.startsWith("asset:")
        ? (f.type.slice(6) as AssetKind)
        : null;
      const alias = String(raw ?? "");
      if (kind && alias !== "") {
        const got = ctx.aliases.get(alias);
        if (got === undefined && f.aliasMayBeOff) {
          warn(ctx, "alias-off", path,
            `alias '${alias}' 가 AssetTable 에 없습니다 — 이 자리는 그러면 안 쓰는 것입니다.`,
            f.aliasMayBeOff);
        } else if (got === undefined) {
          err(
            ctx,
            "alias-exists-in-assettable",
            path,
            `alias '${alias}' 가 AssetTable 에 없습니다.`,
          );
        } else if (!got.has(kind)) {
          // 여러 갈래로 등록된 이름이면 그것을 다 보여 줍니다 — 「sound 로
          // 등록돼 있다」만 뜨면 이미지도 있는지 없는지 알 수가 없습니다.
          err(
            ctx,
            "alias-kind",
            path,
            `alias '${alias}' 는 ${kind} 자리인데 ${[...got].join("·")} 로만 등록돼 있습니다.`,
          );
        }
      }
      return { kind: "raw", js: JSON.stringify(alias) };
    }
  }
}

