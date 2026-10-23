/**
 * **화면 칸의 id — 한 곳** (2026-10-16). 칸에 id 를 다는 쪽과 그 id 로 찾아가는 쪽(`lib/spot.ts` · 순서 막대)이 같은 상수를 쓴다.
 * 글자를 두 곳에 적으면 한쪽만 고쳤을 때 조용히 못 찾는다(CLAUDE.md 3번).
 *
 * `TARGET` — 작업대 순서 막대가 강조하는 칸(`lib/benchorder.ts` 에서 옮겼다, 동작 변화 없음). 그 파일이 다시 내보낸다.
 */

export const TARGET = {
  need: 'bench-need',
  shot: 'bench-shot',
  done: 'bench-done',
  layout: 'bench-layout',
  chat: 'bench-chat',
  answer: 'bench-answer'
} as const

/**
 * 둘러보기(`lib/tour.ts`)가 짚는 칸 — 옆줄 · 진행판 · 작업대. 작업대의 리소스 · figma 화면 · 대화로 생성 · 답 칸은 위 `TARGET` 을 같이 쓴다
 */
export const TOUR_ANCHOR = {
  sideBoards: 'side-boards',
  sideSettings: 'side-settings',
  sideTour: 'side-tour',
  boardDrop: 'board-drop',
  boardTiles: 'board-tiles',
  boardNow: 'board-now',
  boardSync: 'board-sync',
  benchOrder: 'bench-order',
  benchView: 'bench-view',
  benchCheck: 'bench-check',
  benchCommit: 'bench-commit'
} as const
