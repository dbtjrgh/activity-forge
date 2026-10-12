// 바꿀 것 짜기 — 파일 이름 → 별칭 · 「낱말」 자리와 차례로 짝.
//
// `restock.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `restock.ts` 에서 가져다 씁니다.

import type { AssetKind } from "./types";
import { type Recast } from "./restock";

/** 확장자를 뗀 파일 이름. `crayon.png` → `crayon`. */
export function aliasOf(file: string): string {
  return (file.split("/").pop() ?? file).replace(/\.[a-z0-9]+$/i, "");
}

/**
 * 「낱말」로 가린 자리와 폴더에 남은 파일로 **바꿀 것을 짭니다.**
 *
 * **차례를 사람이나 AI 가 정해 준 뒤에 부릅니다.** 여기서 순서를 짐작하지
 * 않습니다 — 어느 낱말이 몇 번째인지는 파일 이름에 없고, 8호도 알파벳순이
 * 아니었습니다(이닝1 fork · 2 toothbrush · 3 scissors). figma 스샷을 본 AI 나
 * 사람이 정한 차례를 `order` 로 받습니다.
 *
 * `order` 는 **옛 별칭 → 새 파일**입니다. 짝이 안 맞는 것은 `missed` 로 나갑니다.
 */
export function castsFrom(
  judged: { alias: string; kind: AssetKind; verdict: string }[],
  order: Map<string, string>,
): { casts: Recast[]; missed: { from: string; why: string }[] } {
  const casts: Recast[] = [];
  const missed: { from: string; why: string }[] = [];
  for (const j of judged) {
    if (j.verdict !== "낱말") continue;
    const file = order.get(j.alias);
    if (!file) {
      missed.push({ from: j.alias, why: "이 자리에 넣을 파일이 아직 안 정해졌습니다." });
      continue;
    }
    casts.push({ from: j.alias, to: aliasOf(file), file, kind: j.kind });
  }
  return { casts, missed };
}
