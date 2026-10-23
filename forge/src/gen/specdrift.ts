// **스펙이 모듈보다 낡았나** (2026-10-14).
//
// 스펙은 모듈 코드를 읽고 쓴 것인데 공용 모듈은 다른 팀도 고칩니다. 2026-10-06 에 K05 478422f · K06 883098e ·
// K14 4687565 가 5이닝 고정을 풀었고, 10-08 에 K15 920456c 가 GameData 에 새 칸 둘(outlineDelay · outlineHold)을 더했습니다.
// 스펙은 그것을 모른 채 10호 4이닝 학습코드를 「5개 이상이어야」로 막았고, 새 칸은 「모듈이 읽지 않습니다」라고 했습니다.
//
// 그래서 스펙에 **마지막으로 맞춰 본 모듈 커밋**(`reference.moduleCommit`)을 적고, 이 PC 공용 저장소에서 그 모듈 폴더의
// 마지막 커밋과 견줍니다. **막지 않습니다** — 소리 · 연출만 고친 커밋도 많아 스펙과 늘 닿지는 않습니다. 볼 커밋을 짚을 뿐입니다.
// 맞춰 본 뒤 커밋을 적는 것은 `tool/specpin.ts` 입니다.
//
// git 은 **비동기**로 부릅니다 — 앱 메인 프로세스가 부르면 동기 호출 동안 화면이 멈춥니다(저장소 CLAUDE.md 함정).
// 원격은 안 봅니다(fetch 없음). 이 PC 의 공용 저장소 기준입니다.

import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { COMMON_NAME, commonRoot } from "./commonroot";
import { SPEC_ROOT, specPath } from "./spec";
import { moduleDir } from "./surveyfind";
import type { Spec } from "./types";

export type SpecDrift = {
  /** 모듈이 스펙보다 새것인가. 견주지 못했으면 false 이고 `note` 가 까닭을 말한다 */
  drift: boolean;
  /** 그 사이 모듈 커밋, 새것 먼저 — 「짧은 해시 날짜 이름 제목」 */
  commits: string[];
  /** 사람에게 보일 한 문장 */
  note: string;
  /** 견줘 봤나 — 스펙 · 적힌 커밋 · 모듈 폴더 · 공용 저장소가 다 있어야 */
  known: boolean;
  /** 스펙에 적힌 커밋 */
  pinned: string | null;
  /** 모듈 폴더의 마지막 커밋 */
  head: string | null;
};

/** 그 사이 커밋은 이만큼까지만 싣는다 — 한 모듈이 몇 달 밀리면 수십 개다 */
const SHOWN = 30;
/** 한 번에 도는 git 수 — 120장을 한꺼번에 띄우면 Windows 에서 프로세스가 밀린다 */
const AT_ONCE = 4;
const LINE = "%h %ad %an %s";

// 공용 저장소 자리는 `paths.ts` 하나로 옮겼습니다(2026-10-21, 사람이 정할 수 있게). `tool/specpin.ts` 가 여기서 가져가므로 다시 내보냅니다
export { commonRoot };

/**
 * 모듈 소스 자리 — 공용 저장소 안의 상대 경로(`/`). 못 찾으면 null.
 *
 * 과목 폴더 이름(KO ↔ KR)은 `moduleDir` 의 표 하나를 씁니다. 거기 없으면 스펙의 `reference.module` 을 봅니다 —
 * sparkLib 모듈(ANI · InterBook · VideoPlayer)은 `…/VideoPlayer/VideoPlayActivity` 처럼 **파일 이름**까지 적혀 있어,
 * 그 파일이 든 폴더를 봅니다(그대로 넘기면 git 이 0건이라 「안 바뀜」으로 보인다).
 */
export function modulePathspec(subject: string, module: string, refModule?: string): string | null {
  const cands = [moduleDir(subject, module)];
  // 스펙에 적힌 `sparkon_common/…` 은 폴더 이름이 아니라 공용 저장소를 가리키는 머리글이다 — 자리는 `commonRoot()` (2026-10-21)
  if (refModule?.startsWith(COMMON_NAME + "/")) cands.push(path.join(commonRoot(), refModule.slice(COMMON_NAME.length + 1)));
  // 과목이 없는 sparkLib 모듈 — EN VideoPlayer 스펙은 `module/EN/VideoPlayer` 로 적혀 있는데 그런 폴더가 없다
  cands.push(path.join(commonRoot(), "_common", "sparkLib", "module", module));
  for (const c of cands) {
    if (isDir(c)) return relCommon(c);
    if (fs.existsSync(c + ".ts")) return relCommon(path.dirname(c));
  }
  return null;
}

