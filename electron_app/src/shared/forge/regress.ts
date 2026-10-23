/**
 * **빠른 모듈 회귀 검사** 의 모양 — 「관리」 화면 (2026-10-15, `services/forge/regress.ts`).
 * 공용 모듈을 고쳤을 때 그 모듈을 쓰는 개발 완료 완성본을 뒤에서 세 개씩 띄워 끝 화면까지 가 보는지 본다.
 * **모르는 것은 null** 이다. 화면은 null 을 「—」로 그린다.
 */

/** 고친 공용 모듈 하나 — `key` 는 「과목 폴더/모듈」(MA/M28 · KR/K05), sparkLib 모듈은 `sparkLib/VideoPlayer` */
export interface RegressModule {
  key: string
  /** 진행판 과목(MA · KO · EN) — 과목 폴더 KR 은 KO 다. sparkLib 모듈은 과목이 없어 빈 글 */
  subject: string
  module: string
  /** 커밋 안 한 변경이 있나 · main 에 없는 커밋에 들었나 */
  dirty: boolean
  ahead: boolean
  /** 이 모듈을 쓰는 개발 완료 완성본 수 */
  finished: number
}

export interface RegressChanged {
  modules: RegressModule[]
  /** 모듈 폴더 밖(partner_common · sparkLib 의 모듈 밖 등)이 바뀌었으면 그 자리 — 어느 모듈에 닿는지 모르므로 이름을 골라 돌린다 */
  outside: string[]
  /** 끝까지 몰고 가는 자동 진행이 있는 모듈 이름 — 나머지는 첫 이닝까지만 본다 */
  driven: string[]
  error?: string
}

/** 완성본 하나를 돌린 결과 */
export interface RegressRow {
  code: string
  /** M 번호 두 자리 */
  month: string
  /** 칸의 모듈(여럿이면 「+」로 이은 것) */
  module: string
  /** 끝까지 몰고 갔나(이 모듈의 자동 진행이 있음) · 첫 이닝까지만 봤나 */
  mode: 'full' | 'first'
  /** full 은 끝 화면까지, first 는 첫 이닝 표시까지 왔나. 돌리지 못했으면 null */
  reached: boolean | null
  /** 이닝 표시에 켜진 수 · 표시된 수 · GameData 의 이닝 수(자동 진행이 읽을 때만) */
  innings: { done: number | null; shown: number | null; data: number | null }
  /** 콘솔 오류 · 처리 안 된 rejection — 같은 글은 한 번 */
  errors: string[]
  /** 404 등으로 못 받은 리소스 주소(서버 안 경로) */
  missing: string[]
  /** 걸린 시간(ms, 실제 시각) */
  took: number
  /** 자동 진행이 남긴 마지막 줄들 — 멈춘 자리를 짚게 */
  log: string[]
  /** 못 돌린 까닭 · 상한에 걸림 등 한 문장 */
  note?: string
}

export interface RegressResult {
  /** 잰 때(ms). 한 번도 안 쟀으면 null */
  at: number | null
  /** 돌린 모듈 열쇠(MA/M28) */
  modules: string[]
  rows: RegressRow[]
  /** 전체 걸린 시간(ms) */
  took: number
  /** 시계를 몇 배로 빠르게 돌렸나 */
  warp: number
  /** 상한에 걸려 안 돌린 것 · 끊은 것 — 한 문장 */
  limited?: string
  /** 적은 이름 가운데 못 찾았거나 상한에 걸려 안 본 것 — 한 문장. 메인을 다시 켜기 전에는 안 온다 */
  names?: string
  error?: string
}

/** 도는 동안 화면에 미는 진행 줄 */
export interface RegressProgress {
  running: boolean
  done: number
  total: number
  /** 지금 돌고 있는 학습코드 */
  now: string[]
}

/** 「관리」 화면을 열 때 — 지난 결과와 지금 도는 판의 진행 */
export interface RegressState {
  last: RegressResult
  progress: RegressProgress
}
