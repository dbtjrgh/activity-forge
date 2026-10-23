/**
 * **figma 화면의 배경으로 원본 판을 가른다** (2026-10-13, 대화로 만들기 — 앱 `backdrop.ts`).
 *
 * 9호 MAL1M08W4S3(M01) figma 는 바다 배경에 배 조종석, 엔딩은 배 낚시다. 같은 판은 MAL1M02W4S3(BG 바다 · 엔딩 로티 `MAL1M02W4S3_Pmon_in`)과
 * 그 파일을 다시 쓴 MAL1M05W4S3 이다. 배치표 추천은 MAL1M07W4S3(8호, 우주)였고 사람도 그것을 골라, 대화가 우주 판에서 출발했다.
 *
 * `scenefind.ts` 의 장면 비교(`sceneVerdict`)를 그대로 쓰지 않는 까닭 — 넓은 그림 여섯 장에 **단추 · 문제 그림**이 끼어,
 * 흰 둥근 상자 · 세로 단추가 아무 화면에나 0.8 로 맞는다. 9호 MAL1M08W4S1(M05)은 사람이 고른 MAL1M05W4S1 이 맞는데
 * MAL1M04W2S1 의 단추 넷이 0.83~0.85 로 맞아 「그것으로 바꾸라」고 했고, MAL1M08W4S3 은 배경이 0.00~0.03 인 MAL1M07W4S3 · MAL1M06W4S3 에도 문제 그림이 둘씩 맞았다
 * (`tool/scenegate.ts`, 2026-10-13). 배경만 보면 MAL1M08W4S1 은 0.37 이 제일 높아 조용하고, MAL1M08W4S3 은 M02 · M05 바다가 0.89, M07 은 0.00 이다.
 * 그래서 여기서는 **화면 절반 넘게 덮는 그림(배경)만** 본다 — 판이 다르면 배경이 다르고, 배경은 자리가 늘 (0,0) 이라 엉뚱한 곳에 맞을 일이 없다.
 *
 * 가르는 규칙 — 둘 다 맞을 때만 말한다:
 * ① 지금 원본의 배경이 **하나도 화면에 없다**(전부 `MISS` 밑) ② 다른 후보의 배경 하나 이상이 **화면에 있다**(`HIT` 이상).
 * 다 안 맞으면 말하지 않는다 — 배경을 새로 그린 회차다(8호 M05 · M31 이 그랬다). 맞는 후보가 여럿이면 맞은 수, 같으면 후보 차례(추천 차례).
 */

import { HIT, MISS, type SceneFile, type SceneScore } from "./scenefind";

const SCREEN_AREA = 1920 * 1080;

/** 배경인가 — 1x 로 놓았을 때 화면 절반 넘게 덮는 그림. 2x 로 내보낸 것(가로 1920 넘음)은 절반으로 친다 */
export function isBackdrop(f: Pick<SceneFile, "w" | "h">): boolean {
  const k = f.w > 1920 || f.h > 1080 ? 2 : 1;
  return (f.w / k) * (f.h / k) >= SCREEN_AREA / 2;
}

/** 배경으로 본 「원본이 틀린 것 같다」 — 더 맞는 후보, 아니면 null. `scores` 는 배경만 잰 점수, 후보 차례 그대로 */
export function backdropVerdict(scores: SceneScore[], now: string): SceneScore | null {
  const mine = scores.find((s) => s.code === now);
  if (!mine || mine.tried === 0) return null;
  if (mine.seen.some((s) => s.ratio >= MISS)) return null;
  // 정렬은 안정이라 맞은 수가 같으면 후보 차례 그대로다
  const best = scores.filter((s) => s.code !== now && s.seen.some((x) => x.ratio >= HIT)).sort((a, b) => b.hits - a.hits)[0];
  return best ?? null;
}
