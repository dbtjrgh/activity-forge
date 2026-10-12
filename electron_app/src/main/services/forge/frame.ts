/**
 * **figma 화면이 1x 인가** — 붙여넣기(`ipc/shots.ts` oneX)와 끌어다 놓기(`sortpaper.ts`)가 같이 쓰는 가름 (2026-09-29, M5).
 *
 * 1920×1080 이면 그대로, 그 정배수(2x · 3x — figma 「PNG 로 내보내기」가 배수로 올 수 있다)면 1920×1080 으로 줄여 받는다.
 * 정배수라 좌표가 한 칸도 안 어긋난다. **아니면 받지 않는다** — 크기가 제멋대로면 좌표 찾기(forge `placefind.ts`)가
 * 조용히 어긋나고, 받아 두면 「화면이 있다」로 세어 AI 를 부른다. 셈만 한다 — 줄이는 것은 부르는 쪽(Electron)이다.
 */

export const FRAME = { width: 1920, height: 1080 }

/** 줄일 배수(1 이면 그대로), 또는 안 받는 까닭 */
export function frameScale(width: number, height: number): number | string {
  const k = width / FRAME.width
  if (Number.isInteger(k) && k >= 1 && height === FRAME.height * k) return k
  return (
    `이 그림은 크기가 ${width}×${height}라 좌표에 쓸 수 없습니다. figma 에서 프레임 하나를 골라 ` +
    'PNG 1x 로 복사(Ctrl+Shift+C)하거나 내보내세요. 1920×1080 또는 그 정배수 크기만 받습니다.'
  )
}
