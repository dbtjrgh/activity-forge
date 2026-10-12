// 스펙 형식 — 공용 이름 꼴 · codegen · assets · rules · relations.
//
// `specCheck.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `specCheck.ts` 에서 가져다 씁니다.

import type { AssetKind } from "./types";
import { HOOK_KEYS } from "./types";
import { checkRelationShape } from "./relcheck";

export const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const SUBJECTS = ["MA", "KO", "EN"];
const ASSET_KINDS: AssetKind[] = ["image", "sound", "lottie", "font"];
export const FIELD_TYPES: string[] = [
  "string",
  "number",
  "bool",
  "enum",
  "point",
  "posTable",
  "object",
  "array",
  ...ASSET_KINDS.map((k) => `asset:${k}`),
];

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ─── codegen ─────────────────────────────────────────────────────────────

// import 하나를 적는 두 가지 자리(`import` 와 `imports[]`)가 같은 모양입니다.
function checkImport(v: unknown, where: string, errors: string[]): void {
  if (isObj(v) && v.ns !== undefined && typeof v.ns !== "boolean") {
    errors.push(`${where}.ns 가 참·거짓이 아닙니다.`);
  }
  if (!isObj(v)) {
    errors.push(`${where} 가 객체가 아닙니다.`);
    return;
  }
  if (typeof v.symbol !== "string" || v.symbol === "") errors.push(`${where} 에 symbol 이 없습니다.`);
  if (typeof v.from !== "string" || v.from === "") errors.push(`${where} 에 from 이 없습니다.`);
}

const HOOKS: readonly string[] = HOOK_KEYS;

export function checkCodegen(v: unknown, errors: string[]): void {
  if (!isObj(v)) {
    errors.push("codegen 이 객체가 아닙니다.");
    return;
  }
  // **gameDataExport 는 반드시 있어야 합니다.** 이 이름으로 GameData.ts 가
  // 내보내고 Activity.ts 가 받습니다. 틀리면 파일 두 장이 서로를 못 찾습니다.
  if (typeof v.gameDataExport !== "string" || !IDENT.test(v.gameDataExport)) {
    errors.push("codegen.gameDataExport 가 식별자가 아닙니다.");
  }
  if (v.extends !== undefined) checkImport(v.extends, "codegen.extends", errors);
  if (v.import !== undefined) checkImport(v.import, "codegen.import", errors);
  if (v.imports !== undefined) {
    if (!Array.isArray(v.imports)) errors.push("codegen.imports 가 배열이 아닙니다.");
    else v.imports.forEach((im, i) => checkImport(im, `codegen.imports[${i}]`, errors));
  }

  if (!isObj(v.hooks)) {
    errors.push("codegen.hooks 가 객체가 아닙니다.");
    return;
  }
  for (const [name, body] of Object.entries(v.hooks)) {
    if (!HOOKS.includes(name)) {
      errors.push(`codegen.hooks.${name} — 그런 훅이 없습니다 (${HOOKS.join("·")}).`);
      continue;
    }
    if (!Array.isArray(body) || body.some((line) => typeof line !== "string")) {
      errors.push(`codegen.hooks.${name} 은 문자열 배열(줄 단위)이어야 합니다.`);
    }
  }
}

// ─── assets ──────────────────────────────────────────────────────────────

