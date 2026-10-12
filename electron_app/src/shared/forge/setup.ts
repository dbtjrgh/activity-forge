/**
 * **처음 설정**의 모양 (2026-10-01) — 단일 실행 파일로 받은 사람이 처음 켜면 뜨는 창.
 * 작업 폴더 하나만 고르면, 그 안에 양산기 폴더(저장소를 내려받음)와 리소스 폴더를 만든다. 메인 쪽은 `services/forge/setup.ts`.
 */

/** 작업 폴더 안에 만드는 두 폴더 이름 — 호 저장소(sparkon_mNN) 옆에 나란히 놓인다 */
export const SETUP_FORGE_DIR = 'SparkOn-양산기'
export const SETUP_RSC_DIR = 'SparkOn-리소스'

/** 필요한 프로그램 하나 — `required` 가 없으면 설정은 되지만 그 기능이 안 된다 */
export interface SetupCheck {
  name: string
  ok: boolean
  /** 무엇에 쓰는지, 없으면 어떻게 하는지 */
  note: string
  required: boolean
  /** 설치 페이지가 있다 — 없을 때 「설치 페이지 열기」. 주소는 메인만 안다(`services/forge/setup.ts`) */
  install: boolean
}

export interface SetupState {
  /** 양산기 폴더를 못 찾았다 — 처음 설정 창을 띄운다 */
  needed: boolean
  checks: SetupCheck[]
  /** 이름 · 팀 칸에 Tab 으로 채울 값 — 이름은 그 PC 의 git 사용자 이름, 모르면 빈 글 */
  suggest: { developer: string; devTeam: string }
}

/** 고른 작업 폴더를 살펴본 것 */
export interface WorkPick {
  dir: string
  /** 찾은 호 저장소 폴더 이름(sparkon_m01 …) */
  repos: string[]
  /** 만들 양산기 폴더(저장소 뿌리) · 이미 받아 둔 양산기가 있나 */
  forgeDir: string
  forgeReady: boolean
  rscDir: string
  rscReady: boolean
  error?: string
}

export interface SetupResult {
  ok: boolean
  error?: string
}
