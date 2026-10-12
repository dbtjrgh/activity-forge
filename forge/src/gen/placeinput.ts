// 좌표 찾기의 입력 · 결과 모양과 문턱값.
//
// `placefind.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `placefind.ts` 에서 가져다 씁니다.

import type { FileTable } from "./types";
import type { Bitmap } from "./png";
import type { Box } from "./placespots";

export type PlaceHit = { path: string; box: Box; how: "found" | "slot" | "state" | "carry"; ratio?: number };

/** 이만큼 겹쳐 맞아야 찾은 것으로 본다 — `tool/imgfind.ts` 로 잰 값(단추 98.5~99.7%, 못 찾은 것 ≤71%) */
export const SURE_AT = 0.9;
/**
 * 이닝 표 칸의 기준. **여기만 낮춘다** — 화면마다 몇 이닝인지 먼저 정하고 그 이닝 칸만 받으므로(아래 ②)
 * 엉뚱한 자리를 받을 길이 좁다. MAL2M07W2S1 1이닝 보기 `view_0_0` 이 67% 로 **0px** 자리였고, 0.6 이면
 * 보기 15칸이 다 놓여 모두 앞 회차 값보다 가까웠다(평균 53px · 앞 회차 351px). 캐릭터처럼 이닝과
 * 상관없는 칸은 0.55 로 낮추면 588~942px 엉뚱한 자리를 받아서 그대로 0.9 다. 한 학습코드로 잰 값이다.
 */
export const TABLE_AT = 0.6;
/** 화면에 안 보이는 상태 — 따로 안 찾고 기본 그림에 맞춘다 */
export const STATE = /_(correct|wrong|effect)$/;
/** 화면 전체를 덮는 것 — 찾을 것이 아니다 */
export const SKIP = /^(bg_|ending_)/;

export const centered = (c: { cx: number; cy: number }, t: Bitmap): Box => ({
  x: Math.round(c.cx - t.w / 2), y: Math.round(c.cy - t.h / 2), width: t.w, height: t.h,
});

export type PlaceInput = {
  gameData: unknown;
  /** GameData 가 내보내는 이름(`quizData`) — 낸 자리 앞에 붙인다 */
  root: string;
  /** 별칭 → 그림 파일(절대 경로). 없으면 null */
  imageOf: (alias: string) => string | null;
  rscDir: string;
  tables: FileTable[];
  /** 1920×1080 화면들(절대 경로) */
  screens: string[];
  /** 찾은 것으로 볼 겹침 비율. 재 볼 때만 바꾼다 — 기본 0.9 */
  sure?: number;
  /** 이닝 표 칸만의 기준 — 재 볼 때만 바꾼다 */
  sureTable?: number;
};

/** 찾은 것 · 알릴 말 · **화면마다 몇 이닝인가**(`inp.screens` 차례, 못 정했으면 null) */
export type Places = { hits: PlaceHit[]; notes: string[]; screens: (number | null)[] };
