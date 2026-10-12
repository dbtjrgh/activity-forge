// 이름 붙은 규칙 — 스펙 rules[].id 로 골라 도는 검사 · 돌리기. 자리 · 표 규칙은 `resolveslotrules.ts`.
//
// 2026-09-30 에 `resolve.ts` 에서 옮김 — 960줄이라. **동작 변화 없음.** 입구(`resolveGameData`)와 전체 그림은 `resolve.ts`.

import type { Spec } from "./types";
import type { Ctx } from "./resolve";
import { SLOT_RULES } from "./resolveslotrules";
import { err } from "./resolveissue";

// ─── 이름 붙은 규칙 ──────────────────────────────────────────────────────
//
// 타입만으로는 못 잡는 것들. 스펙의 rules[].id 로 골라 씁니다.
// 여기 없는 id 는 「사람이 봐야 하는 규칙」으로 남겨 두고 그렇다고 알립니다.

export type RuleFn = (ctx: Ctx) => void;

export function correctCount(ctx: Ctx, rule: string, ok: (n: number) => boolean): void {
  const innings = ctx.root["inningData"];
  if (!Array.isArray(innings)) return;
  innings.forEach((inn, i) => {
    const items = (inn as any)?.answer?.items;
    if (!Array.isArray(items)) return;
    const n = items.filter((it: any) => it?.correct === true).length;
    if (ok(n)) return;
    err(
      ctx,
      rule,
      `quizData.inningData[${i}].answer.items`,
      rule === "exactly-one-correct"
        ? `correct: true 가 ${n}개입니다. 정확히 1개여야 합니다.`
        : `correct: true 가 없습니다. 적어도 1개여야 합니다.`,
      n === 0 ? "0개면 이닝이 끝나지 않습니다." : "2개 이상이면 앞의 것만 정답 처리됩니다.",
    );
  });
}

