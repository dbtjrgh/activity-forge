// **관계 한 줄이 제 꼴인가** — 갈래마다 받는 칸을 본다 (2026-09-23).
//
// `specCheck.ts` 가 부른다. 거기 있던 것을 떼어 낸 까닭 — 갈래를 더할 때마다
// 이 검사도 같이 고쳐야 하는데(저장소 함정 「새 길을 열었으면 그 길을 막고
// 있던 검사도 같이 본다」), 갈래 몸통(`relation.ts`·`relkinds.ts` 가 나눠 주는 세 파일)
// 옆에 있어야 같이 고친다.
//
// **꼴만 본다.** 「그 길에 값이 정말 있나」는 `check:spec` 의 왕복(②)과
// `tool/relgate.ts` 가 본다.

import { VALUE_KINDS } from "./relkinds";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** 길 하나. 빈 글은 뿌리가 아니라 잘못이다(뿌리를 보려면 갈래가 따로 받는다). */
const path = (x: unknown): boolean => typeof x === "string" && x !== "" && /^[A-Za-z0-9_[\]. ]+$/.test(x);

/** 빈 글이 아닌 글이 하나 이상 든 배열. */
const words = (v: unknown): boolean => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x !== "");

export function checkRelationShape(r: Obj, i: number, errors: string[]): void {
  const at = `relations[${i}]`;
  const need = (key: string): void => {
    if (!path(r[key])) errors.push(`${at} 의 ${key} 가 길이 아닙니다.`);
  };

  if (r.kind === "ascends") {
    need("group");
    need("pick");
    return;
  }
  if (r.kind === "covers") {
    need("list");
    need("pick");
    return;
  }
  if (typeof r.kind !== "string" || !VALUE_KINDS.has(r.kind)) {
    const known = ["ascends", "covers", ...VALUE_KINDS].join(" · ");
    errors.push(`${at} 의 kind 를 모릅니다: ${String(r.kind)} (${known})`);
    return;
  }

  // ─── 값 갈래 — 어디에나 붙는 each · when ───
  if (r.each !== undefined) need("each");
  if (r.when !== undefined) {
    if (!isObj(r.when) || !path(r.when.pick)) errors.push(`${at} 의 when 에 pick 길이 없습니다.`);
    else if ("is" in r.when && "isNot" in r.when) errors.push(`${at} 의 when 에 is 와 isNot 이 둘 다 있습니다.`);
  }

  // ─── 갈래마다 받는 칸 ───
  const many = (key: string, least: number): void => {
    const v = r[key];
    if (!Array.isArray(v) || v.length < least || !v.every(path)) {
      errors.push(`${at} (${r.kind}) 의 ${key} 가 길 ${least}개 이상의 배열이 아닙니다.`);
    }
  };
  switch (r.kind) {
    case "sameCount":
      many("picks", 2);
      return;
    case "present":
      many("picks", 1);
      return;
    case "indexes":
      need("list");
      need("pick");
      return;
    case "hasAlias":
      if (!words(r.names)) errors.push(`${at} (hasAlias) 의 names 가 이름(글)의 배열이 아닙니다.`);
      return;
    case "noKey":
      if (r.pick !== undefined) need("pick");
      if (!words(r.keys)) errors.push(`${at} (noKey) 의 keys 가 열쇠(글)의 배열이 아닙니다.`);
      return;
    case "spans":
      need("pick");
      for (const k of ["from", "to"]) {
        if (typeof r[k] !== "string" || r[k] === "") errors.push(`${at} (spans) 의 ${k} 가 칸 이름이 아닙니다.`);
      }
      return;
    case "ends":
      need("pick");
      if (!["first", "last", "middle"].some((k) => r[k] !== undefined)) {
        errors.push(`${at} (ends) 에 first · last · middle 이 하나도 없습니다 — 아무것도 안 봅니다.`);
      }
      for (const k of ["first", "last", "middle"]) {
        if (r[k] !== undefined && (!Array.isArray(r[k]) || !(r[k] as unknown[]).length)) {
          errors.push(`${at} (ends) 의 ${k} 가 값의 배열이 아닙니다.`);
        }
      }
      return;
  }
  need("pick");
  if (r.kind === "keyIn") need("in");
  if ((r.kind === "isAlias" || r.kind === "keyIn") && r.template !== undefined) {
    const t = r.template;
    if (!Array.isArray(t) || !t.every((x) => typeof x === "string" && x.includes("{}"))) {
      errors.push(`${at} (${r.kind}) 의 template 은 {} 가 든 글의 배열입니다.`);
    }
  }
  if (r.kind === "isAlias" && r.of !== undefined && r.of !== "keys" && r.of !== "values") {
    errors.push(`${at} (isAlias) 의 of 는 keys · values 가운데 하나입니다.`);
  }
  if (r.kind === "isAlias" && r.skip !== undefined) {
    if (!r.of) errors.push(`${at} (isAlias) 의 skip 은 of 로 표를 펼 때만 씁니다.`);
    if (!Array.isArray(r.skip) || !r.skip.every((x) => typeof x === "string" && x !== "")) {
      errors.push(`${at} (isAlias) 의 skip 은 글의 배열입니다.`);
    }
  }
  if (r.kind === "oneOf" && (!Array.isArray(r.values) || !r.values.length)) {
    errors.push(`${at} (oneOf) 에 values 가 없습니다.`);
  }
  if ((r.kind === "count" || r.kind === "range") && r.min === undefined && r.max === undefined) {
    errors.push(`${at} (${r.kind}) 에 min 도 max 도 없습니다 — 아무것도 안 봅니다.`);
  }
}
