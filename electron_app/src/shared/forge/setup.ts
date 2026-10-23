/**
 * **처음 설정**의 모양 (2026-10-01) — 단일 실행 파일로 받은 사람이 처음 켜면 뜨는 창.
 * 작업 폴더 하나만 고르면, 그 안에 양산기 폴더(저장소를 내려받음)와 리소스 폴더를 만든다. 메인 쪽은 `services/forge/setup.ts`.
 * 2026-10-16 — 나머지 저장소는 사람이 git 으로 받고, 앱은 점검표 · 호마다 yarn · `sparkon link` · 내 브랜치를 맞춘다.
 */

import type { SyncLine } from './sync'

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
  /** 상태를 읽지 못했다 — 사람이 「확인했습니다」를 누르면 넘어간다(모르는 것을 「안 됨」으로 막지 않는다) */
  confirm?: boolean
  /** git 이름 · 메일 칸을 보인다 — 「저장」을 누를 때만 `git config --global` 로 적는다 */
  identity?: boolean
}

export interface SetupState {
  /** 양산기 폴더를 못 찾았다 — 처음 설정 창을 띄운다 */
  needed: boolean
  checks: SetupCheck[]
  /** 이름 · 팀 · 브랜치 칸에 Tab 으로 채울 값 — 이름은 그 PC 의 git 사용자 이름, 브랜치는 그 이름을 영문 소문자로. 모르면 빈 글 */
  suggest: { developer: string; devTeam: string; branch: string }
}

/**
 * 받아 둘 저장소 하나 (2026-10-16) — **사람이 git 으로 받는다.** 앱은 있는지만 재고, 없으면 받을 명령 줄을 보인다.
 * 공용 둘(resource_common · sparkon_common) · sparkon_cli · 호 저장소(sparkon_mNN)
 */
export interface SetupRepo {
  name: string
  kind: 'common' | 'cli' | 'hall'
  /** 호 이름 — 「11호(M10)」. 호 저장소만 */
  label?: string
  /** git 저장소로 받아 두었다(`.git` 이 있고 HEAD 를 읽는다) */
  have: boolean
  /** 폴더는 있는데 못 쓰는 까닭 */
  why?: string
  /** 지금 브랜치 — 받아 둔 것만 */
  branch?: string
  /** 받을 명령 한 줄 — 작업 폴더 안 그 이름 자리로 받는다 */
  command: string
}

/** 고른 작업 폴더를 살펴본 것 */
export interface WorkPick {
  dir: string
  /** 받아 둘 저장소 — 공용 둘이 먼저, 호는 호 차례 */
  repos: SetupRepo[]
  /** 공용 둘 · sparkon_cli · 호 하나 이상이 다 있다 — 「설정 완료」를 누를 수 있다 */
  ready: boolean
  /** 아직 없는 것 한 문장 — 다 있으면 빈 글 */
  missing: string
  /** 만들 양산기 폴더(저장소 뿌리) · 이미 받아 둔 양산기가 있나 */
  forgeDir: string
  forgeReady: boolean
  rscDir: string
  rscReady: boolean
  error?: string
}

/**
 * 내 브랜치를 저장소마다 어떻게 하나 — sparkon_common 과 받아 둔 호에만(resource_common · sparkon_cli 는 main 그대로).
 * `remote` 는 원격에 같은 이름이 이미 있다 — 마지막 커밋의 작성자와 날짜를 보이고 두 번 눌러야 따라간다(남의 브랜치에 실수로 푸시하지 않게)
 */
export interface BranchPlan {
  repo: string
  /** 지금 브랜치 */
  now: string
  action: 'same' | 'local' | 'create' | 'remote' | 'dirty' | 'error'
  author?: string
  date?: string
  why?: string
}

/**
 * 내 브랜치를 못 바꾸고 main 에 남았나 (2026-10-16 사용자 결정 — 남으면 「마치기」를 막는다).
 * main 에 남은 채 마치면 「양산 완료 커밋」이 main 에 바로 올라간다. 메인(`setupbranch.ts` · `setup.ts`)과 화면(`SetupBranch.tsx`)이 같이 쓴다
 */
export const onMainBranch = (now: string): boolean => now === 'main' || now === 'master'

export interface BranchPlans {
  branch: string
  repos: BranchPlan[]
  /** 브랜치 이름을 받을 수 없는 까닭 */
  error?: string
}

/** 처음 설정이 저장소 하나에 한 일 한 단계 — 됨 · 건너뜀(이미 됨) · 사람이 볼 것 · 실패 */
export interface SetupStep {
  state: 'done' | 'skip' | 'hold' | 'fail'
  line: string
  /** 도구(git · yarn · sparkon)가 남긴 말 그대로 — 영어일 때가 많아 한국어 문장에 이어 붙이지 않고 아래 줄에 따로 보인다 */
  detail?: string
}

export interface SetupRepoDone {
  name: string
  /** 단계 가운데 가장 나쁜 것 */
  state: SetupStep['state']
  steps: SetupStep[]
}

/** 「설정 완료」 한 번 — 양산기 받기 · sparkon_cli 준비 · 저장소마다 브랜치 · yarn · 연결 */
export interface SetupRun {
  /** 실패(✕)한 것이 없다 — 「마치기」를 누를 수 있다(사람이 볼 것 ! 은 있어도 된다) */
  ok: boolean
  /** 양산기를 받아 두었다 — 「마치기」 단추를 보인다 */
  forgeReady: boolean
  repos: SetupRepoDone[]
  error?: string
}

/** 진행 줄 — 저장소 이름과 한 줄. 「main 에 모두 올리기」의 진행 줄과 같은 꼴이라 그 정의를 쓴다(두 벌로 안 적는다) */
export type SetupLine = SyncLine

export interface SetupResult {
  ok: boolean
  error?: string
}
