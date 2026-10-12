// 차시 하나 풀기 — 앞선 호들이 그 칸에 쓴 모듈로 판정하고, 화면이 물을 수 있게 값으로 내준다(`placementFor`).
//
// 2026-09-30 에 `layout.ts` 에서 옮김 — 1007줄이라. **동작 변화 없음.** 까닭 · 전체 그림은 `layout.ts` 머리말이 정본이고, 바깥은 여태처럼 `layout.ts` 에서 가져다 쓴다.

import { parseStudyCode } from "./spec";
import { decide, humanPicks, scanCells, type Cell, type Decided, type Verdict } from "./layoutcore";
import { wbsOf } from "./layoutwbs";

// ─── 차시 하나 풀기 ──────────────────────────────────────────────────────

export type Placement = {
  slot: string; // L1W2S1 — 레벨·주차·순서
  verdict: Verdict;
  module: string; // 여러 모듈을 같이 쓰는 칸은 `A+B`
  other: string; // 교대의 반대쪽 · 갈림의 나머지 후보
  before: string[]; // 근거로 삼은 앞선 호
  at: Map<string, string>; // 호 → 모듈 (그 칸에서)
  wbs?: { title: string; code: string };
};

// 차시 하나를 풉니다. 표를 뿌릴 때도, 원본을 고를 때도 여기를 지납니다.
export function placementOf(
  subject: string,
  target: string,
  slot: string,
  cells: Cell[],
  human?: Map<string, Decided>,
): Placement {
  const at = new Map(cells.filter((c) => c.slot === slot).map((c) => [c.issue, c.module]));
  const issues = [...new Set(cells.map((c) => c.issue))].sort();
  // **호 전체가 비어 있으면 근거에서 뺍니다.** 껍데기만 만들어 둔 호가 있어서,
  // 그것을 「그 차시에 모듈이 없다」로 읽으면 판정이 통째로 흐려집니다.
  const builtIssue = (i: string): boolean => cells.some((c) => c.issue === i && c.module !== "");
  const before = issues.filter((i) => i < target && builtIssue(i));

  const d = decide(target, before, at);
  const { verdict, pick } = d;
  const w = wbsOf(subject, slot);

  // **사람이 정했으면 거기서 끝입니다.** 기계가 무엇을 골랐든 덮습니다.
  const mine = (human ?? humanPicks(subject, target)).get(slot);
  if (mine) {
    return {
      slot,
      verdict: "사람",
      module: mine.module,
      other: mine.why ?? "",
      before,
      at,
      ...(w ? { wbs: w } : {}),
    };
  }

  // **WBS 로 갈림을 풀지 않습니다.** 예전에는 이름이 겹치면 근거로 삼았는데
  // L1W1S1 에서 틀렸습니다 — WBS 의 E05 는 활동 종류 번호이지 폴더 이름이
  // 아니고, 겹친 것은 우연이었습니다. 갈리면 사람에게 넘깁니다.

  return { slot, verdict, module: pick, other: d.other, before, at, ...(w ? { wbs: w } : {}) };
}

// 그 차시가 **왜 안 정해졌나**를 던지지 않고 값으로 내줍니다.
//
// `originFor` 는 「갈림」에서 던집니다 — 명령줄에서는 그것이 맞습니다.
// 그런데 양산 화면은 그 자리에서 **사람에게 물어야** 하고, 물으려면 후보와
// 근거가 값으로 있어야 합니다. 글로 된 오류 문장을 화면이 뜯어 읽게 하면
// 문장을 손볼 때마다 화면이 조용히 망가집니다 (`_document/양산계획.md` 5단계).
export type PlacementView = {
  subject: string;
  issue: string;
  slot: string;
  verdict: Verdict;
  module: string;
  other: string;
  // 앞선 호가 그 차시에 무엇을 썼나. 후보의 **근거**가 이것입니다.
  before: { issue: string; module: string }[];
  wbs?: { title: string; code: string };
};

export function placementFor(input: string): PlacementView | null {
  const study = parseStudyCode(input);
  if (!study) return null;
  const target = String(study.month).padStart(2, "0");
  const slot = `L${study.level}W${study.week}S${study.session}`;
  const cells = scanCells(study.subject);
  if (!cells.length) return null;

  const p = placementOf(study.subject, target, slot, cells);
  return {
    subject: study.subject,
    issue: target,
    slot,
    verdict: p.verdict,
    module: p.module,
    other: p.other,
    before: p.before.map((i) => ({ issue: i, module: p.at.get(i) ?? "" })).filter((x) => x.module),
    ...(p.wbs ? { wbs: p.wbs } : {}),
  };
}

