// 스펙 형식 — 자리 하나 · 배리언트.
//
// `specCheck.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `specCheck.ts` 에서 가져다 씁니다.

import type { FieldType, SpecField } from "./types";
import { FIELD_TYPES, isObj } from "./specCheckBase";
import { checkFields, checkSeries } from "./specCheckData";

// `needKey` — 배열의 `of` 는 **칸 하나의 생김새**라서 이름이 없습니다.
// `{ key: "", type: "object", fields: [...] }` 처럼 빈 이름으로 적습니다.
// 자리(fields[])와 칸모양(of)이 같은 타입을 쓰는 대신, 이름을 물을지만 가릅니다.
export function checkField(
  v: unknown,
  where: string,
  seen: Set<string>,
  errors: string[],
  needKey: boolean,
): void {
  if (!isObj(v)) {
    errors.push(`${where} 가 객체가 아닙니다.`);
    return;
  }
  const f = v as Partial<SpecField> & Record<string, unknown>;

  if (needKey) {
    if (typeof f.key !== "string" || f.key === "") {
      errors.push(`${where} 에 key 가 없습니다.`);
    } else if (seen.has(f.key)) {
      errors.push(`${where} — key "${f.key}" 가 같은 자리에 두 번 있습니다.`);
    } else {
      seen.add(f.key);
    }
  } else if (f.key !== undefined && typeof f.key !== "string") {
    // 손으로 쓴 스펙(M27·M28)은 `of` 에 key 를 아예 안 적습니다. 기계는 `""`
    // 로 적고요. **둘 다 맞습니다** — 이름이 없다는 뜻은 같습니다.
    errors.push(`${where} 의 key 가 문자열이 아닙니다 (칸모양은 이름을 비웁니다).`);
  }
  const name =
    needKey && typeof f.key === "string" && f.key !== "" ? `${where}(${f.key})` : where;

  const type = f.type as FieldType | undefined;
  if (typeof type !== "string" || !FIELD_TYPES.includes(type)) {
    errors.push(`${name} 의 type 이 올바르지 않습니다 — ${JSON.stringify(f.type)}.`);
    return; // 갈래를 모르면 아래 검사가 의미 없습니다.
  }
  if (f.desc !== undefined && typeof f.desc !== "string") {
    errors.push(`${name} 의 desc 가 문자열이 아닙니다.`);
  }
  // **까닭 없는 기본값은 남기지 않습니다** (2026-09-14). `default` 는 다음
  // 호부터 사람에게 안 묻겠다는 뜻이라, 왜 그 값인지가 같이 있어야 나중에
  // 「이거 누가 왜 정했지」를 다시 묻지 않습니다. 양산 화면이 올릴 때는 늘
  // 같이 씁니다 — 손으로 적은 옛 스펙까지 막지는 않으려고 경고가 아닌
  // 형식 검사만 둡니다.
  if (f.defaultWhy !== undefined && typeof f.defaultWhy !== "string") {
    errors.push(`${name} 의 defaultWhy 가 문자열이 아닙니다.`);
  }

  // **필수이면서 선택일 수는 없습니다.** 화면이 별표를 붙일지 말지 정하지
  // 못하고, 검사도 「없으면 에러」인지 아닌지 갈립니다.
  if (f.required === true && f.optional === true) {
    errors.push(`${name} 이 required 이면서 optional 입니다.`);
  }

  switch (type) {
    case "enum":
      if (!Array.isArray(f.values) || f.values.length === 0) {
        errors.push(`${name} 이 enum 인데 values 가 없습니다.`);
      } else if (f.values.some((x) => typeof x !== "string")) {
        errors.push(`${name} 의 values 는 문자열 배열이어야 합니다.`);
      }
      break;
    case "object":
      if (!Array.isArray(f.fields)) {
        errors.push(`${name} 이 object 인데 fields 가 없습니다.`);
      } else {
        checkFields(f.fields, `${name}.fields`, errors);
      }
      checkSeries(f, name, errors);
      break;
    case "array":
      // `mixed` 는 「칸마다 모양이 달라 하나로 못 부른다」를 적어 둔 것입니다.
      // 그것까지 없으면 빠뜨린 것입니다.
      if (f.of === undefined) {
        if (f.mixed !== true) {
          errors.push(`${name} 이 array 인데 of 도 mixed 도 없습니다.`);
        }
      } else {
        checkField(f.of, `${name}.of`, new Set<string>(), errors, false);
      }
      if (f.itemLabels !== undefined) {
        if (!Array.isArray(f.itemLabels)) errors.push(`${name} 의 itemLabels 가 배열이 아닙니다.`);
        // 칸 수가 정해진 배열에 이름을 붙였는데 개수가 다르면, 화면이
        // 어느 칸에 무슨 이름을 달지 모릅니다.
        else if (typeof f.minLength === "number" && f.fixed === true &&
                 f.itemLabels.length !== f.minLength) {
          errors.push(`${name} — itemLabels ${f.itemLabels.length}개인데 칸은 ${f.minLength}개입니다.`);
        }
      }
      break;
    default:
      break;
  }

  // of 없이 array 가 아닌데 of 를 적어 둔 것 같은 실수를 잡습니다.
  if (type !== "array" && f.of !== undefined) {
    errors.push(`${name} 은 array 가 아닌데 of 가 있습니다.`);
  }
  if (type !== "object" && Array.isArray(f.fields)) {
    errors.push(`${name} 은 object 가 아닌데 fields 가 있습니다.`);
  }
  if (type !== "enum" && f.values !== undefined) {
    errors.push(`${name} 은 enum 이 아닌데 values 가 있습니다.`);
  }

  if (f.variants !== undefined) checkVariants(f.variants, `${name}.variants`, errors);
}

function checkVariants(v: unknown, where: string, errors: string[]): void {
  if (!isObj(v)) {
    errors.push(`${where} 가 객체가 아닙니다.`);
    return;
  }
  if (typeof v.discriminator !== "string" || v.discriminator === "") {
    errors.push(`${where} 에 discriminator 가 없습니다.`);
  }
  if (!Array.isArray(v.cases) || v.cases.length === 0) {
    errors.push(`${where} 에 cases 가 없습니다.`);
    return;
  }
  v.cases.forEach((c, i) => {
    if (!isObj(c)) {
      errors.push(`${where}.cases[${i}] 가 객체가 아닙니다.`);
      return;
    }
    if (typeof c.name !== "string" || c.name === "") errors.push(`${where}.cases[${i}] 에 name 이 없습니다.`);
    if (typeof c.when !== "string" || c.when === "") errors.push(`${where}.cases[${i}] 에 when 이 없습니다.`);
    if (!Array.isArray(c.fields)) errors.push(`${where}.cases[${i}] 에 fields 가 없습니다.`);
    else checkFields(c.fields, `${where}.cases[${i}].fields`, errors);
  });
}
