// 이름 붙은 규칙 가운데 자리 · 표 · 부품 쪽 — 캐릭터 부품 · 표 길이 · 무작위 자리표 · 정답 팝업 · 끝 화면 · 놓는 칸.
//
// 2026-09-30 에 `resolve.ts` 에서 옮김 — 960줄이라. **동작 변화 없음.** 입구(`resolveGameData`)와 전체 그림은 `resolve.ts`.
import { missingParts, whoOf } from "./parts";
import type { RuleFn } from "./resolverules";
import { err, warn } from "./resolveissue";

export const SLOT_RULES: Record<string, RuleFn> = {
  // 캐릭터를 몸·팔로 나눠 쓰는 차시는 **여섯 가지가 다 있어야** 합니다.
  // 한 상태만 빠지면 그 상태에서 팔이나 몸이 사라진 채로 보이는데,
  // **에러도 안 나고 값도 멀쩡해 보입니다** — 띄워 보기 전에는 모릅니다.
  //
  // **이미 돌아가는 것으로 먼저 재 보고 박았습니다** (2026-09-21) — 몸·팔로
  // 나눠 쓰는 차시가 15개인데 **열다섯 다 여섯 가지를 갖추고 있습니다.**
  // 스펙 글만 보고 구현했다가 완성본을 거는 일이 같은 날 한 번 있었습니다.
  //
  // `gameData` 가 아니라 **등록된 별칭**을 봅니다. 이 이름들은 `AssetTable` 에만
  // 있고 `gameData` 에서는 한 번도 불리지 않습니다(재서 확인).
  // **부품을 세는 셈은 `parts.ts` 하나입니다** (2026-09-23). 채우는 쪽(앱의
  // `partfill.ts`)이 같은 자리를 같은 이름으로 불러야 해서 그리로 옮겼습니다 —
  // 두 벌로 두면 한쪽만 고쳐집니다(저장소 규칙 3). 동작은 그대로입니다.
  "character-parts-consistent": (ctx) => {
    const images: string[] = [];
    for (const [alias, kinds] of ctx.aliases) if (kinds.has("image")) images.push(alias);
    const byWho = new Map<string, string[]>();
    for (const alias of missingParts(images)) {
      const n = whoOf(alias);
      byWho.set(n, [...(byWho.get(n) ?? []), alias]);
    }
    for (const [n, missing] of byWho) {
      warn(
        ctx,
        "character-parts-consistent",
        `assets.image.character_${n}_*`,
        `몸·팔로 나눠 쓰는데 ${missing.length}가지가 없습니다 — ${missing.join(" · ")}`,
        "빠진 상태에서 팔이나 몸이 사라진 채로 보입니다. 띄워 보기 전에는 드러나지 않습니다.",
      );
    }
  },

  "table-data-length": (ctx) => {
    const innings = (ctx.root["Com_Inning"] as any)?.length;
    const data = (ctx.root["M05_Table"] as any)?.data;
    // **표 자체가 없는 차시가 있습니다.** 없는 것은 이 규칙이 볼 일이 아닙니다 —
    // 있어야 하는지는 자리 검사(required)가 따로 봅니다.
    if (!Array.isArray(data) || typeof innings !== "number") return;
    if (data.length === innings) return;
    err(
      ctx,
      "table-data-length",
      "quizData.M05_Table.data",
      `이닝이 ${innings}인데 진행 표는 ${data.length}칸입니다.`,
      "이닝마다 한 칸씩 채웁니다(M05_Table.Update) — 짧으면 뒤쪽 이닝에서 채울 칸이 없습니다.",
    );
  },

  "random-needs-pos-table": (ctx) => {
    const answerData = ctx.root["answerData"] as any;
    if (answerData?.isRandom !== true) return;
    const table = answerData?.pos ?? {};
    const innings = ctx.root["inningData"];
    if (!Array.isArray(innings)) return;
    const needed = new Set<number>();
    innings.forEach((inn) => {
      const items = (inn as any)?.answer?.items;
      if (Array.isArray(items)) needed.add(items.length);
    });
    for (const n of [...needed].sort()) {
      if (!Array.isArray(table[n])) {
        err(
          ctx,
          "random-needs-pos-table",
          `quizData.answerData.pos.${n}`,
          `isRandom 이 true 인데 선지 ${n}개짜리 위치가 없습니다.`,
          "AnswerPanel 이 answerData.pos[개수][i] 를 그대로 참조합니다.",
        );
      }
    }
  },

  // ─ M28 ─ 아래 셋은 전부 「빌드는 통과하고 런타임에 터지는」 것들입니다.

  // 선지 자리표는 액티비티에 하나뿐인데 이닝마다 선지 수가 다릅니다.
  // 제일 많은 이닝을 못 덮으면 그 이닝 중간에 멈춥니다.
  "quiz-item-pos-covers-items": (ctx) => {
    const slots = ctx.root["quizItemPos"];
    const innings = ctx.root["inningData"];
    if (!Array.isArray(slots) || !Array.isArray(innings)) return;
    innings.forEach((inn, i) => {
      const items = (inn as any)?.items;
      if (!Array.isArray(items) || items.length <= slots.length) return;
      err(
        ctx,
        "quiz-item-pos-covers-items",
        `quizData.inningData[${i}].items`,
        `선지가 ${items.length}개인데 quizItemPos 는 ${slots.length}칸입니다.`,
        "QuizItemManager.ts:78 이 itemPos[i] 를 막지 않고 읽습니다.",
      );
    });
  },

  // 정답을 담으면 팝업을 띄웁니다. 번호가 없으면 -1 이 들어갑니다.
  "correct-item-needs-popup": (ctx) => {
    const popups = ctx.root["popup"];
    const innings = ctx.root["inningData"];
    if (!Array.isArray(innings)) return;
    const n = Array.isArray(popups) ? popups.length : 0;
    innings.forEach((inn, i) => {
      const items = (inn as any)?.items;
      if (!Array.isArray(items)) return;
      items.forEach((it: any, j: number) => {
        if (it?.correct !== true) return;
        const at = `quizData.inningData[${i}].items[${j}].popup`;
        if (typeof it.popup !== "number") {
          err(ctx, "correct-item-needs-popup", at, "정답인데 popup 번호가 없습니다.", "Popup.ts:24 가 popup[-1].image 를 읽고 터집니다.");
        } else if (it.popup < 0 || it.popup >= n) {
          err(ctx, "correct-item-needs-popup", at, `popup ${it.popup} 번은 없습니다. 목록은 ${n}개입니다.`);
        }
      });
    });
  },

  // 터지지는 않습니다 — Pixi 가 빈 텍스처로 바꿉니다. 다만 엔딩에 결과 그림이
  // 안 뜨는데, 기존 M28 13개가 전부 넣고 있어서 대개는 빠뜨린 것입니다.
  "ending-result-empty": (ctx) => {
    const ending = ctx.root["ending"] as { ending_result?: unknown } | undefined;
    if (!ending || typeof ending !== "object") return;
    if (ending.ending_result) return;
    warn(ctx, "ending-result-empty", "quizData.ending.ending_result",
      "비어 있습니다. 엔딩에 결과 그림이 안 뜹니다.",
      "정말 없는 것이 맞으면 그냥 두셔도 됩니다. 터지지는 않습니다.");
  },

  // 담는 자리는 3칸까지만 배치됩니다.
  "correct-count-fits-drop-slots": (ctx) => {
    const innings = ctx.root["inningData"];
    if (!Array.isArray(innings)) return;
    innings.forEach((inn, i) => {
      const items = (inn as any)?.items;
      if (!Array.isArray(items)) return;
      const n = items.filter((it: any) => it?.correct === true).length;
      if (n > 3) {
        err(
          ctx,
          "correct-count-fits-drop-slots",
          `quizData.inningData[${i}].items`,
          `정답이 ${n}개입니다. 3개까지만 됩니다.`,
          "DropZone.ts:104 가 4개째부터 자리를 안 잡아 (0,0) 에 겹칩니다.",
        );
      }
    });
  },
};
