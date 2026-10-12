// 배치표의 뿌리 — 학습코드 꼴 · 칸 · 판정(사람 · 한가지 · 교대 · 갈림) · 사람이 적어 둔 칸 · 영어 WBS.
//
// 2026-09-30 에 `layout.ts` 에서 옮김 — 1007줄이라. **동작 변화 없음.** 까닭 · 전체 그림은 `layout.ts` 머리말이 정본이고, 바깥은 여태처럼 `layout.ts` 에서 가져다 쓴다.

import fs from "fs";
import path from "path";
import { modulesOf } from "./survey";
import { repoPath, workRoot } from "./paths";

export const CODE = /^(MA|KO|EN)L(\d)M(\d\d)W(\d)S(\d)$/;

export type Cell = { slot: string; issue: string; module: string };
// **「사람」이 맨 위입니다.** 기계 판정은 앞선 호를 세어 본 짐작일 뿐이라,
// 사람이 정한 것이 있으면 그것을 씁니다. `_layout/<과목><호>.json` 에 적습니다.
export type Verdict = "사람" | "한가지" | "교대" | "갈림" | "없음";

// 사람이 정해 둔 차시. 없으면 빈 표입니다.
//
// **기계가 틀릴 수 있습니다.** 영어 8호 L1W1S1 이 그랬습니다 — 앞선 호가
// E05 와 PlaySparkLv2M2 로 갈렸는데, 배치표가 WBS 의 `E05` 와 폴더 `E05` 의
// 이름이 같은 것을 근거로 E05 를 골랐습니다. 실제로는 5호와 같은
// PlaySparkLv2M2 였습니다. **WBS 번호는 활동 종류 번호라 폴더 이름과 이어지지
// 않고, 겹친 것은 우연입니다** (2026-09-03).
// **표본(origin)은 사람이 못 박을 수 있습니다.** 기계는 「같은 차시자리 · 제일 가까운
// 앞선 호」로 고르는데, 그 자리가 그 모듈의 **변형 갈래**로 만들어져 있으면 엉뚱한
// 것을 베끼게 됩니다. 8호 L1W3S2 가 그랬습니다 — M27 은 퀴즈 캐릭터를 그림으로도
// 로티로도 낼 수 있는데 5호 L1W3S2 는 로티 갈래라, 기계가 그것을 집었습니다.
// 모듈이 같아도 값의 짜임이 갈리는 자리가 있으니 정한 사람이 적어 둡니다.
// `originWhy` 가 있으면 원본을 작업대에서 바꾼 것이다(`writeLayoutOrigin`)
export type Decided = { module: string; why?: string; origin?: string; originWhy?: string };

// **우리가 안 만드는 차시.** 국어는 협력사가 만드는 차시가 섞여 있어서,
// 진행판에 같이 두면 「우리가 아직 안 한 것」으로 읽힙니다. 뺀 것은 몇 개인지
// 세어서 알려 줍니다 — 조용히 사라지면 「36개인데 왜 30개지」가 됩니다.
export type Layout = {
  picks: Map<string, Decided>;
  // 원본만 사람이 고른 칸 — 모듈은 기계 판정 그대로(`originOnly`). `writeLayoutOrigin` 이 적는다
  origins: Map<string, string>;
  skip: Map<string, string>; // 칸 → 왜 빼는가
  skipNote: string; // 왜 이 호에서 빼는가 — 한 번만 적는 설명
};

export function layoutFile(subject: string, target: string): Layout {
  const picks = new Map<string, Decided>();
  const origins = new Map<string, string>();
  const skip = new Map<string, string>();
  let skipNote = "";
  try {
    const raw = fs.readFileSync(repoPath("_layout", `${subject}${target}.json`), "utf8");
    const j = JSON.parse(raw) as {
      slots?: Record<string, Decided & { originOnly?: boolean }>;
      skip?: Record<string, string>;
      skipNote?: string;
    };
    if (typeof j.skipNote === "string") skipNote = j.skipNote;
    for (const [slot, v] of Object.entries(j.slots ?? {})) {
      // **원본만 고른 칸은 모듈을 정한 칸이 아니다** — picks 에 넣으면 판정이 「사람」이 되어 교대 · 한가지가 가려진다
      if (v && v.originOnly === true) {
        if (typeof v.origin === "string" && v.origin) origins.set(slot, v.origin);
        continue;
      }
      if (v && typeof v.module === "string" && v.module) picks.set(slot, v);
    }
    for (const [slot, why] of Object.entries(j.skip ?? {})) {
      skip.set(slot, typeof why === "string" ? why : "");
    }
  } catch {
    // 파일이 없어도 됩니다 — 사람이 정한 것이 아직 없다는 뜻입니다.
  }
  return { picks, origins, skip, skipNote };
}

