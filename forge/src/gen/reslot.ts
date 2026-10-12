// 못 맞춘 자리가 **어떤 갈래인지** 가릅니다 — 「자리를 다시 세운다」의 앞단입니다.
//
// `swap` 이 이름으로 짝을 못 지은 자리는 뜻이 둘로 갈립니다.
//
//   고정 자리   `bg` · `roulette` — 모듈이 그 이름으로 찾습니다. 파일이 없으면
//               **리소스가 진짜 안 온 것**이라 사람에게 달라고 해야 합니다
//   낱말 자리   `skirt` · `blanket` — 원본 회차의 낱말입니다. 이 회차에는 그 자리가
//               **아예 없고** 새 낱말 자리가 생깁니다. 달라고 할 것이 아니라
//               **자리를 새로 세워야** 합니다
//
// 둘을 못 가르면 어느 쪽으로도 틀립니다 — 낱말 자리를 「파일을 주세요」라고 하면
// 있지도 않은 파일을 찾게 되고, 고정 자리를 낱말로 보면 **멀쩡한 자리를 갈아치웁니다.**
// 2026-09-15 에 8호 76차시를 재 보니 못 맞춘 2,540자리 가운데 **1,562(61%)가 낱말
// 자리**였는데, 도구가 전부 「파일을 주세요」로 물어서 AI 가 「맞출 짝이 없습니다」라고
// 답했습니다. 답이 없는 질문이었습니다 (`_document/자동양산.md` 2-1).
//
// **가르는 자 둘을 같이 씁니다.**
//
//   ① 스펙의 `assets.required`   모듈이 요구하는 고정 자리. 적혀 있으면 확실합니다
//   ② 같은 모듈을 쓰는 앞선 액티비티들에 그 별칭이 몇 번 나오나
//
// ②가 필요한 까닭은 스펙이 **고정 자리만** 적기 때문입니다. 8호에서 스펙 `required`
// 에 걸린 자리는 63개(2%)뿐이고 나머지 97%는 스펙 밖입니다 — 스펙이 덜 쓰인 것이
// 아니라 그것이 스펙의 설계입니다. 액티비티마다 다른 낱말 자리를 스펙에 적을 수는
// 없습니다.
//
// **②는 앞선 호만 봅니다.** 그래서 완성본이 없는 새 호에서도 그대로 씁니다.
//
// **모르는 것은 「모름」으로 둡니다.** 번호만 다른 무리(`page7` · `book3`)는 이름으로
// 영영 못 가릅니다 — 낱말이 바뀐 것이 아니라 **개수가 줄어든 것**이라, 이름이 아니라
// 짜임 문제입니다. 짐작해서 갈아치우지 않고 사람에게 묻습니다.
//
// **폴더에 있는 파일도 보려다 되돌렸습니다 (2026-09-15).** 「앞선 호에는 있는 이름인데
// 원본이 쓰던 파일 무리가 이 회차 폴더에 없으면 개수가 준 것」이라는 자를 넣어 재
// 봤습니다. **잘못 건드리는 자리는 635 → 134 로 줄었는데 묻는 몫이 394 → 1,512(60%)로
// 늘었습니다.** 「고정이라 봤는데 없는」 자리는 **헛된 요구일 뿐**이라 사람이 「없어요」
// 한 번이면 끝나는데, 묻는 몫 60% 는 **사람이 1,512자리를 손으로 답하는 것**입니다.
// 고치려던 것보다 나빠져서 뺐습니다 — 낱말 자리를 안 건드리는 것이 이 자의 값어치이고,
// 그것은 폴더를 안 봐도 이미 99% 입니다.

import { assetAliases } from "./survey";
import type { AssetKind } from "./types";
import { stemOf, specAliases, earlier } from "./reslotprior";

export type SlotVerdict =
  | "고정" // 이 이름 그대로 있어야 합니다. 파일이 없으면 리소스를 달라고 합니다
  | "낱말" // 이 회차에는 없는 자리입니다. 새 파일로 자리를 세웁니다
  | "개수" // 무리는 있는데 이 번호가 없습니다. 몇 개인지 물어야 합니다
  | "모름"; // 견줄 것이 모자랍니다. 짐작하지 않습니다

export type SlotJudge = {
  alias: string;
  kind: AssetKind;
  was: string; // 원본이 쓰던 파일
  verdict: SlotVerdict;
  why: string; // 사람이 읽는 까닭. 화면이 그대로 보여 줍니다
  seen: number; // 앞선 액티비티 몇 곳에 같은 별칭이 있었나
  total: number; // 견준 앞선 액티비티 수
  inSpec: boolean; // 스펙 `required` 에 적힌 자리인가
};

