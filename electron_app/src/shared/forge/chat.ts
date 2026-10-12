/**
 * **대화로 만들기** — 앱 안의 Claude 한 명이 학습코드 하나를 대화로 만든다 (2026-10-08 사용자 결정, 「M07 했듯이」).
 * 모양과 메인 · 화면이 같이 쓰는 가름 하나(`chatWaiting`)만 여기 적는다. 흐름은 메인 `services/forge/chat.ts`.
 */

/**
 * - `running` Claude 가 만드는 중
 * - `asking` 사람의 답을 기다린다
 * - `checking` 파일 복사와 타입 검사 중
 * - `done` 만들고 타입 검사까지 통과했다
 * - `stopped` 사람이 멈췄다 · `error` 진행할 수 없다
 */
export type ChatState = 'idle' | 'running' | 'asking' | 'checking' | 'done' | 'stopped' | 'error'

export interface ChatQuestion {
  text: string
  /** 고를 수 있는 답 — 비면 글로만 답한다 */
  options: string[]
}

export interface ChatTurn {
  who: 'ai' | 'person' | 'app'
  text: string
  at: string
  /** 사람이 붙인 그림 — 리소스 폴더 안 경로(`_chat/…png`) */
  images?: string[]
}

export interface ChatChecks {
  /**
   * 반드시 통과해야 하는 검사 — 이 학습코드 폴더에서 난 타입 오류.
   * `ran` 이 false 면 검사를 돌리지 못했다(프로그램 없음 · 시간 초과) — 오류가 아니라 까닭(`why`)이고 AI 에게 안 맡긴다
   */
  tsc: { ok: boolean; errors: string[]; ran?: boolean; why?: string } | null
  /** 참고 — 스펙 검사 에러 */
  spec: string[] | null
  /** 앱이 리소스를 호 저장소로 복사한 결과 · AssetTable 이 가리키는데 없는 파일 */
  files: { copied: number; missing: string[]; failed: string[] } | null
  /** 쓴 액티비티를 forge 가 다시 읽지 못한 까닭 — 있으면 없는 파일 검사도 못 한 것이라 막는다 */
  unread?: string
}

export interface ChatInfo {
  code: string
  state: ChatState
  sessionId: string | null
  turns: ChatTurn[]
  /** 지금 열린 질문 (`asking` 일 때) */
  questions: ChatQuestion[]
  /** 도는 동안 Claude 가 한 일 한 줄씩 — 화면에만, 저장하지 않는다 */
  progress: string[]
  checks: ChatChecks
  /** 이 대화에 든 값(달러) */
  cost: number
  /** 도는 판이 시작한 시각(ms) — 도는 중일 때만 */
  since: number | null
  /**
   * 메인이 민 차례 번호 — 늘기만 한다. 화면은 가진 것보다 작은 번호를 버린다.
   * 차례가 곧바로 끝나면 미는 소식이 invoke 의 답보다 먼저 와서, 늦게 온 「만드는 중」이 끝난 형편을 덮었다
   */
  rev: number
  error?: string
}

/** 메인이 화면에 밀어 주는 소식 — 한 학습코드의 형편 전체 */
export type ChatEvent = ChatInfo

/**
 * **이어 갈 대화가 사람을 기다리나** — 묻는 중 · 멈춤 · 오류로 남았다. 그동안 호 저장소의 그 폴더는 반쯤 쓰인 채다.
 * 검수 완료를 막는 곳(`useChat.ts`)과 작업대 순서 막대(`benchorder.ts`)가 같이 본다 — 두 곳이 따로 적으면 한쪽만 고쳐진다.
 * AI 를 부르기 전에 멈춘 것(대화 id 없음)은 아니다 — 쓴 파일이 없다
 */
export const chatWaiting = (c: Pick<ChatInfo, 'state' | 'sessionId'> | null | undefined): boolean =>
  Boolean(c?.sessionId) && (c?.state === 'asking' || c?.state === 'stopped' || c?.state === 'error')
