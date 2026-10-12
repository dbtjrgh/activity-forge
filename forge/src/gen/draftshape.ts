// 배열 한 겹의 모양 · 고정값.
//
// `draft.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `draft.ts` 에서 가져다 씁니다.

import type { SpecField } from "./types";
import { fieldsOf } from "./draftspec";
import { type AssetIndex, scalarType, shapeOf, isExpr, isPlainObject } from "./drafttype";

// 배열 한 겹의 모양 — `type` · `minLength` · `of`.
//
// **안에 또 배열이 있으면 자기를 다시 부릅니다.** 예전에는 한 겹만 벗기고 나머지를
// 통째로 `scalarType` 에 넘겼습니다. 배열은 문자열도 숫자도 아니니 `string` 으로
// 적혔고, 스펙이 그렇게 적혀 있으니 생성기는 시키는 대로 **배열을 글자로 만들어**
// 냈습니다. `wrongList: [["씨앗A", "씨앗B"], …]` 이 `wrongList: ["씨앗A,씨앗B"]` 가
// 됩니다. 재현 검사에서 「원본은 배열, 뽑은 것은 string」 이 132자리 나온 까닭입니다
// (2026-09-02).
//
// 빈 배열은 첫 갈래에 걸리지 않게 막습니다 — `[].every()` 는 무엇이든 참이라
// 안을 못 본 배열이 「배열 속 배열」로 적힙니다.
type ArrayShape = Pick<SpecField, "type" | "minLength" | "of" | "mixed">;

export function arrayShape(
  arrays: unknown[][],
  at: string,
  assets: AssetIndex,
): ArrayShape {
  const items = arrays.flat().filter((v) => !isExpr(v) && v !== null);
  const inner = at + "[]";
  const shape: ArrayShape = {
    type: "array",
    minLength: Math.min(...arrays.map((a) => a.length)),
  };

  // **칸마다 모양이 다르면 `of` 를 아예 적지 않습니다.**
  //
  // K07 의 `visible` 이 표본 7개 중 여섯은 `[false, true, true]` 인데 하나가
  // `[false, [false, true], [false, true]]` 입니다. bool 과 배열이 섞여 있으니
  // 「전부 bool」도 「전부 배열」도 아니고, 예전에는 `string` 으로 떨어져
  // **여섯 액티비티가 `"true"` 를 받았습니다**. `null` 이 섞인 칸(ExploreStory 의
  // `pageInfo`, E07 의 `maps[].map`)도 같은 자리에서 무너집니다.
  //
  // 하나로 못 부르는 것을 억지로 부르면 **안 섞인 액티비티까지** 망가집니다.
  // `of` 가 없으면 `resolve.ts` 가 값을 그대로 씁니다 — 화면이 칸을 그려 주지
  // 못하는 대신, 뽑은 글자는 맞습니다. 덜 말하는 편이 틀리게 말하는 것보다
  // 낫습니다 (2026-09-02).
  if (new Set(items.map(shapeOf)).size > 1) {
    shape.mixed = true;
    return shape;
  }

  if (items.length > 0 && items.every(Array.isArray)) {
    shape.of = { key: "", ...arrayShape(items as unknown[][], inner, assets) };
    return shape;
  }
  if (items.every(isPlainObject)) {
    shape.of = {
      key: "",
      type: "object",
      fields: fieldsOf(items, items.length, inner, assets),
    };
    return shape;
  }
  // 칸모양이 「고르는 칸」이면 **고를 것도 같이 적어야** 합니다.
  // 안 적었더니 `of: { type: "enum" }` 만 남은 스펙이 13장 나왔습니다 —
  // 화면은 빈 드롭다운을 그리고 검사는 무엇과 견줄지 모릅니다.
  // 형식 검사기(`specCheck.ts`)가 잡아 준 것입니다 (2026-09-01).
  const type = scalarType(items, at, assets);
  shape.of =
    type === "enum"
      ? { key: "", type, values: [...new Set(items.map(String))].sort() }
      : { key: "", type };
  return shape;
}

// 표본마다 값이 같으면 스펙에 박아 둡니다. 액티비티마다 다시 적을 값이 아닙니다.
//
// **표본이 셋은 되어야 박습니다.** 하나뿐이면 「늘 같은 값」인지 「그 액티비티가
// 마침 그랬을 뿐」인지 가릴 길이 없습니다. 그걸 default 로 박으면 다음에 만드는
// 액티비티가 남의 값을 물려받습니다 — 안 박느니만 못합니다 (2026-09-01).
//
// desc 는 적지 않습니다. 「표본 20/20개 · 11가지」 같은 말은 스펙에 남길 글이
// 아니라 지금 판단하는 데 쓰고 버릴 값입니다. 자리마다 무엇인지 설명하는 글은
// 나중에 붙입니다.
export const MIN_SAMPLES_FOR_DEFAULT = 3;

export function withDesc(
  f: SpecField,
  _at: string,
  values: unknown[],
  seen: number,
  total: number,
): SpecField {
  if (total < MIN_SAMPLES_FOR_DEFAULT) return f;
  const distinct = new Set(values.map((v) => JSON.stringify(v)));
  if (
    distinct.size === 1 &&
    f.type !== "object" &&
    f.type !== "array" &&
    seen === total
  ) {
    f.default = values[0];
  }
  return f;
}