const RULES: Record<string, RuleFn | "generic"> = {
  "fixed-alias-registered": "generic", // checkFixedAliases 에서 처리
  "alias-exists-in-assettable": "generic",
  "unknown-field": "generic",
  "no-empty-ani-placeholder": "generic", // checkVariant
  "image-variant-needs-alias": "generic",

  "exactly-one-correct": (ctx) => correctCount(ctx, "exactly-one-correct", (n) => n === 1),
  // M27 은 칸마다 따로 `correct` 를 본다(AnswerPanel.ts:156) — 둘을 정답으로 두면 둘 다
  // 이닝을 끝낸다. MAL3M05W4S2 5이닝이 그렇게 나가 있다 (2026-09-28). 0개만 막는다.
  "at-least-one-correct": (ctx) => correctCount(ctx, "at-least-one-correct", (n) => n >= 1),

  // ─ M05 ─ 둘 다 **빌드는 통과하고 진행만 막히는** 것입니다.
  //
  // 2026-09-21 에 완성본과 손으로 견주다 찾았습니다. 도구가 `M05_Answer.value`
  // 를 3→5칸으로 늘려 놓고 `Com_Inning.length` 는 3으로 두었고, 그러면 4·5이닝이
  // **무조건 오답**입니다(M05_Answer.ts:90 — 범위 밖). 에러도 카드도 안 났습니다.

  // **오답에 악기 소리를 낼지는 악기가 정한다** (2026-09-28). 드럼이면 true, 실로폰·피아노면
  // false — M05 완성본 21개가 다 그렇다. 소리 파일 이름에 악기가 있으니 셈으로 안다.
  // MAL2M07W2S1 을 만들어 보니 원본(실로폰)의 false 가 드럼 회차에 그대로 남았다.
  "sfxcheck-by-instrument": (ctx) => {
    const btn = ctx.recipe.assets?.sound?.find((a) => a.alias === "btn_sfx_0");
    const got = (ctx.root["M05_Answer"] as any)?.sfxCheck;
    if (!btn?.file || typeof got !== "boolean") return;
    const want = /(^|\/)SL_drum_/i.test(btn.file);
    if (got === want) return;
    err(ctx, "sfxcheck-by-instrument", "quizData.M05_Answer.sfxCheck",
      `단추 소리가 ${want ? "드럼" : "드럼이 아닌 악기"}(${btn.file})라 ${want} 여야 하는데 ${got} 입니다.`,
      "드럼은 오답에 악기 소리를 안 내고, 실로폰·피아노는 낸다.");
  },

  // **바깥 칸 수(= 이닝 수)는 스펙 관계 `inning-count-matches` 가 봅니다**
  // (2026-09-23 에 옮겼습니다 — 칸 수를 맞출 때 그 관계로 이닝 수도 같이 맞추므로
  // 여기 두면 같은 것을 두 번 봅니다). 여기는 안쪽 칸 수만 봅니다.
  "answer-table-shape": (ctx) => {
    const value = (ctx.root["M05_Answer"] as any)?.value;
    const step = (ctx.root["M05_View"] as any)?.data?.step;
    if (!Array.isArray(value)) return;
    // **`step: 0` 은 「안 쓴다」는 뜻입니다.** 스펙은 안쪽 칸 수도 `step` 과
    // 같아야 한다고 적어 두었지만, 이미 돌아가는 `MAL1M01W4S1` 이 `step: 0` 에
    // 이닝마다 7·6·7·5칸입니다 — **이닝마다 단계 수가 다른 차시가 있습니다.**
    // 도구의 규칙이 완성본과 어긋나면 완성본이 맞습니다(저장소 함정).
    // 그래서 `step` 을 실제로 쓰는 차시에서만 봅니다.
    // **`step` 이 없으면 그 이닝의 보기 수를 봅니다** (2026-09-28). `M05_View.image.inning_{i}` 의
    // `view_` 열쇠 수가 안쪽 칸 수와 같다 — `inning_` 표를 쓰는 완성본 15개가 다 그랬습니다
    // (`tool/m05shape.ts`). 7호 MAL2M07W2S1 이 `step: 0` 인 채 원본의 6칸을 들고 나와도 안 걸렸습니다.
    const table = (ctx.root["M05_View"] as any)?.image;
    const viewsOf = (i: number): number | null => {
      const inning = table?.[`inning_${i}`];
      if (!inning || typeof inning !== "object") return null;
      return Object.keys(inning).filter((k) => /^view_\d+$/.test(k)).length || null;
    };
    const stepOn = typeof step === "number" && step > 0;
    value.forEach((row: unknown, i: number) => {
      if (!Array.isArray(row)) return;
      const want = stepOn ? step : viewsOf(i);
      if (want === null || row.length === want) return;
      if (!stepOn) {
        err(
          ctx,
          "answer-table-shape",
          `quizData.M05_Answer.value[${i}]`,
          `이닝 ${i} 의 보기가 ${want}개인데 정답이 ${row.length}칸입니다.`,
          "보기 하나에 누를 차례 하나입니다 — 칸이 모자라면 그 단계에서 undefined 와 견주어 오답이 됩니다(M05_Answer.ts:92).",
        );
        return;
      }
      err(
        ctx,
        "answer-table-shape",
        `quizData.M05_Answer.value[${i}]`,
        `한 이닝이 ${step}단계인데 ${row.length}칸입니다.`,
        "그 단계에서 undefined 와 견주어 오답이 됩니다(M05_Answer.ts:92).",
      );
    });
  },
  // 자리 · 표 · 부품 쪽 규칙은 resolveslotrules.ts (2026-09-30 에 갈랐다 — 한 표가 270줄이라)
  ...SLOT_RULES,
};

export function runRules(spec: Spec, ctx: Ctx): void {
  for (const rule of spec.rules ?? []) {
    const impl = RULES[rule.id];
    if (impl === undefined) {
      ctx.issues.push({
        level: "warn",
        rule: rule.id,
        path: "(규칙)",
        message: `자동 검사가 없는 규칙입니다. 사람이 봐야 합니다 — ${rule.check}`,
        ...(rule.why ? { why: rule.why } : {}),
      });
      continue;
    }
    if (impl !== "generic") impl(ctx);
  }
}