/** 스펙 한 장을 모듈과 견준다. 오류는 던지지 않고 `note` 에 담는다 */
export async function specDrift(subject: string, module: string): Promise<SpecDrift> {
  const blank = (note: string, pinned: string | null = null): SpecDrift => ({
    drift: false,
    commits: [],
    note,
    known: false,
    pinned,
    head: null,
  });
  const spec = readSpec(subject, module);
  if (!spec) return blank(`${module} 스펙이 없습니다.`);
  const pinned = spec.reference?.moduleCommit ?? null;
  if (!pinned) return blank(`${module} 스펙에 맞춰 본 모듈 커밋(reference.moduleCommit)이 적혀 있지 않습니다.`);
  const root = commonRoot();
  if (!fs.existsSync(path.join(root, ".git"))) return blank(`공용 저장소(${root})를 찾지 못해 견주지 못했습니다.`, pinned);
  const spot = modulePathspec(subject, module, spec.reference?.module);
  if (!spot) return blank(`${module} 모듈 폴더를 공용 저장소에서 찾지 못해 견주지 못했습니다.`, pinned);

  const last = await git(root, ["log", "-1", "--format=%H", "--", spot]);
  if ("error" in last) return blank(`${module} 모듈 커밋을 읽지 못했습니다 — ${last.error}`, pinned);
  const head = last.out.trim() || null;
  if (!head) return { ...blank(`${spot} 에 커밋이 없습니다.`, pinned), head };
  if (head.startsWith(pinned) || pinned.startsWith(head)) {
    return { drift: false, commits: [], note: `${module} 스펙이 모듈 마지막 커밋(${head.slice(0, 7)})과 맞춰져 있습니다.`, known: true, pinned, head };
  }

  const range = await git(root, ["log", `--format=${LINE}`, "--date=short", `${pinned}..HEAD`, "--", spot]);
  if ("error" in range) {
    return {
      ...blank(`스펙에 적힌 커밋 ${pinned.slice(0, 7)} 이 이 PC 공용 저장소에 없습니다. 공용 저장소를 받지 않았거나 잘못 적힌 커밋입니다.`, pinned),
      head,
    };
  }
  const all = range.out.split(/\r?\n/).filter(Boolean);
  if (!all.length) {
    // 적힌 커밋이 HEAD 보다 앞선다 — 다른 PC 에서 더 새 모듈로 맞춰 적었다
    return {
      drift: false,
      commits: [],
      note: `${module} 스펙이 이 PC 공용 저장소보다 새 모듈 커밋(${pinned.slice(0, 7)})에 맞춰져 있습니다. 공용 저장소를 받으세요.`,
      known: true,
      pinned,
      head,
    };
  }
  const shown = all.slice(0, SHOWN);
  const more = all.length > 3 ? ` 외 ${all.length - 3}개` : "";
  return {
    drift: true,
    commits: shown,
    note: `${module} 모듈이 스펙보다 새것입니다 — 그 사이 커밋: ${all.slice(0, 3).join(", ")}${more}`,
    known: true,
    pinned,
    head,
  };
}

/** 여럿을 한꺼번에 — `AT_ONCE` 개씩. 열쇠는 「과목/모듈」 */
export async function specDrifts(list: { subject: string; module: string }[]): Promise<Map<string, SpecDrift>> {
  const keys = [...new Set(list.map((x) => `${x.subject}/${x.module}`))];
  const out = new Map<string, SpecDrift>();
  for (let i = 0; i < keys.length; i += AT_ONCE) {
    const part = keys.slice(i, i + AT_ONCE);
    const got = await Promise.all(
      part.map((k) => {
        const [subject = "", module = ""] = k.split("/");
        return specDrift(subject, module);
      }),
    );
    part.forEach((k, j) => out.set(k, got[j] as SpecDrift));
  }
  return out;
}

/** 스펙 파일 전부 — 과목 폴더와 `_common`. 과목은 파일 안의 `subject` 를 믿는다(`_common` 은 폴더가 과목이 아니다) */
export function allSpecs(): { subject: string; module: string; file: string }[] {
  const out: { subject: string; module: string; file: string }[] = [];
  if (!isDir(SPEC_ROOT)) return out;
  for (const dir of fs.readdirSync(SPEC_ROOT).sort()) {
    const d = path.join(SPEC_ROOT, dir);
    if (!isDir(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith(".json")).sort()) {
      const file = path.join(d, f);
      try {
        const s = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Spec>;
        out.push({ subject: s.subject ?? dir, module: s.module ?? f.slice(0, -5), file });
      } catch {
        // 깨진 JSON 은 check:spec ① 이 짚는다
      }
    }
  }
  return out;
}

// ─── 잔손 ────────────────────────────────────────────────────────────────

/** 공용 저장소에서 git 한 번. 셸 없이 · 묻지 않고 · 시간 상한 */
export function git(cwd: string, args: string[]): Promise<{ out: string } | { error: string }> {
  return new Promise((ok) => {
    execFile(
      "git",
      ["-C", cwd, "-c", "core.quotepath=off", ...args],
      { windowsHide: true, timeout: 20_000, maxBuffer: 4 * 1024 * 1024, encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
      (err, stdout, stderr) => {
        if (err) ok({ error: (String(stderr).trim().split(/\r?\n/)[0] || err.message).slice(0, 200) });
        else ok({ out: String(stdout) });
      },
    );
  });
}

function readSpec(subject: string, module: string): Spec | null {
  // `loadSpec` 은 없으면 던진다 — 여기는 「없음」도 답이라 자리만 `specPath` 에 묻고 직접 읽는다
  const file = specPath(subject, module);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Spec;
  } catch {
    return null;
  }
}

function relCommon(abs: string): string {
  return path.relative(commonRoot(), abs).split(path.sep).join("/");
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
