/**
 * 「관리」 화면이 주고받는 모양 (2026-09-30) — 호 저장소 · 받을 리소스 · 완성본 점검 · 팀별.
 * **모르는 것은 null** 이다. 화면은 null 을 「—」로 그리고 0 으로 그리지 않는다.
 */

import type { NeedRow, PlanCheck } from './prepare'

/** 호 저장소 하나의 git 형편 — 받지 않고(fetch 안 함) 마지막으로 받아 둔 원격 가지 기준 */
export interface HallRepo {
  /** `sparkon_m08` */
  name: string
  /** 몇 번째 호인가 — M 번호가 곧 호가 아니다(6호가 방학호 M11). 여기는 M 번호만 적는다 */
  month: string
  branch: string | null
  /** 커밋 안 한 파일 수 */
  dirty: number | null
  /** 원격보다 앞선 · 뒤처진 커밋 수. 원격 가지가 없으면 null */
  ahead: number | null
  behind: number | null
  /** 마지막 커밋 — `at` 은 ms */
  last: { hash: string; at: number; subject: string } | null
  /** 원격에서 마지막으로 받은 때(ms) — 「몇 분 전 기준」. 한 번도 안 받았으면 null */
  synced: number | null
  error?: string
}

export interface HallStatus {
  repos: HallRepo[]
  error?: string
}

/**
 * 리소스를 기다리는 학습코드 하나 (2026-10-14 에 셈을 바꿨다 — `services/forge/rsccount.ts`).
 * **확실한 것은 기획서에 적혔는데 없는 소리 이름뿐이다.** 그림 · 로티는 같은 모듈 완성본 가운데 가장 적은 것보다도 적을 때만 참고로 싣는다
 */
export interface RscWaitRow {
  code: string
  module: string
  /** 이 회차 입력이 하나도 안 왔다(빈 폴더거나 공용 파일만) */
  empty: boolean
  /** 없는 소리가 있거나 같은 모듈 완성본보다 적은 종류만 */
  need: NeedRow[]
  plan: PlanCheck
  error?: string
}

export interface RscWait {
  /** 본 M 번호 — 안 주면 아직 안 끝난 호 가운데 가장 앞 호 */
  month: string | null
  /** 고를 수 있는 M 번호 — 안 끝난 호, 호 차례 */
  months: string[]
  rows: RscWaitRow[]
  error?: string
}

/** 스펙 검사에 걸린 완성본 하나 */
export interface GateRow {
  code: string
  module: string
  /** 걸린 규칙과 자리 — 앞의 몇 개 */
  issues: string[]
  count: number
  team: string
}

export interface GateResult {
  /** 잰 때(ms). 한 번도 안 쟀으면 null */
  at: number | null
  /** 잰 개발 완료 수 */
  finished: number
  passed: number
  failed: GateRow[]
  /** 스펙이 없거나 모듈을 못 읽어 못 잰 것 */
  unmeasured: { code: string; why: string }[]
  /** 잰 데 걸린 시간(ms) */
  took: number
  /**
   * 잰 모듈 가운데 스펙을 맞춰 본 뒤 공용 모듈이 바뀐 것(forge `specdrift.ts`, 2026-10-14) — 막지 않고 알리기만.
   * 이 필드가 없는 옛 결과도 있다
   */
  drift?: { module: string; note: string }[]
  /** 하나도 견주지 못했을 때 그 까닭(git · 공용 저장소가 없음) — 빈 `drift` 를 「바뀐 것 없음」으로 읽지 않게 */
  driftNote?: string
  /**
   * 다시 재야 하는 까닭 — 스펙이 잰 뒤에 바뀌었거나 하루가 지났다. **읽을 때만 셈하고 파일에는 안 쓴다**.
   * 있으면 화면이 열 때 다시 잰다
   */
  stale?: string
  error?: string
}

/** 팀 하나가 M 번호마다 끝낸 칸 수 */
export interface TeamRow {
  team: string
  byMonth: Record<string, number>
  total: number
}

export interface TeamTally {
  months: string[]
  teams: TeamRow[]
  /** M 번호마다 액티비티 폴더 수 · 그 가운데 안 끝난 것 */
  folders: Record<string, number>
  open: Record<string, number>
  error?: string
}
