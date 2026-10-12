// 스펙 — 목록 · 한 장 · 초안 · 쓰기.
//
// `api.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `api.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import type { Spec } from "./types";
import { listSpecs, loadSpec, resolveModule, specPath } from "./spec";
import { listModules, type ModuleRow } from "./survey";
import { draftSpec } from "./draft";
import { SUBJECTS, type Fail, fail } from "./apifail";

// ── 스펙 ────────────────────────────────────────────────────────────

export type SpecSummary = { subject: string; module: string; title: string; summary?: string };

// 과목 폴더와 `_common` 을 함께 봅니다.
export function specs(): SpecSummary[] {
  const out: SpecSummary[] = [];
  for (const subject of SUBJECTS) {
    for (const module of listSpecs(subject)) {
      try {
        const spec = loadSpec(subject, module);
        out.push({ subject, module, title: spec.title, ...(spec.summary ? { summary: spec.summary } : {}) });
      } catch {
        // 깨진 스펙은 목록에서 빼고 넘어갑니다.
      }
    }
  }
  return out;
}

export function spec(subject: string, module: string): Spec | Fail {
  try {
    return loadSpec(subject, resolveModule(subject, module));
  } catch (e) {
    return fail(e);
  }
}

export function modules(): ModuleRow[] {
  return listModules();
}

// 표본을 견줘 초안을 냅니다. **파일로는 쓰지 않습니다** — 사람이 보고 고친 뒤
// writeSpec 으로 되돌려 보내야 그때 남습니다.
export function draft(subject: string, module: string) {
  try {
    const d = draftSpec(subject, module);
    return {
      ok: !d.arrayRoot,
      arrayRoot: d.arrayRoot,
      spec: d.spec,
      samples: d.samples.map((s) => s.code),
      error: d.arrayRoot
        ? "GameData 뿌리가 배열입니다. 생성기가 아직 못 다루는 꼴이라 저장할 수 없습니다."
        : undefined,
    };
  } catch (e) {
    return fail(e);
  }
}

// 사람이 채운 스펙을 `_spec/{과목}/{모듈}.json` 으로 남깁니다.
// **손으로 다듬어 둔 것을 실수로 덮지 않게 한 번 막습니다.**
export function writeSpec(subject: string, module: string, value: unknown, force: boolean) {
  if (!/^(MA|KO|EN)$/.test(subject) || !/^[A-Za-z0-9_]+$/.test(module)) {
    return { ok: false as const, error: "과목이나 모듈 이름이 이상합니다." };
  }
  if (!value || typeof value !== "object") return { ok: false as const, error: "스펙이 비었습니다." };

  const file = specPath(subject, module);
  const existed = fs.existsSync(file);
  if (existed && !force) {
    return { ok: false as const, exists: true, file, error: "이미 있습니다. 덮어쓰려면 다시 눌러 주세요." };
  }
  // 채우다 만 것을 남기면 화면 목록에 TODO 라는 제목으로 뜹니다. 세어서 알려는 줍니다.
  const text = JSON.stringify(value, null, 2) + "\n";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
  return { ok: true as const, file, existed, todos: (text.match(/TODO/g) ?? []).length };
}
