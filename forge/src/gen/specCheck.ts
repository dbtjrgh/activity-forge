// 스펙 한 장이 형식에 맞는지 봅니다.
//
// **왜 필요한가 — 스펙을 만드는 곳이 둘이 됩니다.**
// 지금은 `draft.ts` 가 이미 있는 액티비티를 견줘서 캐냅니다(추론). 앞으로는
// 새로 만든 모듈이 자기 스펙을 스스로 냅니다(선언). 만드는 곳이 둘이면
// **판정하는 곳은 하나여야** 조용히 갈라지지 않습니다.
//
// **순수 함수** — 파일을 읽지 않습니다. 디스크는 부르는 쪽이 봅니다.
// (deploy repo 의 `service/modulegen/manifest.ts` 와 같은 꼴로 맞췄습니다.)
//
// 여기서 보는 것은 **형식**뿐입니다. 「이 스펙이 실제 액티비티 데이터를
// 통과시키는가」는 다른 일이고, 그건 레시피를 넣어 보는 검사가 합니다.
//
// **본문은 조각으로 나눴습니다** (2026-09-30, 450줄이라 — 동작 변화 없음). 여기는 입구(`validateSpec`)만.
//
//   specCheckBase   공용 이름 꼴 · codegen · assets · rules · relations
//   specCheckData   gameData 뿌리 · 자리 목록 · 이어진 칸
//   specCheckField  자리 하나 · 배리언트
//   (여기)          variantKey — 모듈 안 구현을 고르는 자리 (2026-10-13)

import type { Spec } from "./types";
import { IDENT, isObj, checkCodegen, checkAssets, checkRules, checkRelations } from "./specCheckBase";
import { checkGameData } from "./specCheckData";
import { SUBJECT_CODES, isSubject } from "./subjects";

export interface SpecCheck {
  ok: boolean;
  errors: string[];
}

export function validateSpec(input: unknown): SpecCheck {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["스펙이 객체가 아닙니다."] };
  const s = input as Partial<Spec> & Record<string, unknown>;

  // ─── 머리 ──────────────────────────────────────────────────────────────
  if (s.specVersion !== 1) {
    errors.push(`specVersion 이 1 이 아닙니다 — ${JSON.stringify(s.specVersion)}.`);
  }
  if (typeof s.module !== "string" || !IDENT.test(s.module)) {
    errors.push("module 이름이 식별자가 아닙니다.");
  }
  if (typeof s.subject !== "string" || !isSubject(s.subject)) {
    errors.push(`subject 는 ${SUBJECT_CODES.join(", ")} 중 하나여야 합니다.`);
  }
  // **비어 있는 title 은 통과시킵니다.** 112장을 기계가 뽑아 놓았고 제목은
  // 그 모듈을 쓸 때 채우기로 했습니다. 없는 것과 빈 것은 다릅니다.
  if (typeof s.title !== "string") errors.push("title 이 문자열이 아닙니다.");
  if (s.summary !== undefined && typeof s.summary !== "string") {
    errors.push("summary 가 문자열이 아닙니다.");
  }
  if (s.aliases !== undefined) {
    if (!Array.isArray(s.aliases) || s.aliases.some((a) => typeof a !== "string")) {
      errors.push("aliases 는 문자열 배열이어야 합니다.");
    }
  }

  checkCodegen(s.codegen, errors);
  checkAssets(s.assets, errors);
  checkGameData(s.gameData, errors);
  checkRules(s.rules, errors);
  checkRelations(s.relations, errors);
  checkVariantKey(s.variantKey, errors);

  return { ok: errors.length === 0, errors };
}

// **모듈 안 구현을 고르는 자리** (2026-10-13, `typesspec.ts` `VariantKey`). 길이 꼴부터 틀리면 `select()` 가 빈 목록을 돌려주고
// 대화가 받는 유형 표가 조용히 빈다 — 꼴은 여기서, 「완성본에서 값이 나오나」는 `tool/variantgate.ts` 가 본다.
const PATH_SEG = /^[^[\].]*(\[[^\]]*\])?$/;

function checkVariantKey(v: unknown, errors: string[]): void {
  if (v === undefined) return;
  if (!isObj(v)) {
    errors.push("variantKey 가 객체가 아닙니다.");
    return;
  }
  if (typeof v.path !== "string" || !v.path || !v.path.split(".").every((seg) => seg !== "" && PATH_SEG.test(seg))) {
    errors.push(`variantKey.path 가 길 꼴이 아닙니다 — ${JSON.stringify(v.path)} (예: settings.typeList[]).`);
  }
  if (typeof v.note !== "string" || !v.note) errors.push("variantKey 에 note 가 없습니다.");
  if (v.ignore !== undefined && (!Array.isArray(v.ignore) || v.ignore.some((x) => typeof x !== "string"))) {
    errors.push("variantKey.ignore 는 문자열 배열이어야 합니다.");
  }
}