// 견줄 앞선 액티비티가 이만큼은 있어야 「없다」를 믿습니다. 하나만 보고
// 「이 회차에만 있는 이름」이라고 하면 그 하나가 특이한 경우일 때 틀립니다.
const MIN_SAMPLES = 2;

// 몇 곳에 나와야 「고정」으로 보나. 둘이면 우연이 아닙니다.
const FIXED_AT = 2;
/**
 * 못 맞춘 자리마다 갈래를 가립니다.
 *
 * `misses` 는 `swapResources()` 가 내놓은 것입니다 — 이름으로 짝을 못 지은 자리.
 */
export function judgeSlots(
  subject: string,
  module: string,
  code: string,
  misses: { alias: string; kind: AssetKind; file: string }[],
): SlotJudge[] {
  const inSpec = specAliases(subject, module);
  const samples = earlier(subject, module, code);
  const seenSets = samples.map((s) => new Set(assetAliases(s.dir).keys()));
  const stemSets = seenSets.map((set) => new Set([...set].map(stemOf)));
  const total = samples.length;

  return misses.map((m) => {
    const exact = seenSets.filter((set) => set.has(m.alias)).length;
    const byStem = stemSets.filter((set) => set.has(stemOf(m.alias))).length;

    // ① 스펙이 적어 둔 자리는 그것으로 끝입니다. 제일 믿을 만한 근거입니다.
    if (inSpec.has(m.alias)) {
      return row(m, "고정", `스펙이 ${module} 의 필수 자리로 적어 둔 이름입니다.`, exact, total, true);
    }

    // 견줄 것이 모자라면 짐작하지 않습니다.
    if (total < MIN_SAMPLES) {
      return row(
        m,
        "모름",
        total === 0
          ? `${module} 을 쓰는 앞선 액티비티가 없어 견줄 것이 없습니다.`
          : `견줄 앞선 액티비티가 ${total}개뿐이라 이 이름이 고정인지 가릴 수 없습니다.`,
        exact,
        total,
        false,
      );
    }

    // ② 같은 이름이 여러 곳에 있으면 고정입니다.
    if (exact >= FIXED_AT) {
      return row(m, "고정", `앞선 액티비티 ${exact}개가 같은 이름을 씁니다.`, exact, total, false);
    }

    // ③ 이름은 없는데 **번호만 다른 무리**가 있으면 개수 문제입니다.
    //    `page7` 은 낱말이 바뀐 것이 아니라 페이지가 줄어든 것입니다.
    if (byStem >= FIXED_AT) {
      return row(
        m,
        "개수",
        `${stemOf(m.alias) || m.alias} 무리는 앞선 액티비티 ${byStem}개에 있는데 이 번호는 없습니다 — 이 회차는 개수가 다를 수 있습니다.`,
        exact,
        total,
        false,
      );
    }

    // ④ 어디에도 없으면 원본 회차의 낱말입니다.
    return row(
      m,
      "낱말",
      `앞선 액티비티 ${total}개 어디에도 없는 이름입니다 — 원본 회차의 낱말로 보입니다.`,
      exact,
      total,
      false,
    );
  });
}

function row(
  m: { alias: string; kind: AssetKind; file: string },
  verdict: SlotVerdict,
  why: string,
  seen: number,
  total: number,
  inSpec: boolean,
): SlotJudge {
  return { alias: m.alias, kind: m.kind, was: m.file, verdict, why, seen, total, inSpec };
}
/** 갈래별로 몇 개인지. 화면이 「무엇이 몇 개」를 한 줄로 보여 줄 때 씁니다. */
export function countBy(judged: SlotJudge[]): Record<SlotVerdict, number> {
  const out: Record<SlotVerdict, number> = { 고정: 0, 낱말: 0, 개수: 0, 모름: 0 };
  for (const j of judged) out[j.verdict] += 1;
  return out;
}

//
// **견줄 재료와 원본에만 있던 자리는 떼어 냈습니다** (2026-09-30, 242줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   reslotprior    견줄 재료 — 앞선 표본 · 스펙이 적은 별칭 · 이름 줄기
//   reslotorigin   원본에만 있던 자리 (originOnly)

export { earlier } from "./reslotprior";
export { originOnly } from "./reslotorigin";
