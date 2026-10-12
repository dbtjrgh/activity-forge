// 원본에만 있던 자리 (originOnly).
//
// `reslot.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `reslot.ts` 에서 가져다 씁니다.

import type { AssetKind } from "./types";

// ─ 원본에만 있던 자리 (2026-09-29, M3) ─
//
// 못 맞춘 자리 가운데 **이 회차에는 아예 없는 것**이 있습니다. MAL2M07W2S1 의 `bg_button_table` 은
// 원본(6호)에만 있는 그림이라, 도구는 「그 파일을 주세요」 카드를 냈고 사람은 줄 것이 없었습니다.
// M1 에서 에이전트가 스스로 뺀 것이 이것이고, 완성본에도 없습니다. **이것을 도구가 결정적으로 뺍니다.**
//
// 넷이 다 맞을 때만입니다.
//
//   ① 모듈이 그 이름으로 찾는 자리가 아니다 — 스펙 `fixedAlias` 가 아니다
//   ② `gameData` 가 그 이름을 **값으로** 부르지 않는다 (별칭이 열쇠인 표는 같이 덜어냅니다)
//   ③ 폴더에 그 이름의 **줄기**(숫자를 뗀 것)를 가진 파일이 하나도 없다 — 이름이 조금 달라
//      맞추기가 못 한 것(`correct_sfx01` ↔ `SL_ma_correct_sfx01.mp3`)은 AI 가 짝지을 몫이라 둡니다
//   ④ 받아 둔 답이 그 자리를 가리키지 않는다 — 사람이나 AI 가 이미 정한 것은 안 건드립니다
//   ⑤ **번호 형제가 없는 외톨이**다. `character_6_idle` 처럼 형제가 있는 무리는 형제를 증인으로
//      세우는 `familytrim.ts` 몫이다 — 여기서 보면 답이 오기 전의 `character_0..5_idle` 까지
//      줄기가 폴더에 없어 한꺼번에 빠진다(몸·팔로 갈린 회차라 `character__idle` 이 없다)
//
// 사람은 「되살리기」로 되돌립니다(`#keep|갈래|별칭`). 잘못 빼도 **잃는 것 없이** 한 번에 돌아옵니다.

/** 원본에만 있던 자리로 보이는 것. 부르는 쪽이 레시피에서 덜어냅니다. */
export function originOnly(
  misses: { alias: string; kind: AssetKind; file: string }[],
  folder: string[],
  fixed: Set<string>,
  usedAsValue: (alias: string) => boolean,
  claimed: Set<string>,
  /** 레시피에 든 별칭 전부 (`갈래|별칭`) — ⑤ 형제를 센다 */
  slots: string[],
): { alias: string; kind: AssetKind; file: string }[] {
  const names = folder.map((f) => (f.split("/").pop() ?? f).toLowerCase());
  const fam = (kind: string, alias: string): string => `${kind}|${alias.replace(/\d+/g, "#")}`;
  const size = new Map<string, number>();
  for (const s of slots) {
    const [kind, alias] = [s.slice(0, s.indexOf("|")), s.slice(s.indexOf("|") + 1)];
    size.set(fam(kind, alias), (size.get(fam(kind, alias)) ?? 0) + 1);
  }
  return misses.filter((m) => {
    if (fixed.has(m.alias) || claimed.has(`${m.kind}|${m.alias}`)) return false; // ① ④
    if ((size.get(fam(m.kind, m.alias)) ?? 0) > 1) return false; // ⑤
    if (usedAsValue(m.alias)) return false; // ②
    const stem = m.alias.replace(/\d+/g, "").replace(/[_-]+$/, "").toLowerCase();
    if (stem.length < 3) return false;
    return !names.some((n) => n.includes(stem)); // ③
  });
}
