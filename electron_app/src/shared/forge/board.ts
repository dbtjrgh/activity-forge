/**
 * 진행판 · 작업 폴더 · 스펙 갱신 · 리소스 화면이 처음 보여 줄 것. 왜 모양을 여기 적는지는 `../forge.ts` 머리말.
 * 옆줄의 진행판 목록과 호 이름(`BoardKey` · `BoardList` · `HO_OF`)은 `./boardlist.ts` 다(2026-10-21, 200줄을 넘어 뗐다)
 */
import type { Ask } from './ask'
import type { BoardKey } from './boardlist'
import type { ChatState } from './chat'
import type { Devices } from './devices'
import type { VacationLink } from './vacation'

/** 차시 한 줄. forge `layoutboard.ts` 의 `BoardRow` 와 같은 모양이다. */
export interface BoardRow {
  slot: string
  code: string
  module: string
  /** 모듈을 어떻게 정했나 — 사람이 적었나, 규칙으로 정해졌나, 갈리나 */
  verdict: string
  hasSpec: boolean
  /** 리소스 폴더에 놓인 파일 수 (readme.md 뺀 것) */
  files: number
  /** 갈래별 수. 총수만으로는 「소리만 왔다」를 못 본다 */
  rsc: { image: number; sound: number; lottie: number; font: number }
  /** 모듈 못 정함 · 스펙 먼저 · 리소스 대기 · 만들 수 있음 · 만들었음 */
  stage: string
  /** 만든 것이면 Activity.ts 를 마지막으로 쓴 때(ms) */
  builtAt?: number
  wbs?: { title: string; code: string }
  /** 호 저장소에 이미 있는 그 액티비티가 실제로 쓰는 모듈 — 앞선 호가 없어 `module` 이 빈 칸도 이것은 있다 */
  usedModule?: string
  /**
   * **이 판의 형편** (2026-09-28, M2) — 진행판 타일이 상태 하나와 다음 할 일을 가르는 재료.
   * 앱이 채운다(`services/forge/boardwork.ts`). forge CLI 에는 없다.
   */
  work?: RowWork
}

export interface RowWork {
  /**
   * 대화로 만들기의 형편 (2026-10-08, `_recipe/<코드>.chat.json`) — 상태 · 열린 질문 수 · 든 값(달러).
   * 대화를 한 번도 시작하지 않았으면 null. 이전 방식의 `run.json`(남은 카드 수)은 이제 안 본다 — 앱에서 걷었다
   */
  chat: { state: ChatState; questions: number; cost: number } | null
  /** 붙어 있는 figma 화면 수 */
  shots: number
  /** 이 모듈이 화면을 요구하나 (값 칸이 없는 모듈은 아니다) */
  needsShot: boolean
  /** 호 저장소 `activityInfo.json` 의 devFinished. 못 읽으면 null */
  finished: boolean | null
  /** 지금 대화가 도는 중이면 시작한 지 몇 ms (`chatstore.ts` 의 `since`). 안 돌면 null */
  running: number | null
  /**
   * 기획서에 적혔는데 없는 이 학습코드 소리 수 (2026-10-14, `services/forge/rsccount.ts` — 작업대 · 관리와 같은 셈).
   * 원본과 개수를 견주던 때는 다 넣은 완성본에도 절반이 「부족」이었다 — 확실한 것만 센다.
   * 리소스가 들어온 칸만 센다(빈 칸은 이미 「리소스 넣기」). 기획서가 없거나 영어라 못 셌으면 null
   */
  rscGap: number | null
  /**
   * 기획서 1쪽 모듈넘버가 배치표와 다르면 그 모듈 (2026-10-14, `services/forge/planmodule.ts`). 작업대를 열 때 남긴 결과만 읽는다 —
   * 진행판을 열 때 기획서를 새로 읽지 않는다(pdftotext 가 메인 스레드를 잡는다). 같거나 모르면 없음
   */
  planModule?: string
  /** 방학호와 리소스가 거의 다 같은 짝 (2026-10-20, `services/forge/vacation.ts` — `_layout/vacation.json` 을 읽기만). 짝이 없으면 없음 */
  vacation?: VacationLink[]
  /** 학습할 때 켜는 카메라 · 마이크 (2026-10-20, `services/forge/devices.ts`). 안 켜면 없음 */
  devices?: Devices
}

