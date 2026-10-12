// 견줄 재료 — 앞선 표본 · 스펙이 적은 별칭 · 이름 줄기.
//
// `reslot.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `reslot.ts` 에서 가져다 씁니다.

import { loadSpec, specPath } from "./spec";
import { findUsers, type Sample } from "./survey";
import fs from "fs";

// 번호를 뗀 줄기. `book3` → `book` · `page7-1` → `page-`.
// 무리가 있는지만 보는 자라 대소문자와 번호만 지웁니다.
export function stemOf(alias: string): string {
  return alias.replace(/\d+/g, "").toLowerCase();
}

// 학습코드에서 호 두 자리. `ENL1M05W1S3` → 5.
function monthOf(code: string): number {
  const m = /^[A-Z]{2}L\dM(\d\d)W\dS\d$/.exec(code);
  return m ? Number(m[1]) : -1;
}

/** 스펙 `assets.required` 에 적힌 별칭들. 스펙이 없으면 빈 집합입니다. */
export function specAliases(subject: string, module: string): Set<string> {
  const out = new Set<string>();
  if (!fs.existsSync(specPath(subject, module))) return out;
  try {
    const spec = loadSpec(subject, module);
    for (const r of spec.assets?.required ?? []) {
      if (typeof r.alias === "string") out.add(r.alias);
    }
  } catch {
    // 스펙이 깨졌으면 ②로만 가립니다 — 여기서 넘어뜨리지 않습니다.
  }
  return out;
}

/**
 * 같은 모듈을 쓰는 **앞선 호**의 액티비티들. 대상 호는 뺍니다.
 *
 * **차시자리가 아니라 모듈로 봅니다.** 고정 자리는 모듈이 요구하는 것이라
 * 같은 모듈이면 차시가 달라도 같은 이름으로 나옵니다.
 */
export function earlier(subject: string, module: string, code: string): Sample[] {
  const month = monthOf(code);
  return findUsers(subject, module).filter(
    (s) => !s.note && s.code !== code && monthOf(s.code) >= 0 && monthOf(s.code) < month,
  );
}