export function checkAssets(v: unknown, errors: string[]): void {
  if (!isObj(v)) {
    errors.push("assets 가 객체가 아닙니다.");
    return;
  }
  if (v.defaults !== undefined) {
    if (!isObj(v.defaults)) errors.push("assets.defaults 가 객체가 아닙니다.");
    else {
      for (const [kind, list] of Object.entries(v.defaults)) {
        if (!ASSET_KINDS.includes(kind as AssetKind)) {
          errors.push(`assets.defaults.${kind} — 그런 갈래가 없습니다 (${ASSET_KINDS.join("·")}).`);
          continue;
        }
        if (!Array.isArray(list)) {
          errors.push(`assets.defaults.${kind} 가 배열이 아닙니다.`);
          continue;
        }
        list.forEach((a, i) => {
          if (!isObj(a) || typeof a.alias !== "string" || typeof a.file !== "string") {
            errors.push(`assets.defaults.${kind}[${i}] 에 alias·file 이 없습니다.`);
          }
        });
      }
    }
  }
  if (v.required !== undefined) {
    if (!Array.isArray(v.required)) {
      errors.push("assets.required 가 배열이 아닙니다.");
      return;
    }
    v.required.forEach((a, i) => {
      if (!isObj(a)) {
        errors.push(`assets.required[${i}] 가 객체가 아닙니다.`);
        return;
      }
      if (typeof a.alias !== "string" || a.alias === "") {
        errors.push(`assets.required[${i}] 에 alias 가 없습니다.`);
      }
      if (!ASSET_KINDS.includes(a.kind as AssetKind)) {
        errors.push(`assets.required[${i}] 의 kind 가 ${ASSET_KINDS.join("·")} 가 아닙니다.`);
      }
    });
  }
}

// ─── rules ───────────────────────────────────────────────────────────────

export function checkRules(v: unknown, errors: string[]): void {
  if (v === undefined) return;
  if (!Array.isArray(v)) {
    errors.push("rules 가 배열이 아닙니다.");
    return;
  }
  const ids = new Set<string>();
  v.forEach((r, i) => {
    if (!isObj(r)) {
      errors.push(`rules[${i}] 가 객체가 아닙니다.`);
      return;
    }
    if (typeof r.id !== "string" || r.id === "") errors.push(`rules[${i}] 에 id 가 없습니다.`);
    // 검사 결과에 id 가 그대로 찍힙니다. 겹치면 어느 규칙이 걸렸는지 모릅니다.
    else if (ids.has(r.id)) errors.push(`rules[${i}] — id "${r.id}" 가 두 번 있습니다.`);
    else ids.add(r.id);
    if (r.level !== "error" && r.level !== "warn") {
      errors.push(`rules[${i}] 의 level 이 error/warn 이 아닙니다.`);
    }
    if (typeof r.check !== "string" || r.check === "") errors.push(`rules[${i}] 에 check 가 없습니다.`);
  });
}

// ─── relations ───────────────────────────────────────────────────────────
//
// **여기서 잡아야 하는 까닭.** 관계는 스펙 JSON 안에서 끝나는 검사라, 길을
// 한 글자 잘못 적으면 `select()` 가 빈 목록을 돌려주고 **검사가 조용히 안
// 돕니다.** 막으려고 만든 것이 아무 말 없이 통과하는 것이 제일 나쁩니다.
// 꼴은 여기서, 「그 길에 값이 정말 있나」는 `check:spec` 의 왕복(②)이 봅니다.
export function checkRelations(v: unknown, errors: string[]): void {
  if (v === undefined) return;
  if (!Array.isArray(v)) {
    errors.push("relations 가 배열이 아닙니다.");
    return;
  }
  const ids = new Set<string>();

  v.forEach((r, i) => {
    if (!isObj(r)) {
      errors.push(`relations[${i}] 가 객체가 아닙니다.`);
      return;
    }
    if (typeof r.id !== "string" || r.id === "") errors.push(`relations[${i}] 에 id 가 없습니다.`);
    else if (ids.has(r.id)) errors.push(`relations[${i}] — id "${r.id}" 가 두 번 있습니다.`);
    else ids.add(r.id);
    if (r.level !== undefined && r.level !== "error" && r.level !== "warn") {
      errors.push(`relations[${i}] 의 level 이 error/warn 이 아닙니다.`);
    }
    // 갈래마다 받는 칸은 갈래 몸통 옆에서 본다 (`relcheck.ts`).
    checkRelationShape(r, i, errors);
  });
}
