/** 진행판 · 작업 폴더 · 스펙 갱신 · 리소스 화면이 처음 보여 줄 것. 왜 모양을 여기 적는지는 `../forge.ts` 머리말. */
import type { Ask } from './ask'
import type { ChatState } from './chat'

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
   * 원본보다 모자란 리소스 수 (2026-10-01, `services/forge/rsccount.ts` — 작업대 · 관리와 같은 셈).
   * 리소스가 들어온 칸만 센다(빈 칸은 이미 「리소스 넣기」). 안 셌거나 못 셌으면 null
   */
  rscGap: number | null
}

/** 같은 모듈을 쓰는 차시 무리. forge `layoutboard.ts` 의 `Group`. */
export interface Group {
  module: string
  codes: string[]
  slots: string[]
  decided: boolean
  hasSpec: boolean
}

/** 어느 과목·호의 진행판인지 */
export interface BoardKey {
  subject: string
  issue: string
}

/** 진행판 목록 한 줄 — 닫을 수 있나까지 (M7). 빈 글이면 닫을 수 있고, 아니면 못 닫는 까닭 */
export interface BoardItem extends BoardKey {
  closeWhy: string
  /** 개발 끝(activityInfo.json devFinished)인 칸 수 — 옆줄이 색으로 보인다. 못 셌으면 null */
  done: number | null
  /** 셀 칸 수 — 36 에서 배치표가 뺀 칸(국어 협력사 몫)을 뺀 것 */
  total: number
}

/**
 * 진행판 목록 — 그리고 **열 수 있는 다음 호**(M7). 연 호 가운데 빠진 과목이 있으면 그 호가 먼저고,
 * 없으면 가장 큰 호 + 1(호 저장소가 있을 때). 없으면 null
 */
export interface BoardList {
  boards: BoardItem[]
  next: string | null
  /** 다음 호에 새로 만들 과목 — 「+ 08호 KO 열기」 */
  nextSubjects: string[]
  error?: string
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
 * **M 번호 → 호 이름** (2026-09-29). 호 저장소 커밋이 스스로 부르는 이름에서 뽑았다 — 「9호(M08) 차시 36개 골격」 · 「6호(M11)」 · 「M11 방학호」.
 * **+1 이 아니다** — 6호가 방학호라 M11 이고, 7~11호는 M06~M10 이다. 처음에 +1 로 짐작해 옆줄에 「M11 12호」 「M01 2호」가 떴다.
 * 표에 없는 M(아직 커밋이 이름을 안 준 호)은 호 이름을 붙이지 않는다 — 짐작을 확정처럼 보이지 않는다.
 */
export const HO_OF: Record<string, { name: string; order: number }> = {
  '01': { name: '1호', order: 1 },
  '02': { name: '2호', order: 2 },
  '03': { name: '3호', order: 3 },
  '04': { name: '4호', order: 4 },
  '05': { name: '5호', order: 5 },
  '11': { name: '6호(방학)', order: 6 },
  '06': { name: '7호', order: 7 },
  '07': { name: '8호', order: 8 },
  '08': { name: '9호', order: 9 },
  '09': { name: '10호', order: 10 },
  '10': { name: '11호', order: 11 }
}

/** 화면에 부를 호 이름 — 「9호(M08)」. 표에 없는 M 은 M 번호만 */
export const hoLabel = (m: string): string => (HO_OF[m] ? `${HO_OF[m].name}(M${m})` : `M${m}`)

/** 호 차례 — 6호가 방학호 M11 이라 M 번호 차례와 다르다. 표에 없는 M 은 맨 뒤에 M 번호로 */
export const hoOrder = (m: string): number => HO_OF[m]?.order ?? 100 + Number(m)

/**
 * 「팀 일정표 갱신」의 결과 (2026-10-12) — 앱은 완료 목록을 내 컴퓨터에 잠깐 띄우고 일정표를 연다.
 * **칠하는 것은 엑셀 웹의 「스파크온 완료 칠하기」 스크립트다** — 사람이 실행한다. `until` 까지 받아 갈 수 있다(밀리초 시각)
 */
export interface TeamSheet {
  count: number
  until: number
  error?: string
}
