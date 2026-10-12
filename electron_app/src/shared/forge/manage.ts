/**
 * 「관리」 화면이 주고받는 모양 (2026-09-30) — 호 저장소 · 받을 리소스 · 완성본 점검 · 팀별.
 * **모르는 것은 null** 이다. 화면은 null 을 「—」로 그리고 0 으로 그리지 않는다.
 */

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
 * 리소스를 기다리는 학습코드 하나. **개수로 모자람을 잰다** — 이름은 바뀌어 오므로 이름만 보면 온 것도 없다고 나온다.
 * 이름(`files`)은 원본이 쓰던 것 가운데 폴더에 없는 것 — 「이것일 것」이라는 실마리다.
 */
export interface RscWaitRow {
  code: string
  module: string
  origin: string
  /** 이 회차 입력이 하나도 안 왔다(빈 폴더거나 공용 파일만) */
  empty: boolean
  /** 갈래마다 원본 수 · 지금 수 · 원본 이름으로 없는 것. 모자란 갈래만 */
  missing: { kind: string; origin: number; here: number; files: string[] }[]
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
