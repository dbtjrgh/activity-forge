// 이름 견주기 — 소문자 · 밑줄 · 보이지 않는 글자를 걷고 줄기 · 뼈대(숫자를 #) · 숫자 마디 · 꼬리를 뽑는다.
//
// 2026-09-30 에 `swap.ts` 에서 옮김 — 477줄이라. **동작 변화 없음.** 까닭 · 잰 값은 `swap.ts` 머리말.

// ─── 맞추기 ──────────────────────────────────────────────────────────────

// **눈에 안 보이는 글자도 지웁니다** (2026-09-21). `MAL2M07W2S1` 의 소리
// 파일 셋에 **폭 없는 공백**(U+200B)이 들어 있었습니다 —
// `SL_ma_com_sfx01​.mp3`. 화면에도 목록에도 `SL_ma_com_sfx01.mp3` 로 보이는데
// 글자가 달라서 「폴더에 그 파일이 없습니다」가 났습니다. **눈으로는 영영 못
// 찾는 갈래**라 여기서 지웁니다. `\s` 는 이 글자를 안 잡습니다.
export const norm = (s: string): string =>
  s.toLowerCase().replace(/[_\-\s​-‍﻿]/g, "");
export const stem = (s: string): string => s.replace(/\.[a-z0-9]+$/i, "");

// 규칙 ④ 가 쓰는 것. **마디 구분(`_`·`-`)은 남깁니다** — 마디가 어디서 갈리는지가
// 그 규칙이 보는 전부라, `norm` 처럼 다 지우면 볼 것이 없어집니다.
// 눈에 안 보이는 글자는 여기서도 지웁니다(위 까닭과 같습니다).
export const bare = (s: string): string => s.toLowerCase().replace(/[\s​-‍﻿]/g, "");
/** 숫자를 다 뺀 이름 뼈대. 이것이 같은 것끼리가 한 무리입니다. */
export const boneOf = (rel: string): string => bare(rel).replace(/\d+/g, "#");
/** 이름에 나오는 숫자 마디를 차례대로. */
export const digitsOf = (rel: string): string[] => bare(rel).match(/\d+/g) ?? [];

/** 규칙 ④ 의 빗장 ㉡㉣. 늘리면 틀리기 시작합니다 — 위 머리말의 잰 값. */
export const NUM_LEAST = 3;
export const NUM_MOST = 4;

// 마지막 마디에서 **번호를 뗀 글자**. `MAL1M02W4S2_Pmon_idle.json` → `idle`
//
// **번호를 떼는 것이 핵심입니다.** 안 떼면 `SL_ma_108_s2_nar03` 이
// `SL_ma_125_s3_nar03` 에 붙습니다 — 이름이 맞은 것이 아니라 **번호 자리가**
// 맞은 것입니다. 실제로 원본은 `nar02~33` 스물아홉 개이고 새 폴더는 열 개라
// 애초에 1:1 이 아닙니다. **번호로 줄 세우는 일은 이닝 수 맞추기의 몫**이지
// 이름 맞추기가 몰래 할 일이 아닙니다.
//
// 번호를 떼고 남는 글자가 없으면(`bg_02` → `02` → 빈 글자) 짝지을 실마리가
// 없다는 뜻이라 규칙을 접습니다.
export function tailOf(rel: string): string {
  const name = stem(rel.split("/").pop() ?? "").toLowerCase();
  const parts = name.split(/[_\-]/).filter(Boolean);
  return (parts[parts.length - 1] ?? "").replace(/\d+/g, "");
}

// 한 번만 세는 표. 두 번 넘게 나오는 열쇠는 규칙 ⑤ 에서 접습니다.
export function countBy<T>(list: T[], key: (v: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of list) {
    const k = key(v);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

