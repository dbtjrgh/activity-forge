// 영어 WBS 의 모듈 칸 — 눈으로 견주라고 뿌리기만 하고 판정에는 안 쓴다(까닭은 `layout.ts` 머리말).
//
// 2026-09-30 에 `layout.ts` 에서 옮김 — 1007줄이라. **동작 변화 없음.**

// ─── WBS ─────────────────────────────────────────────────────────────────
// 영어 WBS 의 모듈 칸. **여기 적힌 `E05` 는 폴더 이름이 아니라 활동 종류
// 번호입니다** — 차시마다 하나씩 붙어 있고 호가 달라도 그대로입니다.
//
// 그런데 폴더 이름이 그 번호인 것이 스무 개 있어서, 겹치면 확인에 씁니다.
// **겹친다고 늘 같은 것은 아닙니다** — 폴더 `E28` 은 WBS 의 `E28`(L3W4S2)이
// 아니라 `E22`(L3W3S3) 차시에서 쓰입니다. 그래서 「이름이 같고 그 차시에서
// 실제로 쓰인 적이 있을 때」만 근거로 삼습니다.
//
// **판정에는 안 씁니다 (2026-09-03).** 받은 표가 옛 정보라 지금 소스와 어긋난
// 자리가 있습니다. 눈으로 견주라고 뿌리기만 합니다 — 여기 적힌 번호를 보고
// 모듈을 고르지 마세요.
export const WBS_EN: Record<string, { title: string; code: string }> = {
  L1W1S1: { title: "Word Explorer", code: "E05" },
  L2W1S1: { title: "Word Explorer", code: "E06" },
  L3W1S1: { title: "Word Explorer", code: "E07" },
  L1W1S2: { title: "Story Movie", code: "E01" },
  L2W1S2: { title: "Story Movie", code: "E01" },
  L3W1S2: { title: "Story Movie", code: "E01" },
  L1W1S3: { title: "Word Play", code: "E08" },
  L2W1S3: { title: "Word Play", code: "E09" },
  L3W1S3: { title: "Word Play", code: "E10" },
  L1W2S1: { title: "Read Together", code: "E02" },
  L2W2S1: { title: "Read Together", code: "E02" },
  L3W2S1: { title: "Read Together", code: "E02" },
  L1W2S2: { title: "Story Check", code: "E03" },
  L2W2S2: { title: "Story Check", code: "E03" },
  L3W2S2: { title: "Story Check", code: "E03" },
  L1W2S3: { title: "My Mini Book", code: "E11" },
  L2W2S3: { title: "My Mini Book", code: "E12" },
  L3W2S3: { title: "My Mini Book", code: "E13" },
  L1W3S1: { title: "Sing Along", code: "E14" },
  L2W3S1: { title: "Sing Along", code: "E15" },
  L3W3S1: { title: "Sing Along", code: "E16" },
  L1W3S2: { title: "Word Adventure", code: "E17" },
  L2W3S2: { title: "Word Adventure", code: "E17" },
  L3W3S2: { title: "Word Adventure", code: "E19" },
  L1W3S3: { title: "Sentence Fun", code: "E20" },
  L2W3S3: { title: "Sentence Fun", code: "E21" },
  L3W3S3: { title: "Sentence Fun", code: "E22" },
  L1W4S1: { title: "Say Aloud", code: "E23" },
  L2W4S1: { title: "Say Aloud", code: "E24" },
  L3W4S1: { title: "Say Aloud", code: "E25" },
  L1W4S2: { title: "Write Now", code: "E26" },
  L2W4S2: { title: "Write Now", code: "E27" },
  L3W4S2: { title: "Write Now", code: "E28" },
  L1W4S3: { title: "Fun Quiz Game", code: "E04" },
  L2W4S3: { title: "Fun Quiz Game", code: "E04" },
  L3W4S3: { title: "Fun Quiz Game", code: "E04" },
};

// WBS 표가 있는 과목은 아직 영어뿐입니다. 없으면 근거 하나가 빠질 뿐입니다.
export function wbsOf(subject: string, slot: string): { title: string; code: string } | undefined {
  return subject === "EN" ? WBS_EN[slot] : undefined;
}