export function humanPicks(subject: string, target: string): Map<string, Decided> {
  return layoutFile(subject, target).picks;
}

// 사람이 적은 원본 — 모듈과 같이 정한 것이 먼저, 원본만 고른 것이 다음. 없으면 빈 글
export function pinnedOrigin(subject: string, target: string, slot: string): string {
  const l = layoutFile(subject, target);
  return l.picks.get(slot)?.origin ?? l.origins.get(slot) ?? "";
}

// 호 repo 를 전부 훑어 `차시 · 호 · 모듈`.
export function scanCells(subject: string): Cell[] {
  const root = workRoot();
  const out: Cell[] = [];
  let repos: string[];
  try {
    repos = fs.readdirSync(root).filter((f) => /^sparkon_m\d\d$/.test(f));
  } catch {
    return out;
  }
  for (const repo of repos) {
    const base = path.join(root, repo, "src", "activity");
    let names: string[];
    try {
      names = fs.readdirSync(base);
    } catch {
      continue;
    }
    for (const name of names) {
      const m = CODE.exec(name);
      if (!m || m[1] !== subject) continue;
      const dir = path.join(base, name);
      if (!fs.existsSync(path.join(dir, "Activity.ts"))) continue;
      // 과목이 어긋난 것은 뺍니다. sparkLib 모듈(VideoPlayer 등)은 남깁니다 —
      // 그 차시도 만들어야 하는 액티비티라 빈 칸으로 두면 셈이 틀립니다.
      const mods = modulesOf(dir)
        .filter((r) => r.subject === "" || r.subject === subject)
        .map((r) => r.module)
        .sort();
      out.push({ slot: `L${m[2]}W${m[4]}S${m[5]}`, issue: m[3] as string, module: mods.join("+") });
    }
  }
  return out;
}

// 앞선 호들의 값에서 대상 호의 값을 고릅니다.
export function decide(
  target: string,
  order: string[],
  at: Map<string, string>,
): { verdict: Verdict; pick: string; other: string } {
  const seq = order.map((i) => at.get(i) ?? "").filter((v) => v !== "");
  const kinds = [...new Set(seq)];
  if (kinds.length === 0) return { verdict: "없음", pick: "", other: "" };
  if (kinds.length === 1) return { verdict: "한가지", pick: kinds[0] as string, other: "" };

  if (kinds.length === 2) {
    // 홀수 호가 쓰는 것 · 짝수 호가 쓰는 것이 각각 하나로 모이면 교대입니다.
    const odd = new Set<string>();
    const even = new Set<string>();
    for (const i of order) {
      const v = at.get(i);
      if (!v) continue;
      (Number(i) % 2 === 1 ? odd : even).add(v);
    }
    if (odd.size === 1 && even.size === 1) {
      const mine = Number(target) % 2 === 1 ? odd : even;
      const theirs = Number(target) % 2 === 1 ? even : odd;
      return { verdict: "교대", pick: [...mine][0] as string, other: [...theirs][0] as string };
    }
  }

  // 갈림. 그래도 제일 잦은 것을 먼저 보여 줍니다 — 고르는 것은 사람 몫입니다.
  const count = new Map<string, number>();
  for (const v of seq) count.set(v, (count.get(v) ?? 0) + 1);
  const rank = [...count.entries()].sort((a, b) => b[1] - a[1]);
  return {
    verdict: "갈림",
    pick: (rank[0]?.[0] ?? "") as string,
    other: rank.slice(1).map(([k, c]) => `${k}×${c}`).join(" "),
  };
}

// ─── 뿌리기 ──────────────────────────────────────────────────────────────

// 호를 차례로 늘어놓고 같은 모듈이 이어지는 구간을 한 덩이로 묶습니다.
//   01-03 E09 · 04 E33 …
// 호마다 한 줄씩 뿌리면 눈으로 못 읽습니다. 바뀌는 자리만 보이게 합니다.
export function runs(order: string[], at: Map<string, string>): string {
  const out: string[] = [];
  let from = "";
  let prev = "";
  let last = "";
  const flush = (): void => {
    if (prev) out.push(`${from}${last !== from ? "-" + last : ""} ${prev}`);
  };
  for (const i of order) {
    const v = at.get(i) ?? "";
    if (v === prev) {
      last = i;
      continue;
    }
    flush();
    from = i;
    last = i;
    prev = v;
  }
  flush();
  return out.join(" · ");
}

