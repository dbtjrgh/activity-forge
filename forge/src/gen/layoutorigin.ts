// 원본 고르기 — 같은 모듈을 쓰는 가장 알맞은 앞 호를 베낄 원본으로(`originFor`). 짝 · 홀 M 은 `parity.ts`.
//
// 2026-09-30 에 `layout.ts` 에서 옮김 — 1007줄이라. **동작 변화 없음.** 까닭 · 전체 그림은 `layout.ts` 머리말이 정본이고, 바깥은 여태처럼 `layout.ts` 에서 가져다 쓴다.

import { parseStudyCode } from "./spec";
import { parityOf } from "./parity";
import { CODE, layoutFile, pinnedOrigin, runs, scanCells, type Cell, type Verdict } from "./layoutcore";
import { placementOf } from "./layoutplace";
import { reusesOther } from "./reused";

// ─── 원본 고르기 ─────────────────────────────────────────────────────────

// M 번호 → 호 이름. **M11 이 6호(방학)** 라 1 을 더하면 M05 가 「6호」가 됩니다(저장소 함정). 앱 쪽 표는 `shared/forge/board.ts` 의 `HO_OF`
function hoName(m: string): string {
  const n = Number(m);
  return n === 11 ? "6호(방학)" : n >= 6 ? `${n + 1}호` : `${n}호`;
}

// 호 차례 — M11 은 6호라 5호(M05)와 7호(M06) 사이입니다 (2026-10-01 사용자 결정 — 「6호 아래 것으로 후보」).
// 원본 후보의 앞 · 뒤와 가까움은 M 번호가 아니라 이 차례로 셉니다. 전에는 M 번호로 세서 9호를 만들 때 6호가 「뒤 호」로 밀렸고,
// 6호를 만들 때 7~11호가 「앞선 호」로 올라왔습니다. **모듈 판정(`layoutplace.ts`)은 그대로 M 번호입니다** — EN M11 은 칸이 한 칸씩 어긋나 판정에서 뺍니다(`layout.ts` 머리말).
function hoOf(m: string): number {
  const n = Number(m);
  return n === 11 ? 6 : n >= 6 ? n + 1 : n;
}

export type OriginPick = {
  target: string; // 만들 학습코드
  origin: string; // 베낄 학습코드
  slot: string;
  module: string;
  verdict: Verdict;
  why: string; // 사람에게 보일 한 줄
  sameSlot: boolean; // 원본이 같은 칸인가 — 아니면 값의 짜임이 다를 수 있습니다
  alt: string[]; // 다음 후보 몇 개. 고른 것이 마음에 안 들 때 씁니다
};

// 같은 모듈을 쓴 액티비티를 다 모아 **베끼기 좋은 순서**로 세웁니다.
//
// **차시자리에만 매달리지 않습니다 (2026-09-08).** 전에는 「같은 차시자리를
// 만든 앞선 호」만 봤습니다. 그래서 M28 이 7호 L1W1S2 에 멀쩡히 있는데도
// 8호 L1W1S3 은 「M28 을 쓴 호를 못 찾았습니다」로 끝났습니다. **모듈이 같으면
// 차시자리가 달라도 값의 생김새는 같습니다** — 베낄 것이 있는데 없다고 한
// 셈입니다. 이제 자리가 어긋난 것도 후보로 두되, 순서로 갈라 놓습니다.
//
//   1  같은 차시자리 · 앞선 호     제일 닮았습니다
//   2  같은 호 · 다른 차시         이번 호라 리소스 이름 규칙이 같습니다
//   3  앞선 호 · 다른 차시         호가 가까운 것 먼저
//   4  뒤 호                       짜임이 다를 수 있습니다
//
// 같은 등급 안에서는 **같은 레벨 → 호가 가까운 것 → 같은 주·차시** 순입니다 (2026-10-01 에 레벨을 호 위로 —
// 전에는 호가 가까울수록 리소스 이름 규칙과 기획의 짜임이 닮아 손댈 것이 적다고 호를 위에 뒀습니다. 레벨이 다르면 값의 난이도 · 개수가 달라 그쪽이 더 큽니다).
function originsUsing(
  subject: string,
  target: string,
  slot: string,
  module: string,
  cells: Cell[],
): { code: string; tier: number; issue: string; slot: string }[] {
  const level = slot.slice(0, 2); // L1
  const ws = slot.slice(2); // W1S3
  const out: { code: string; tier: number; issue: string; slot: string; rank: number }[] = [];
  for (const c of cells) {
    // **모듈 둘을 같이 쓰는 차시(`A+B`)도 후보입니다.** 통째로 같은 것을 먼저
    // 세우고, 섞인 것은 뒤로 미룹니다 — 베낄 때 남의 모듈 값이 딸려 옵니다.
    const mods = c.module.split("+");
    if (!mods.includes(module)) continue;
    if (c.issue === target && c.slot === slot) continue; // 자기 자신
    const earlier = hoOf(c.issue) < hoOf(target);
    const tier =
      c.slot === slot && earlier ? 1
      : c.issue === target ? 2
      : earlier ? 3
      : 4;
    // 앞선 호는 가까운 호가 먼저, 뒤 호도 가까운 호가 먼저입니다 — 호 차례(`hoOf`)로 셉니다.
    const near = tier === 4 ? hoOf(c.issue) : -hoOf(c.issue);
    // **레벨이 같은 것이 호가 가까운 것보다 먼저입니다** (2026-10-01). 6호를 앞 호로 세자 9호 Lv2 가 6호 Lv3 을 떴습니다 —
    // 레벨이 다르면 값의 난이도 · 개수가 다릅니다. 같은 레벨 안에서는 여태처럼 호가 가까운 것 먼저
    const rank =
      (c.slot.slice(0, 2) === level ? 0 : 10000) +
      near * 100 +
      (c.slot.slice(2) === ws ? 0 : 4) +
      (mods.length === 1 ? 0 : 2);
    out.push({
      code: `${subject}${c.slot.slice(0, 2)}M${c.issue}${c.slot.slice(2)}`,
      tier,
      issue: c.issue,
      slot: c.slot,
      rank,
    });
  }
  out.sort((a, b) => a.tier - b.tier || a.rank - b.rank);
  return out;
}

