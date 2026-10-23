/**
 * **「main 에 모두 올리기」** 의 모양 — 진행판 맨 위 (2026-10-14, `hallsyncplan.ts` · `hallsync.ts`).
 * 공용(sparkon_common)과 호 저장소(sparkon_mNN) 가운데 할 일이 있는 것을 한 번에 커밋하고 main 에 올린다.
 */

/** 새로 만들 커밋 하나 — 공용은 모듈마다, 호는 학습코드마다 */
export interface SyncCommit {
  /** 공용은 `<과목>/<모듈>`(MA/M30_3), 호는 학습코드 */
  key: string
  subject: string
  /** 바뀐 파일(저장소 안 경로) */
  files: string[]
}

/** 커밋하지 않는 변경 — 무엇 · 까닭 · 파일 */
export interface SyncSkip {
  what: string
  why: string
  files: string[]
}

/** 저장소 하나의 계획 — **받아 오지 않고**(fetch 안 함) 마지막으로 받은 원격 기준으로 셈한다 */
export interface SyncRepo {
  /** 폴더 이름 — sparkon_common · sparkon_m08 */
  name: string
  kind: 'common' | 'hall'
  /** 지금 브랜치 — 모르면 빈 글 */
  branch: string
  commits: SyncCommit[]
  /** 이미 커밋했는데 origin/main 에 없는 커밋(합친 커밋은 뺀다) */
  ahead: { sha: string; subject: string }[]
  skipped: SyncSkip[]
  /** 지금 보이는, 실행하면 이 저장소에서 멈출 까닭 — 비었으면 없다 */
  blocked: string
  error?: string
}

export interface SyncPlan {
  repos: SyncRepo[]
  error?: string
}

/** 할 일이 있나 — 새 커밋이나 main 에 없는 커밋 */
export const syncHasWork = (r: SyncRepo): boolean => r.commits.length > 0 || r.ahead.length > 0

/**
 * 화면이 보인 항목의 열쇠 — `c:<저장소>:<커밋 열쇠>` · `s:<저장소>:<커밋 해시>`. 메인은 누른 때 다시 재고 이 열쇠와 겹치는 커밋만 만들고,
 * 여기 없는 커밋이 main 에 갈 것으로 새로 보이면 올리지 않는다(`resetKeys` 와 같은 꼴). 할 일이 없는 저장소는 열쇠가 없어 건드리지 않는다
 */
export const syncKeys = (p: SyncPlan): string[] =>
  p.repos.flatMap((r) => [...r.commits.map((c) => `c:${r.name}:${c.key}`), ...r.ahead.map((a) => `s:${r.name}:${a.sha}`)])

/** 저장소 하나를 실행한 결과 */
export interface SyncRepoDone {
  name: string
  ok: boolean
  /** 한 일 차례대로 */
  done: string[]
  /** 멈춘 까닭 한 문장 */
  stopped?: string
  /** 그 까닭에 걸린 것 — 충돌한 파일 · 합치기를 막은 파일 · 확인하지 않은 커밋 */
  files?: string[]
  /** 커밋 직전 타입 검사가 찾은 오류 줄 */
  tscErrors?: string[]
}

export interface SyncResult {
  repos: SyncRepoDone[]
  error?: string
}

/** 도는 동안 메인이 미는 진행 줄 */
export interface SyncLine {
  name: string
  line: string
}

/** 리소스 폴더 한 번에 정리 (`rsccleanall.ts`) — 학습코드마다 옮길 것과 못 하는 까닭 */
export interface RscCleanAll {
  /** 리소스 폴더 자리(rscRoot) */
  root: string
  /** 옮길 수 있는 학습코드 — 리소스 폴더 맨 위 항목(기획서 `_plan` 뺌)과 크기(바이트) */
  ready: { code: string; entries: { name: string; size: number }[] }[]
  /** 옮길 것은 있는데 지금 못 하는 학습코드와 까닭 */
  blocked: { code: string; why: string; size: number }[]
  /** 이미 기획서만 남은 학습코드 수 */
  clean: number
  error?: string
}

/** 화면이 보인 항목의 열쇠 — `<학습코드>/<항목 이름>` */
export const rscCleanKeys = (p: RscCleanAll): string[] => p.ready.flatMap((r) => r.entries.map((e) => `${r.code}/${e.name}`))

/** 정리한 결과 — 학습코드마다 옮긴 수 · 못 옮긴 것 */
export interface RscCleanAllDone {
  rows: { code: string; moved: number; failed: { rel: string; why: string }[]; error?: string }[]
  error?: string
}
