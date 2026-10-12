// 스펙 형식 — gameData 뿌리 · 자리 목록 · 이어진 칸.
//
// `specCheck.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `specCheck.ts` 에서 가져다 씁니다.

import type { SpecField } from "./types";
import { IDENT, isObj } from "./specCheckBase";
import { checkField } from "./specCheckField";

// ─── gameData ────────────────────────────────────────────────────────────

export function checkGameData(v: unknown, errors: string[]): void {
  if (!isObj(v)) {
    errors.push("gameData 가 객체가 아닙니다.");
    return;
  }
  if (typeof v.root !== "string" || !IDENT.test(v.root)) {
    errors.push("gameData.root 가 식별자가 아닙니다.");
  }
  const kind = v.kind ?? "object";
  if (kind !== "object" && kind !== "unused" && kind !== "array") {
    errors.push('gameData.kind 는 "object" · "unused" · "array" 중 하나여야 합니다.');
  }
  if (!Array.isArray(v.fields)) {
    errors.push("gameData.fields 가 배열이 아닙니다.");
    return;
  }
  // kind "unused" 는 「넣을 값이 없다」는 뜻입니다. 자리가 있으면 둘 중
  // 하나가 거짓말입니다 — 어느 쪽인지 사람이 봐야 합니다.
  if (kind === "unused" && v.fields.length > 0) {
    errors.push(`gameData.kind 가 "unused" 인데 자리가 ${v.fields.length}개 있습니다.`);
  }
  // kind "array" 는 뿌리가 통째로 배열입니다. 감싸는 객체가 없으니
  // `fields` 에 적을 것이 없고, 칸 하나의 모양을 `of` 에 적습니다.
  // 둘 다 적으면 어느 쪽이 뿌리인지 알 수 없어 잘못으로 봅니다.
  if (kind === "array") {
    if (v.fields.length > 0) {
      errors.push(`gameData.kind 가 "array" 인데 fields 에 자리가 ${v.fields.length}개 있습니다 — 칸 모양은 of 에 적습니다.`);
    }
    if (!isObj(v.of)) {
      errors.push('gameData.kind 가 "array" 인데 of 가 없습니다 — 칸 하나의 모양을 적어야 합니다.');
    } else {
      // 칸모양이라 이름을 안 묻습니다 — 배열 칸의 `of` 와 같은 규칙입니다.
      checkField(v.of, "gameData.of", new Set<string>(), errors, false);
    }
  } else if (v.of !== undefined) {
    errors.push('gameData.of 는 kind 가 "array" 일 때만 씁니다.');
  }
  checkFields(v.fields, "gameData.fields", errors);
}

export function checkFields(list: unknown[], where: string, errors: string[]): void {
  // 같은 자리 이름이 둘이면 나중 것이 앞을 덮습니다. 조용히 한 자리가
  // 사라지므로 형식 잘못으로 봅니다.
  const seen = new Set<string>();
  list.forEach((f, i) => checkField(f, `${where}[${i}]`, seen, errors, true));
}

// 번호로 늘어나는 열쇠(c1·c2·…). object 에만 답니다.
//
// 앞머리를 자바스크립트 이름으로 쓸 수 있는 글자로 묶어 둡니다 — 생성기가
// `cards: { c1: … }` 처럼 **따옴표 없이** 내보내기 때문입니다.
export function checkSeries(
  f: Partial<SpecField> & Record<string, unknown>,
  name: string,
  errors: string[],
): void {
  const s = f.series;
  if (s === undefined) return;
  if (!isObj(s)) {
    errors.push(`${name} 의 series 가 객체가 아닙니다.`);
    return;
  }
  const v = s as Record<string, unknown>;
  if (typeof v.prefix !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.prefix)) {
    errors.push(`${name} 의 series.prefix 가 이름으로 쓸 수 없는 글자입니다 — ${JSON.stringify(v.prefix)}.`);
  }
  if (v.of === undefined) {
    errors.push(`${name} 에 series 가 있는데 series.of(칸 하나의 모양)가 없습니다.`);
  } else {
    checkField(v.of, `${name}.series.of`, new Set<string>(), errors, false);
  }
  if (v.min !== undefined && (typeof v.min !== "number" || v.min < 0)) {
    errors.push(`${name} 의 series.min 이 0 이상의 수가 아닙니다.`);
  }
  if (v.label !== undefined && typeof v.label !== "string") {
    errors.push(`${name} 의 series.label 이 문자열이 아닙니다.`);
  }
  // 손으로 적은 자리가 번호 자리와 겹치면 둘이 같은 열쇠를 두고 다툽니다.
  if (typeof v.prefix === "string" && Array.isArray(f.fields)) {
    const re = new RegExp(`^${v.prefix}\\d+$`);
    for (const g of f.fields as SpecField[]) {
      if (g && typeof g.key === "string" && re.test(g.key)) {
        errors.push(`${name} 의 fields 에 있는 "${g.key}" 가 series(${v.prefix}N)와 겹칩니다 — 하나만 두세요.`);
      }
    }
  }
}
