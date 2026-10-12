// **값을 보는 관계의 갈래 목록과 나눠 주기** (2026-09-23).
// 어느 갈래에나 `each`(칸마다) · `when`(이럴 때만)이 붙는다 — `relpath.ts`.
//
// **왜 냈나.** 스펙 `rules` 374가지 중 몸통이 있는 것은 14가지뿐이라 나머지는
// 만들 때마다 「사람이 봐야 합니다」 카드로 갔습니다(시험 세 회차 카드의 60%).
// 규칙마다 몸통을 쓰는 길은 `relation.ts` 가 막아 두어, **되풀이되는 꼴**을 냈습니다.
//
//   ─ 제 자리의 값 (`relvalue.ts`) ─
//   oneOf     값이 이 가운데 하나 (식도)    M05_Ending.style · aniRotate
//   range     수가 이 안                     maxInning 은 9 까지
//   absent    이 자리가 없어야              quizInfo[].position (모듈이 안 읽는 칸)
//   present   이 자리가 있어야 (any: 하나만) chapter · chapter_b2g
//   count     배열 칸 수가 이 안             chapter[].choice.button 은 둘까지
//   distinct  모은 값이 서로 달라야          이닝마다 wheel.image
//   ─ 다른 자리를 끌어와 (`relref.ts`) ─
//   indexes   번호가 자기 목록 안           chapterIDX · beside: 옆 목록 (game[].bubble → bubble)
//   isAlias   값이 AssetTable 의 alias      answercard.word
//   hasAlias  이 이름들이 AssetTable 에     엔딩 꼴마다 ending_start · ending_sfx
//   keyIn     값이 다른 표의 열쇠           answerCardIndex 가 cards 에
//   sameCount 배열들 칸 수가 같아야         character.child · dragzone.pos · dropzone.pos
//   ─ 칸의 차례 · 열쇠 (`relshape.ts`) ─
//   ends      첫 칸 · 끝 칸 · 가운데 칸     M05_Table.data
//   spans     구간이 차례대로 안 겹쳐야     subtitle[] start · end
//   noKey     어느 깊이에도 이 열쇠가 없어야 rotata
//
// **넣는 기준은 `relation.ts` 와 같습니다 — 완성본 표본에 재 봐서 다 통과한
// 것만 막습니다.** 재는 것은 `tool/relgate.ts` 입니다.

import type { AssetKind, SpecRelation } from "./types";
import type { Add, Note } from "./relpath";
import { absent, count, distinct, oneOf, present, range } from "./relvalue";
import { hasAlias, indexes, isAlias, keyIn, sameCount } from "./relref";
import { ends, noKey, spans } from "./relshape";

export const VALUE_KINDS: ReadonlySet<string> = new Set([
  "oneOf",
  "absent",
  "present",
  "range",
  "count",
  "distinct",
  "indexes",
  "isAlias",
  "hasAlias",
  "keyIn",
  "sameCount",
  "ends",
  "spans",
  "noKey",
]);

type Aliases = Map<string, Set<AssetKind>> | undefined;

export function runValueKind(
  rel: SpecRelation,
  root: unknown,
  rootName: string,
  aliases: Aliases,
  add: Add,
  note: Note,
): void {
  switch (rel.kind) {
    case "oneOf":
      return oneOf(rel, root, rootName, add, note);
    case "absent":
      return absent(rel, root, rootName, add);
    case "present":
      return present(rel, root, rootName, add);
    case "range":
      return range(rel, root, rootName, add, note);
    case "count":
      return count(rel, root, rootName, add, note);
    case "distinct":
      return distinct(rel, root, rootName, add, note);
    case "indexes":
      return indexes(rel, root, rootName, add, note);
    case "isAlias":
      return isAlias(rel, root, rootName, aliases, add, note);
    case "hasAlias":
      return hasAlias(rel, rootName, aliases, add, note);
    case "keyIn":
      return keyIn(rel, root, rootName, add, note);
    case "sameCount":
      return sameCount(rel, root, rootName, add, note);
    case "ends":
      return ends(rel, root, rootName, add, note);
    case "spans":
      return spans(rel, root, rootName, add, note);
    case "noKey":
      return noKey(rel, root, rootName, add, note);
  }
}
