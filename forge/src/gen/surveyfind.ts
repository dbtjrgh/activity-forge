// 찾기 — 모듈을 쓰는 액티비티 · 모듈 목록 · 폴더 훑기.
//
// `survey.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `survey.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import { modulesInSource, type ModuleRef } from "@/util/activityModules";
import { listSpecs } from "./spec";
import { workRoot } from "./paths";
import type { Sample } from "./survey";
import { readGameData } from "./surveyread";

// 공통 repo 의 폴더 이름과 학습코드의 과목 글자가 다릅니다. 국어만 어긋납니다.
//   학습코드 KOL1M03…   ↔   sparkon_common/_common/module/KR/
const SUBJECT_DIR: Record<string, string> = { MA: "MA", KO: "KR", EN: "EN" };

// ─── 찾기 ────────────────────────────────────────────────────────────────
// 액티비티 하나가 어떤 모듈을 쓰는지. `Activity.ts` 의 import 줄만 봅니다.
//
// **파서는 `util/activityModules.ts` 한 벌입니다** (2026-09-01). 전에는 여기와
// 자동 검증에 각각 있었고, 서로 다르게 틀려 있었습니다 — 그쪽은 홑따옴표를,
// 이쪽은 `type X` 를 못 봤습니다.
//
// 여기서 한 가지만 더 합니다. **sparkLib 모듈에는 과목을 붙입니다.**
// `VideoPlayer` 는 수학도 영어도 쓰는데, 스펙은 과목마다 따로 둡니다
// (`_spec/MA/VideoPlayer.json` · `_spec/EN/…`). 글자만 보는 파서는 그 액티비티가
// 어느 과목인지 알 길이 없어, 폴더 이름을 아는 여기서 채웁니다.
export function modulesOf(activityDir: string): ModuleRef[] {
  let text: string;
  try {
    text = fs.readFileSync(path.join(activityDir, "Activity.ts"), "utf8");
  } catch {
    return [];
  }
  return modulesInSource(text)
    // **`dori_common` 은 뺍니다.** `Com_Content` 같은 것은 게임 모듈이 아니라
    // 여러 액티비티가 같이 쓰는 부품입니다. GameData 로 값을 받지 않으니
    // 스펙을 만들 것이 없습니다. 자동 검증은 이것도 대상으로 삼습니다 —
    // 거기는 「고치면 무엇이 영향받나」를 보는 자리라 셈이 다릅니다.
    .filter((r) => r.kind !== "common")
    // 액티비티 안에서 만드는 중인 파생 모듈도 과목을 여기서 채웁니다 —
    // 상대경로에는 과목 글자가 없습니다.
    .map((r) =>
      r.kind === "sparkLib" || r.kind === "local"
        ? { ...r, subject: subjectOf(activityDir) }
        : r,
    );
}

// 호 repo 를 전부 훑어 「모듈 → 그걸 쓰는 액티비티들」 표를 만듭니다.
// 1,200개 남짓이라 한 번에 다 읽어도 눈에 띄게 걸리지 않습니다.
export function surveyAll(): Map<string, Sample[]> {
  const table = new Map<string, Sample[]>();
  for (const dir of activityDirs()) {
    for (const ref of modulesOf(dir)) {
      const key = keyOf(ref);
      const list = table.get(key) ?? [];
      list.push(stub(dir));
      table.set(key, list);
    }
  }
  return table;
}

// 모듈 하나를 쓰는 액티비티만. GameData 까지 읽어서 돌려줍니다.
export function findUsers(subject: string, module: string): Sample[] {
  const want = module.toUpperCase();
  const out: Sample[] = [];
  for (const dir of activityDirs()) {
    const hit = modulesOf(dir).some(
      (r) => r.module.toUpperCase() === want && r.subject === subject,
    );
    if (hit) out.push(readSample(dir));
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

export function keyOf(ref: ModuleRef): string {
  return ref.subject + "/" + ref.module;
}

export type ModuleRow = {
  subject: string;
  module: string;
  count: number; // 이 모듈을 쓰는 액티비티 수
  hasSpec: boolean;
};

// 화면이 고르게 할 목록. 액티비티가 많은 모듈이 먼저입니다 —
// 스펙을 쓰면 그만큼 많이 쓰게 되니 그 차례가 곧 이득 순서입니다.
export function listModules(): ModuleRow[] {
  const have = new Set<string>();
  for (const subject of ["MA", "KO", "EN"]) {
    for (const m of listSpecs(subject)) have.add(subject + "/" + m);
  }
  const out: ModuleRow[] = [];
  for (const [key, list] of surveyAll()) {
    const [subject = "", module = ""] = key.split("/");
    out.push({ subject, module, count: list.length, hasSpec: have.has(key) });
  }
  return out.sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject));
}

export function moduleDir(subject: string, module: string): string {
  return path.join(
    workRoot(),
    "sparkon_common",
    "_common",
    "module",
    SUBJECT_DIR[subject] ?? subject,
    module,
  );
}

// ─── 잔손 ────────────────────────────────────────────────────────────────

function activityDirs(): string[] {
  const root = workRoot();
  const out: string[] = [];
  for (const repo of fs.readdirSync(root).filter((f) => /^sparkon_m\d\d$/.test(f))) {
    const base = path.join(root, repo, "src", "activity");
    let names: string[];
    try {
      names = fs.readdirSync(base);
    } catch {
      continue; // 아직 안 받아 둔 호가 있을 수 있습니다.
    }
    for (const n of names) {
      const dir = path.join(base, n);
      if (fs.existsSync(path.join(dir, "Activity.ts"))) out.push(dir);
    }
  }
  return out;
}

function subjectOf(dir: string): string {
  return path.basename(dir).slice(0, 2).toUpperCase();
}

function monthOf(dir: string): number {
  const m = /sparkon_m(\d\d)/.exec(dir);
  return m ? Number(m[1]) : 0;
}

function stub(dir: string): Sample {
  return { code: path.basename(dir), month: monthOf(dir), dir, root: null, data: undefined };
}

function readSample(dir: string): Sample {
  const s = stub(dir);
  try {
    const g = readGameData(dir);
    if (!g) return { ...s, note: "GameData.ts 가 없습니다" };
    return { ...s, root: g.root, data: g.data };
  } catch (e) {
    return { ...s, note: "읽다 막혔습니다: " + (e as Error).message };
  }
}