// 만들 학습코드 하나로 원본 회차를 찾습니다. 못 찾으면 **왜 못 찾았는지**를
// 담아 던집니다 — 「사람이 정해야 하는 차시」인지 「아직 아무도 안 만든
// 차시」인지가 갈리고, 할 일이 서로 다릅니다.
// 원본 후보를 베끼기 좋은 차례로 — `originFor` 와 `originChoices` 가 같이 씁니다. 모듈을 못 정하면 까닭을 담아 던집니다.
function ranking(input: string) {
  const study = parseStudyCode(input);
  if (!study) throw new Error(`학습코드를 인식할 수 없습니다: ${input}`);
  const target = String(study.month).padStart(2, "0");
  const slot = `L${study.level}W${study.week}S${study.session}`;

  const cells = scanCells(study.subject);
  if (!cells.length) {
    throw new Error(`${study.subject} 액티비티를 못 찾았습니다 — 호 저장소 경로를 확인하세요.`);
  }

  const p = placementOf(study.subject, target, slot, cells);

  if (p.verdict === "없음") {
    throw new Error(
      `${slot} 칸을 만든 앞선 호가 없습니다 — 베낄 것이 없습니다.\n` +
        `  원본을 직접 적거나, 모듈부터 골라 스펙으로 만드세요.`,
    );
  }
  if (p.verdict === "갈림") {
    throw new Error(
      `${slot} 칸은 앞선 호마다 모듈이 달라 하나로 못 고릅니다 — ${p.module} ${p.other}\n` +
        `  ${runs(p.before, p.at)}\n` +
        `  사람이 정해야 하는 칸입니다. 정했으면 원본 학습코드를 직접 적어 주세요.`,
    );
  }

  // 같은 모듈을 쓴 액티비티 중 제일 나은 것. 같은 차시자리가 있으면 그것이고,
  // 없으면 자리가 어긋난 것이라도 떠 옵니다 — 아래 `originsUsing` 참고.
  const ranked = originsUsing(study.subject, target, slot, p.module, cells);
  // **짝 · 홀 M 이 판을 가르는 모듈이면 같은 등급 안에서 짝 · 홀이 같은 호를 먼저** (`parity.ts`) — 9호 K30 이 8호(편지)를 떴다
  const parity = parityOf(study.subject, p.module, cells);
  if (parity.prefers) {
    const odd = (issue: string): number => (Number(issue) % 2 === Number(target) % 2 ? 0 : 1);
    ranked.sort((a, b) => a.tier - b.tier || odd(a.issue) - odd(b.issue)); // 안정 정렬이라 등급 안 차례는 그대로
  }
  // **다른 호 파일을 다시 쓴 완성본은 같은 등급 · 같은 레벨 안에서 뒤로** (`reused.ts`) — 9호가 6호(방학)를 떠 3호 애니메이션을 가져왔다
  const lv = (r: { slot: string }): number => (r.slot.slice(0, 2) === slot.slice(0, 2) ? 0 : 1);
  ranked.sort((a, b) => a.tier - b.tier || lv(a) - lv(b) || Number(reusesOther(a.code)) - Number(reusesOther(b.code)));
  return { study, target, slot, cells, p, ranked, parity };
}

