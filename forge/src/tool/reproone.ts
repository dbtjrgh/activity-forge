// 재현 검사 — 한 액티비티를 자기 값으로 다시 뽑아 견준다.
//
// `checkRepro.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `checkRepro.ts` 에서 가져다 씁니다.

import { assetAliases } from "@/gen/survey";
import { type Diff, diffValue } from "./reprovalue";
import { parseText } from "./reprotext";
import { cmpActivity, cmpText, firstExport, aliasesOfText } from "./reproactivity";

// ─── 한 액티비티 ─────────────────────────────────────────────────────────

// 글자 그대로 같아야 하는 것. `_default` 에서 복사만 하는 파일들입니다.
const COPIED = ["index.html", "App.vue", "main.ts", "style.css"];

// **세 갈래입니다.** 「다르다」가 다 실패는 아닙니다.
//
//   ok     원본과 같습니다
//   fail   **값이나 코드가 다릅니다.** 이것만 실패입니다
//   note   다르지만 동작이 아닙니다 — 템플릿이 호마다 갈린 것, 기본값을 채운 것
//
// 갈라 두지 않으면 진짜가 묻힙니다. 첫 판에 227건이 나왔는데 그중 대부분이
// 따옴표와 import 차례였습니다.
export type Verdict = {
  file: string;
  level: "ok" | "fail" | "note";
  why?: string;
  added?: number;
};

export function checkOne(
  dir: string,
  gen: Record<string, string>,
  data: unknown,
): Verdict[] {
  const out: Verdict[] = [];

  // ① GameData.ts — 값으로
  const genData = firstExport(
    parseText(gen["GameData.ts"] ?? "", "GameData.ts"),
  );
  const d: Diff = { lost: [], added: [] };
  diffValue(data, genData, "", d);
  out.push({
    file: "GameData.ts",
    level: d.lost.length === 0 ? "ok" : "fail",
    ...(d.lost.length ? { why: d.lost.join(" / ") } : {}),
    ...(d.added.length ? { added: d.added.length } : {}),
  });

  // ② Activity.ts — 코드로 (주석·따옴표·import 차례는 빼고)
  out.push(cmpActivity(dir, gen["Activity.ts"]));

  // ③ AssetTable.ts — 별칭으로
  const want = [...assetAliases(dir).keys()].sort();
  const got = [...aliasesOfText(gen["AssetTable.ts"] ?? "").keys()].sort();
  const missing = want.filter((a) => !got.includes(a));
  const extra = got.filter((a) => !want.includes(a));
  out.push(
    missing.length === 0 && extra.length === 0
      ? { file: "AssetTable.ts", level: "ok" }
      : {
          file: "AssetTable.ts",
          level: "fail",
          why: [
            missing.length
              ? `빠진 별칭 ${missing.length}개 (${missing.slice(0, 3).join(", ")})`
              : "",
            extra.length
              ? `없던 별칭 ${extra.length}개 (${extra.slice(0, 3).join(", ")})`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
        },
  );

  // ④ 복사만 하는 파일 — 글자 그대로.
  // **알림입니다.** 다르면 생성기가 틀린 것이 아니라 **이 호의 `_default` 가
  // 내 템플릿과 갈린 것**입니다(m05·m06 만 자기 `_default` 를 갖고 있습니다).
  for (const name of COPIED) out.push(cmpText(dir, gen, name));

  return out;
}

// `Activity.ts` 는 **사람이 손으로 쓴 것**과 견줍니다. 그래서 동작과 상관없는
// 차이를 먼저 걷어냅니다 — 주석 · 따옴표 · import 차례. 남는 것만 봅니다.
//
//   들여온 것   있어야 할 import 가 빠졌나 (**여기가 진짜입니다** — 모듈을
//               안 들여오면 액티비티가 안 돕니다)
//   몸통        onLoad·onInit·onStart·onEnd 안의 줄
