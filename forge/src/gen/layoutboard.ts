// 만드는 차례 · 진행판 · 뺀 차시 — 화면과 명령이 같이 쓰는 값.
//
// 2026-09-30 에 `layout.ts` 에서 옮김 — 1007줄이라. **동작 변화 없음.** 까닭 · 전체 그림은 `layout.ts` 머리말이 정본이고, 바깥은 여태처럼 `layout.ts` 에서 가져다 쓴다.

import { listSpecs, resolveModule } from "./spec";
import { listFiles } from "./files";
import { layoutFile, scanCells, type Verdict } from "./layoutcore";
import { placementOf, type Placement } from "./layoutplace";
import { builtAt } from "./layoutargs";

// ─── 만드는 차례 ─────────────────────────────────────────────────────────
//
// **차시 번호대로 걷되, 모듈을 만나면 그 모듈을 쓰는 차시를 다 끝내고 갑니다.**
//
//   L1W1S2 가 VideoPlayer 면 → L2W1S2 · L3W1S2 도 VideoPlayer 이니 같이
//   그다음 아직 손 안 댄 제일 앞 차시로 돌아갑니다
//
// **한 모듈에 붙어 있는 동안이 제일 쌉니다.** 스펙을 한 번 읽어 두면 값의
//생김새가 머리에 남아 있고, 원본도 같은 모듈이라 리소스 이름 규칙이 같습니다.
// 모듈을 옮길 때마다 그것을 처음부터 다시 익힙니다.
export type Group = { module: string; codes: string[]; slots: string[]; decided: boolean; hasSpec: boolean };

export function moduleOrder(subject: string, target: string): Group[] {
  const cells = scanCells(subject);
  if (!cells.length) return [];
  const specs = new Set(listSpecs(subject));
  const lay = layoutFile(subject, target);
  const slots = [...new Set(cells.map((c) => c.slot))]
    .filter((x) => !lay.skip.has(x))
    .sort();

  const at = new Map<string, Placement>();
  for (const slot of slots) at.set(slot, placementOf(subject, target, slot, cells));

  const out: Group[] = [];
  const taken = new Set<string>();
  for (const slot of slots) {
    const p = at.get(slot) as Placement;
    // 모듈을 못 정한 차시는 묶을 열쇠가 없습니다. 차시 하나짜리로 뒤에 둡니다.
    const decided = p.verdict !== "갈림" && p.verdict !== "없음";
    const key = decided ? p.module : `?${slot}`;
    if (taken.has(key)) continue;
    taken.add(key);
    const mine = decided ? slots.filter((x) => {
      const q = at.get(x) as Placement;
      return q.verdict !== "갈림" && q.verdict !== "없음" && q.module === p.module;
    }) : [slot];
    const parts = p.module ? p.module.split("+") : [];
    out.push({
      module: p.module || "-",
      slots: mine,
      codes: mine.map((x) => `${subject}L${x[1]}M${target}W${x[3]}S${x[5]}`),
      decided,
      hasSpec: parts.length > 0 && parts.every((x) => specs.has(x)),
    });
  }
  return out;
}

// ─── 진행판 ──────────────────────────────────────────────────────────────

// 차시 하나가 어느 칸에 서 있나. **위에서부터 막힌 순서**입니다 —
// 모듈을 못 정하면 스펙도 리소스도 볼 것이 없습니다.
export type Stage = "모듈 못 정함" | "스펙 먼저" | "리소스 대기" | "만들 수 있음" | "만들었음";

// 차시 한 줄. 명령이 뿌리는 것도, 화면이 그리는 것도 이 값입니다.
export type BoardRow = {
  slot: string;
  code: string;
  module: string;
  verdict: Verdict;
  hasSpec: boolean;
  files: number; // 리소스 폴더에 놓인 파일 수 (readme.md 뺀 것)
  // 갈래별로도 셉니다. **총수만으로는 「소리만 왔다」를 못 봅니다** — 그림이
  // 아직인데 숫자가 17 이면 다 온 줄 알고 열었다가 되돌아 나오게 됩니다.
  rsc: { image: number; sound: number; lottie: number; font: number };
  stage: Stage;
  // 만든 것이면 Activity.ts 를 마지막으로 쓴 때(ms). 「오늘 몇 개 했나」를
  // 세는 데 씁니다 — 주간보고에 그대로 들어가는 숫자입니다.
  builtAt?: number;
  wbs?: { title: string; code: string };
  // 호 저장소에 이미 있는 그 액티비티가 실제로 쓰는 모듈 (2026-10-01). `module` 은 **앞선 호로 고른 판정**이라
  // 첫 호처럼 앞선 호가 없으면 비는데, 다 만든 칸은 모듈이 이미 정해져 있습니다 — 앱 진행판이 칸마다 모듈을 적습니다.
  usedModule?: string;
};

export function boardOf(subject: string, target: string): BoardRow[] {
  const cells = scanCells(subject);
  if (!cells.length) return [];
  const specs = new Set(listSpecs(subject));
  const lay = layoutFile(subject, target);
  const slots = [...new Set(cells.map((c) => c.slot))]
    .filter((x) => !lay.skip.has(x))
    .sort();
  const human = lay.picks;

  return slots.map((slot) => {
    const p = placementOf(subject, target, slot, cells, human);
    const code = `${subject}L${slot[1]}M${target}W${slot[3]}S${slot[5]}`;
    const parts = p.module ? p.module.split("+") : [];
    // M27_2 처럼 스펙이 따로 없는 **데이터 변형**은 본체 스펙으로 돌려서 봅니다.
    // 스펙의 aliases 가 그 짝을 적어 둡니다 — 안 돌리면 스펙이 있는데도
    // 「스펙 먼저」에서 막힙니다 (2026-09-07).
    const hasSpec =
      parts.length > 0 && parts.every((x) => specs.has(resolveModule(subject, x)));
    // readme.md 는 폴더를 만들 때 같이 놓는 안내문입니다. 리소스가 아닙니다.
    const found = (listFiles(code)?.files ?? []).filter(
      (f) => !/(^|\/)readme\.md$/i.test(f.name),
    );
    const rsc = { image: 0, sound: 0, lottie: 0, font: 0 };
    for (const f of found) rsc[f.kind] += 1;
    const files = found.length;
    const at = builtAt(code);
    const used = cells.find((c) => c.slot === slot && c.issue === target)?.module ?? "";
    const stage: Stage =
      p.verdict === "갈림" || p.verdict === "없음" ? "모듈 못 정함"
      : at !== null ? "만들었음"
      : !hasSpec ? "스펙 먼저"
      : files === 0 ? "리소스 대기"
      : "만들 수 있음";
    return {
      slot,
      code,
      module: p.module,
      verdict: p.verdict,
      hasSpec,
      files,
      rsc,
      stage,
      ...(at !== null ? { builtAt: at } : {}),
      ...(p.wbs ? { wbs: p.wbs } : {}),
      ...(used ? { usedModule: used } : {}),
    };
  });
}

// 진행판에서 뺀 차시. 화면과 명령이 「몇 개를 왜 뺐는지」를 같이 띄웁니다.
export function skippedOf(
  subject: string,
  target: string,
): { note: string; slots: { slot: string; why: string }[] } {
  const lay = layoutFile(subject, target);
  return {
    note: lay.skipNote,
    slots: [...lay.skip.entries()]
      .map(([slot, why]) => ({ slot, why }))
      .sort((a, b) => a.slot.localeCompare(b.slot)),
  };
}

