// GameData 가 export 를 둘 이상 내놓는 모듈 — 본문은 스펙이 정하고, 나머지는 본문에서 뽑는다 (2026-10-26).
//
// **왜 냈나.** 완성본을 읽는 셈(`surveyread.ts` `readGameData`)은 비지 않은 첫 export 를 본문으로 집는다.
// E28 은 `baseAnyBlock`(틀린 블록에 얹을 낱말 목록)을 `quizData` 앞에 둬서, 스펙을 quizData 로 써도
// 왕복 · 관계 · 재현 검사가 다 baseAnyBlock 을 읽었다(낱말 문자열을 이닝 객체로 읽다 걸림).
// 그래서 스펙이 있으면 스펙이 적은 export 를 본문으로 읽는다(`specRoot`).
//
// 본문 말고 액티비티가 같이 들여오는 export 는 스펙 한 장에 못 담는다(⑤ 담기가 「안 담는다」로 걸었다).
// 그 값이 본문에서 뽑히는 것이면 `gameData.derived` 에 **뽑는 길**을 적는다 — ⑤ 는 적힌 것만 넘기되
// 완성본 값이 그 길로 뽑은 것과 같은지 재고, 생성기는 그 길로 뽑아 같이 쓴다(`deriveExports`).
// E28 baseAnyBlock 은 완성본 넷 모두 「모든 이닝 info.answerBlock 을 겹치지 않게 모은 것」과 같았다(차례만 달랐다).

import fs from "fs";
import { resolveModule, specPath } from "./spec";
import { select } from "./relpath";
import type { Spec } from "./types";

/** 그 모듈 스펙이 적은 본문 export. 스펙이 없거나 못 읽으면 undefined — 부르는 쪽은 여태처럼 첫 export 를 본다 */
export function specRoot(subject: string, module: string): string | undefined {
  const file = specPath(subject, resolveModule(subject, module));
  if (!fs.existsSync(file)) return undefined;
  try {
    const spec = JSON.parse(fs.readFileSync(file, "utf8")) as Spec;
    return spec.codegen?.gameDataExport || undefined;
  } catch {
    return undefined; // 깨진 스펙은 loadSpec 이 제대로 된 메시지를 낸다
  }
}

/** 본문 값에서 `gameData.derived` 의 export 를 뽑는다 — 길에 걸린 값을 처음 나온 차례로, 겹치는 것은 한 번 */
export function deriveExports(spec: Spec, root: unknown): Map<string, unknown[]> {
  const out = new Map<string, unknown[]>();
  for (const d of spec.gameData.derived ?? []) {
    const seen = new Set<string>();
    const values: unknown[] = [];
    for (const h of select(root, d.unionOf, spec.gameData.root)) {
      const key = JSON.stringify(h.value);
      if (h.value === undefined || seen.has(key)) continue;
      seen.add(key);
      values.push(h.value);
    }
    out.set(d.name, values);
  }
  return out;
}

/** 두 목록이 차례와 상관없이 같은 값을 담나 — 모듈이 섞어 쓰는 목록이라 차례는 안 본다 */
export function sameMembers(a: unknown, b: unknown[]): boolean {
  if (!Array.isArray(a)) return false;
  const left = new Set(a.map((v) => JSON.stringify(v)));
  const right = new Set(b.map((v) => JSON.stringify(v)));
  return left.size === right.size && [...left].every((k) => right.has(k));
}