// 사람이 원본을 고를 때 보일 후보 — 그 모듈을 쓴 액티비티 **전부**, 베끼기 좋은 차례로 (2026-09-30, 앱의 「원본 바꾸기」).
// `pinned` 는 배치표에 사람이 적은 원본, `first` 는 사람이 안 적었으면 기계가 고를 것, `changed` 는 작업대에서 바꾼 것인가(되돌릴 수 있나).
function changedHere(subject: string, target: string, slot: string): boolean {
  const l = layoutFile(subject, target);
  return l.origins.has(slot) || typeof l.picks.get(slot)?.originWhy === "string";
}

export function originChoices(input: string) {
  const { study, target, slot, p, ranked } = ranking(input);
  return {
    module: p.module,
    slot,
    pinned: pinnedOrigin(study.subject, target, slot),
    changed: changedHere(study.subject, target, slot),
    first: ranked[0]?.code ?? "",
    choices: ranked.map((r) => ({ code: r.code, issue: r.issue, slot: r.slot, sameSlot: r.tier === 1 })),
  };
}

export function originFor(input: string): OriginPick {
  const { study, target, slot, cells, p, ranked, parity } = ranking(input);

  // **사람이 적은 표본이 맨 위입니다.** 적혀 있으면 기계의 1등은 후보로 내립니다.
  // 적힌 것이 없는 액티비티이거나 그 모듈을 안 쓰면 잠자코 넘기지 않고 멈춥니다 —
  // 배치표의 오타를 조용히 무시하면 「적어 놨는데 왜 딴 것을 베끼지」로 되돌아옵니다.
  const pinned = pinnedOrigin(study.subject, target, slot);
  if (pinned) {
    const m = CODE.exec(pinned);
    const ok =
      m !== null &&
      cells.some(
        (c) =>
          c.slot === `L${m[2]}W${m[4]}S${m[5]}` &&
          c.issue === m[3] &&
          c.module.split("+").includes(p.module),
      );
    if (!ok) {
      throw new Error(
        `배치표에 적힌 표본 ${pinned} 를 못 씁니다 — 없는 액티비티이거나 ${p.module} 을 안 씁니다.\n` +
          `  _layout/${study.subject}${target}.json 의 ${slot}.origin 을 고치세요.`,
      );
    }
  }

  // 사람이 적은 원본도 후보 줄에서 찾아 **제 등급**으로 — 전에는 늘 「같은 칸」으로 적혀 다른 칸 원본을 가렸습니다
  const best = pinned ? (ranked.find((r) => r.code === pinned) ?? { code: pinned, tier: 1, issue: target, slot }) : ranked[0];
  if (!best) {
    throw new Error(
      `${p.module} 을 쓴 액티비티가 아직 하나도 없습니다 — 베낄 것이 없습니다.\n` +
        `  이 모듈로 만드는 첫 회차입니다. 스펙(_spec/${study.subject}/${p.module}.json)으로 만드세요.`,
    );
  }

  const picked =
    p.verdict === "사람" ? (p.other || "사람이 정했습니다")
    : p.verdict === "한가지"
      ? `앞선 호 ${p.before.filter((i) => p.at.get(i)).length}개가 다 ${p.module} 입니다`
      : p.verdict === "교대"
        ? `홀·짝 호가 번갈아 씁니다 — ${Number(target) % 2 === 1 ? "홀수" : "짝수"} 호는 ${p.module} · 반대쪽은 ${p.other}`
        : `앞선 호를 세어 골랐습니다`;

  // **자리가 어긋난 원본은 그렇다고 말합니다.** 값의 짜임은 모듈이 정하니
  // 베껴도 되지만, 문구와 리소스 이름은 그 차시의 것이라 다 갈아야 합니다.
  const at = `${hoName(best.issue)} ${best.slot}`;
  const where =
    best.tier === 1 ? ""
    : best.tier === 2 ? ` — 이 칸을 만든 앞선 호가 없어 같은 호 ${best.slot} 에서 떠 옵니다`
    : best.tier === 3 ? ` — 이 칸을 만든 앞선 호가 없어 ${at} 에서 떠 옵니다`
    : ` — 앞선 호에 없어 ${at} 에서 떠 옵니다. 뒤 호라 짜임이 다를 수 있습니다`;

  return {
    target: study.code,
    origin: best.code,
    slot,
    module: p.module,
    verdict: p.verdict,
    why:
      picked +
      (pinned ? " — 표본은 배치표에 적힌 것을 씁니다" : where) +
      (parity.prefers && !pinned ? ` · 짝 · 홀이 같은 호를 먼저 떴습니다(완성본 ${parity.same} : ${parity.near})` : ""),
    sameSlot: best.tier === 1,
    alt: ranked
      .filter((r) => r.code !== best.code)
      .slice(0, 3)
      .map((r) => r.code),
  };
}