/**
 * 진행판 칸에 적을 모듈 — **개발 완료 칸은 호 저장소가 실제로 쓰는 모듈이 정본이다**.
 * 배치표 판정(`module`)은 앞선 호 기록으로 고른 짐작이라 지난 호 완성본에서 틀린다(2026-10-14 에 재 보니 832칸 중 254칸 — 5호 MAL2M05W3S3 이 M35 인데 M07).
 * 아직 안 끝난 칸은 판정이 먼저다 — 빈 뼈대가 부르는 모듈은 정한 것이 아니다.
 * 개발 완료인데 저장소 모듈이 비면 빈 글(칸은 「모듈 사용 안 함」). `finished` 는 `work` 를 채우기 전(메인 `boardwork.ts` 카메라 · 마이크 셈)에 따로 준다
 */
export function shownModule(row: BoardRow, finished = row.work?.finished): string {
  if (finished === true) return oneModule(row.usedModule ?? '')
  return row.module || oneModule(row.usedModule ?? '')
}

/**
 * 같은 모듈이 두 번 적힌 이름을 하나로 — forge 모듈 읽기가 주석 처리된 import 까지 세어 `M30+M30` · `E39+E39` 가 된다(9칸).
 * 그 읽기는 deploy 와 같이 쓰는 정본(`activityModules.ts`)이라 여기서 합친다
 */
export const oneModule = (m: string): string => [...new Set(m.split('+'))].join('+')

/** 같은 모듈을 쓰는 차시 무리. forge `layoutboard.ts` 의 `Group`. */
export interface Group {
  module: string
  codes: string[]
  slots: string[]
  decided: boolean
  hasSpec: boolean
}

/** 진행판 한 화면. forge 의 boardOf · moduleOrder · skippedOf 를 합친 것. */
export interface BoardResult extends BoardKey {
  rows: BoardRow[]
  groups: Group[]
  /** 배치표에서 「이 호에는 없음」으로 적어 둔 차시 */
  skipped: { note: string; slots: { slot: string; why: string }[] }
  /** 읽지 못한 경우의 사용자용 메시지 */
  error?: string
}

/**
 * **배치표가 갈린 칸을 한 장에** (M7) — 진행판 위에서 한 번에 고른다. 카드 모양은 작업대의 모듈 카드와 같다(`moduleAsk`).
 * EN 은 앞선 호 같은 칸의 기획서에서 「호별 사용 유형」 쪽을 그림으로 붙인다 — 그 표가 호마다 어느 유형인지 적어 둔다.
 */
export interface LayoutAsk {
  code: string
  slot: string
  /** 메뉴 이름표(`ActivityData.ts`) — 「E05 Word Explorer」. 고치는 것은 사람 몫이다 */
  label: string
  ask: Ask
  /** 붙인 기획서 쪽 — 없으면 null */
  plan: { file: string; page: number; image: string } | null
  /** 기획서를 못 붙인 까닭 */
  planWhy: string
}

export interface LayoutAsks {
  subject: string
  issue: string
  rows: LayoutAsk[]
  error?: string
}

/**
 * **과목의 공용 모듈 폴더** (2026-10-21, `services/forge/modulefolders.ts`) — 앞선 호가 없는 학습코드(후보 0개)의 모듈을 고를 목록.
 * 매번 폴더를 읽어 새로 더한 모듈 폴더도 나온다. 폴더만 담는다(`index.ts` 같은 낱개 파일은 뺀다)
 */
export interface ModuleFolders {
  subject: string
  /** 읽은 과목 폴더 — 국어는 `KR` */
  dir: string
  modules: string[]
  /** 배치표에 못 적는 이름이라 뺀 폴더 */
  skipped: string[]
  error?: string
}

/** 스펙이 없는 모듈 하나 — 열린 진행판의 배치표가 정했는데 `_spec` 에 없다 (`newmodules.ts`) */
export interface NewModule {
  subject: string
  module: string
  /** 그 모듈을 쓰는 이번 칸들 */
  codes: string[]
  /** 그 모듈을 쓴 완성본 수 — **0 이면 초안을 못 만든다**(완성본을 견줘 쓴다) */
  samples: number
  /** Claude 에게 붙여 넣을 글 — 무엇을 · 어디를 보고 · 어떻게 끝났다고 보는지 */
  ask: string
}

export interface NewModules {
  modules: NewModule[]
  error?: string
}

/**
 * 「팀 일정표 갱신」의 결과 (2026-10-12) — 앱은 완료 목록을 내 컴퓨터에 잠깐 띄우고 일정표를 연다.
 * **칠하는 것은 엑셀 웹의 「스파크온 완료 칠하기」 스크립트다** — 사람이 실행한다. `until` 까지 받아 갈 수 있다(밀리초 시각)
 */
export interface TeamSheet {
  count: number
  until: number
  error?: string
}
