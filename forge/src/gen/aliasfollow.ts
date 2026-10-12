/**
 * **번호로 짝인 두 이름 무리를 견준다** — 스펙 `aliasFollows` (2026-09-28).
 *
 * M05 는 `btn_sfx_${누른 단추}` 로 소리를 부른다(M05_Answer.ts:97). 단추는 폴더의
 * `button_{k}_basic.png` 가 정하지만 소리 파일(`SL_drum_sfx05.mp3`)에는 그 번호가 없다.
 * 그래서 이름으로 맞추기도, 형제를 증인으로 세우는 덜어내기(`familytrim.ts`)도 못 잡았다 —
 * 7호 MAL2M07W2S1 에서 단추는 6개로 줄었는데 `btn_sfx_6·7` 이 남았고, AI 가 상어 소리를
 * `btn_sfx_5` 가 아니라 `btn_sfx_6` 에 얹었다. M05 완성본 21개는 전부 두 번호 모음이 같다.
 *
 * 검사(`resolve.ts`)와 고치기(앱 `aliasfollow.ts`)가 **이 셈 하나를** 같이 쓴다.
 */

import type { AliasFollow } from "./types";

/** `"btn_sfx_{k}"` 꼴에 맞는 이름에서 k 를 모은다. */
export function followNumbers(pattern: string, names: Iterable<string>): Map<number, string> {
  const [head, tail] = pattern.split("{k}") as [string, string];
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc(head)}(\\d+)${esc(tail ?? "")}$`);
  const out = new Map<number, string>();
  for (const n of names) {
    const m = re.exec(n);
    if (m) out.set(Number(m[1]), n);
  }
  return out;
}

/** 따라가는 쪽에만 있는 번호(덜 것)와 정하는 쪽에만 있는 번호(모자란 것). */
export function followGaps(
  f: AliasFollow,
  names: Iterable<string>,
): { extra: string[]; lack: number[] } {
  const list = [...names];
  const mine = followNumbers(f.alias, list);
  const lead = followNumbers(f.follows, list);
  return {
    extra: [...mine].filter(([k]) => !lead.has(k)).map(([, n]) => n),
    lack: [...lead.keys()].filter((k) => !mine.has(k)).sort((a, b) => a - b),
  };
}
