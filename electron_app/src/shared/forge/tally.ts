/**
 * 학습코드별 기록 한 줄 — 사람 손 · AI · 시간 (2026-09-30, M9 의 표). 읽는 곳은 `runtable.ts`, 그리는 곳은 `board/RunTable.tsx`.
 * 「프로그램을 쓸 이유」를 숫자로 답하는 표라, 옆에 채팅 방식(8호) 값을 같이 둔다.
 */
export interface RunRow {
  code: string
  /** 사람이 시킨 일의 수 — 생성 · 답 · 리소스 · 화면 · 맡기기 · 반영 · 검수 · 커밋 (`measure.ts`) */
  touches: number
  /** 그 일들이 무엇이었나 — 「생성 2 · 답 1」 꼴 */
  what: string
  /** AI 를 부른 수 · 값(달러) · 캐시 읽기 토큰 · 모든 토큰. 옛 판(실측 전)은 null */
  calls: number | null
  cost: number | null
  cacheRead: number | null
  tokens: number | null
  /** 처음 손댄 때부터 마지막까지(초) — 기다린 시간이 들어 있다 */
  seconds: number
  /** 저장소에 반영했나 */
  wrote: boolean
}

/** 채팅 방식으로 만든 8호의 가운뎃값 — `_document/양산판.md` 「지금 어디 서 있나」 */
export const CHAT_BASELINE = { touches: 3, cacheRead: 27_100_000 } as const
