// 스펙의 값 관계 (`relations`).
//
// `types.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `types.ts` 에서 가져다 씁니다.

import type { AssetKind } from "./types";

// **값의 관계.** `rules` 와 자리가 다릅니다 (2026-09-14).
//
//   rules      이름만 스펙에 적고 **몸통은 `resolverules.ts` · `resolveslotrules.ts` 에 손으로** 씁니다.
//              모듈마다 TypeScript 한 벌이라 119장으로 못 늘립니다
//   relations  **스펙 JSON 안에서 끝납니다.** 새 모듈에 붙이는 데 코드를 안 고칩니다
//
// 왜 필요한지와 갈래를 둘만 둔 까닭은 [gen/relation.ts](relation.ts) 머리에.
// `level` 을 안 적으면 **error** 입니다 — 관계는 경고가 아니라 막는 것입니다.
export type SpecRelation = (
  | {
      // 차례를 따라간다. `group` 칸을 차례로 걸으며 `pick` 으로 모은 수가
      // 앞 칸까지의 최댓값보다 커야 합니다. (8호 ① `popup` 전부 0)
      kind: "ascends";
      group: string;
      pick: string;
      label?: string; // 메시지에서 무리를 부를 이름. ex) "이닝"
    }
  | {
      // 목록을 남김없이 쓴다. `list` 의 칸을 `pick` 이 모은 번호가 다 가리켜야 합니다.
      kind: "covers";
      list: string;
      pick: string;
    }
  // ─── 아래는 값 하나를 보는 갈래 (`relkinds.ts`, 2026-09-23) ───────────
  //
  // 스펙 `rules` 가운데 「자동 검사가 없는 규칙입니다」로 사람에게 가던 것을
  // 자료로 옮기려고 냈습니다. **완성본 표본에 재 본 것만** 스펙에 적습니다.
  | {
      // 값이 이 가운데 하나여야 합니다. ex) M05_Ending.style
      kind: "oneOf";
      pick: string;
      // 식은 `{ "__expr": "Math.PI / 4" }` — 식끼리 글로 견줍니다
      values: (string | number | boolean | { __expr: string })[];
    }
  | {
      // 값이 다른 표의 **열쇠**(객체면)나 **칸 값**(배열이면)이어야 합니다.
      // `in` 은 뿌리에서 찾는 길입니다. 번호가 배열 칸 안인지는 `indexes` 가 봅니다.
      // ex) inning[].answer.answerCardIndex 가 cards 의 열쇠
      kind: "keyIn";
      pick: string;
      in: string;
      // `isAlias` 의 것과 같습니다 — 값을 `{}` 자리에 끼운 이름들이 다 있어야 합니다.
      template?: string[];
    }
  | {
      // 배열 여럿의 칸 수가 모두 같아야 합니다. 이닝마다 따로 견주려면 `each` 를 씁니다
      // (이닝마다 칸 수가 달라도 되는 것 — M31).
      // ex) each: inningData · picks: character.child · dragzone.pos · dropzone.pos
      kind: "sameCount";
      picks: string[];
      // **수를 가리키는 길은 그 수로 셉니다** — targetCount[] 의 2 는 「2칸」.
      // `zip` 이면 길마다 모인 것을 **차례대로 짝지어** 견줍니다 (i 번째끼리).
      //   ex) inning[].colorOrderIndexs 의 i 번째 칸 수 = targetCount[] 의 i 번째 수
      // `atLeast` 면 같을 필요 없이 **첫 길이 나머지 이상**이면 됩니다(「적지 않아야」).
      zip?: boolean;
      atLeast?: boolean;
    }
  | {
      // 이 이름들이 AssetTable 에 다 있어야 합니다. 값을 안 보는 갈래라 **`when` 과 같이 씁니다.**
      // ex) M05 — 엔딩 꼴이 version_1 이면(when M05_Ending.style) ending_start · ending_sfx
      kind: "hasAlias";
      names: string[];
      as?: AssetKind;
    }
  | {
      // 배열의 **첫 칸 · 끝 칸 · 가운데 칸**이 저마다 이 가운데 하나여야 합니다.
      // ex) M05 `M05_Table.data` — start · middle… · end (띠 그림)
      kind: "ends";
      pick: string;
      first?: (string | number)[];
      last?: (string | number)[];
      middle?: (string | number)[];
    }
  | {
      // 배열의 칸마다 `from` < `to` 이고, 앞 칸의 `to` 이후(같아도 됨)에 시작해야 합니다.
      // ex) CreateSong `chapter[].subtitle` — start · end
      kind: "spans";
      pick: string;
      from: string;
      to: string;
    }
  | {
      // `pick` 아래 **어느 깊이에도** 이 열쇠가 없어야 합니다.
      // ex) M05 — 표의 잎에 오타 rotata
      kind: "noKey";
      pick?: string; // 없으면 뿌리 전체
      keys: string[];
    }
  | {
      // 이 자리가 없어야 합니다 — 모듈이 안 읽는 옛 칸. ex) quizInfo[].position
      kind: "absent";
      pick: string;
    }
  | {
      // 이 자리들이 있어야 합니다. `any` 면 하나만 있어도 됩니다.
      // ex) chapter · chapter_b2g 둘 다 / touch 씬은 cover 나 inter 하나
      kind: "present";
      picks: string[];
      any?: boolean;
    }
  | {
      // 수가 이 안이어야 합니다 (양 끝 포함). ex) maxInning 은 9 까지
      kind: "range";
      pick: string;
      min?: number;
      max?: number;
    }
  | {
      // 배열의 칸 수가 이 안이어야 합니다. ex) chapter[].choice.button 은 둘까지
      kind: "count";
      pick: string;
      min?: number;
      max?: number;
    }
  | {
      // 모은 값이 서로 달라야 합니다. ex) 이닝마다 wheel.image
      kind: "distinct";
      pick: string;
    }
  | {
      // 번호가 그 목록 안이어야 합니다. `pick` 은 `list` 의 **칸 안에서** 찾는 길이라
      // 「그 번호가 가리키는 것은 자기가 들어 있는 목록」이 됩니다.
      // ex) list: chapter · pick: choice.button[].chapterIDX
      kind: "indexes";
      list: string;
      pick: string;
      // true 면 `pick` 을 목록 칸 안이 아니라 **목록과 같은 자리에서** 찾는다 — 옆 목록의 번호.
      // ex) each: chapter[] · list: bubble · pick: game[].bubble (거품이 뜨는 때가 가리키는 거품)
      beside?: boolean;
    }
  | {
      // 값이 AssetTable 의 alias 여야 합니다. `as` 로 갈래를 좁힐 수 있습니다.
      // 빈 글은 「안 씀」이라 건너뜁니다.
      kind: "isAlias";
      pick: string;
      as?: AssetKind;
      // 값을 **틀에 끼워** 찾습니다. `{}` 자리에 값이 들어갑니다. 여럿이면 다 있어야 합니다.
      // ex) M05_Answer.value 의 번호 3 → button_3_basic · button_3_correct
      template?: string[];
      // `pick` 이 **표**(열쇠 → 값)를 가리킬 때, 그 표의 열쇠를 볼지 값을 볼지.
      // ex) M05 `M05_Button.image` 는 열쇠가 alias · M37 `correctNarration` 은 값이 alias
      of?: "keys" | "values";
      // `of` 로 편 표에서 **alias 가 아닌 열쇠**를 뺍니다. `{}` 는 숫자·글자 한 마디.
      // ex) M05 `M05_Button.image` 의 번호 딱지 `button_{}_number`
      skip?: string[];
    }
) & {
  id: string;
  level?: "error" | "warn";
  why?: string;
  note?: string;
  // **값 갈래에만** 붙습니다 (ascends · covers 는 안 봅니다). 뜻은 `relpath.ts` 의
  // 「칸마다 · 이럴 때만」 — `each` 칸마다 따로 보고, `when` 이 맞을 때만 봅니다.
  each?: string;
  when?: { pick: string; is?: unknown; isNot?: unknown };
};
