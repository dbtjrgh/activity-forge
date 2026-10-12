/**
 * 「양산 시작」의 걸음과 결과. 왜 모양을 여기 적는지는 `../forge.ts` 머리말.
 * 2026-10-08 에 이전 방식을 앱에서 걷었다 — 앱 화면은 이 모양을 더 안 쓰지만 forge 도구(`forge/src/tool`)와
 * 남은 서비스(`run.ts` · `write.ts` …)가 쓰므로 둔다. 아래 `IPC.forgeRunStep` 채널은 그때 걷었다.
 */

import type { Ask } from './ask'
import type { AutoTrace, FinishTrace } from './inbox'
import type { Carried } from './answer'
import type { MadeFile } from './finish'
import type { ReviseResult } from './ai'

// ─── 「양산 시작」 ──────────────────────────────────────────────────────
//
// 누르면 다섯 걸음이 차례로 돕니다. **한 걸음이 끝날 때마다 화면에 한 줄씩**
// 보냈습니다 (`IPC.forgeRunStep`, 2026-10-08 에 걷었다). 전에는 끝날 때까지 아무 말이 없었습니다.

/** 걸음 하나의 형편. `run` 은 아직 도는 중이라 화면이 회색으로 둔다. */
export type StepState = 'run' | 'ok' | 'warn' | 'fail' | 'skip'

export interface RunStep {
  /** 배치표 · 원본 떠 오기 · 리소스 맞추기 · 만들어 보기 · 혼자만 다른 것 */
  name: string
  state: StepState
  /** 사람에게 보일 한 줄. 실패면 왜 실패했는지 */
  note: string
}

/** 생성기가 낸 것. forge `types.ts` 의 `Issue` 와 같은 모양이다. */
export interface RunIssue {
  level: string
  rule: string
  path: string
  message: string
  why?: string
  /** 스펙에 적은 「관계」(1-2)가 낸 것인가. 규칙 이름이 관계 id 와 같으면 그렇다 */
  relation?: boolean
}

/** 리소스 맞추기 결과. 규칙 넷의 몫과, 못 맞은 것을 무리로 묶은 것. */
export interface SwapReport {
  /** 원본의 리소스 자리 수 */
  slots: number
  hits: number
  /** 규칙별 몫 — 그대로 · 학습코드 · 확장자 · 꼬리 */
  byRule: { rule: string; label: string; n: number }[]
  /**
   * 못 맞은 것을 이름 무리로 묶은 것. 하나씩 늘어놓으면 예순 줄이 되는데
   * 실제로는 몇 무리다 (forge `swapfolder.ts` 의 `families`).
   */
  families: { family: string; origin: number; folder: number }[]
  /** 아무 별칭도 안 가져간 파일 수 */
  spare: number
  /** 리소스 폴더가 없다 같은, 알려야 할 것 */
  notes: string[]
  /**
   * 다 모은 뒤 레시피에 **남아 있는** 자리(`갈래|별칭`). AI 가 못 정했다고 한 자리
   * 가운데 그 뒤에 덜어낸 것을 카드에서 거르는 데 쓴다(`auto.ts`).
   */
  aliases: string[]
}

/**
 * 「혼자만 다른 것」(1단계 1-1)을 이 학습코드에 대해 본 것.
 *
 * **아직 안 만든 액티비티는 못 봅니다.** 이 검사는 호 저장소에 이미 쓰인
 * `Activity.ts`·`GameData.ts` 를 견주는 것이라, `--dry` 만 돌린 차시는
 * 견줄 대상에 없습니다. 그때는 `ran: false` 와 그 까닭을 담습니다.
 */
export interface OddReport {
  ran: boolean
  /** 못 봤으면 왜 못 봤는지 */
  note: string
  /** 견준 형제 수 */
  samples: number
  /** 이 학습코드만 다른 자리 */
  mine: { where: string; kind: string; what: string; mine?: string; others?: string }[]
}

/**
 * **원본을 떠 온 레시피에서 무엇이 바뀌었나** — 도구가 센다. AI 의 말을 믿지 않는다 (M3, `changes.ts`).
 *
 * 값과 좌표(`x`·`y`·`width`·`height`)를 갈라 센다. 자리(에셋 별칭)는 이름으로 센다.
 */
export interface RecipeChanges {
  /** 바뀐 값 줄 수 · 바뀐 좌표 상자 수 */
  values: number
  coords: number
  /** 원본 값 그대로인 값 잎 수(좌표 빼고) — AI 가 안 건드렸거나 건드릴 까닭이 없던 자리 (M4) */
  same: number
  /** 바뀐 값 줄 —**경로는 답 꼴 그대로**라 「원본으로」가 `before` 를 그 경로에 답한다 (M4) */
  rows: ChangeRow[]
  /** 바뀐 좌표 상자(`x`·`y`·`width`·`height` 를 묶은 것) */
  boxes: ChangeRow[]
  /** 새로 생긴 · 없어진 · 파일만 바뀐 에셋 자리(`갈래.별칭`) */
  added: string[]
  removed: string[]
  refiled: string[]
  /** 셈이 상한에 걸렸다 */
  truncated: boolean
}

/** 바뀐 자리 한 줄. `by` — 답 파일이 말하는 누가(도구가 바꾼 것은 답이 없어 `tool`, 옛 답은 `unknown`) */
export interface ChangeRow {
  path: string
  before: unknown
  after: unknown
  by: 'ai' | 'person' | 'tool' | 'unknown'
}

/** 원본에만 있던 자리라 도구가 뺀 것. 사람이 되살릴 수 있다(`#keep|갈래|별칭`). */
export interface DroppedSlot {
  kind: string
  alias: string
  file: string
}

/** 「양산 시작」 한 번의 결과. */
export interface RunResult {
  code: string
  /** `--dry` 까지 에러 없이 갔나 */
  ok: boolean
  /**
   * 앞 회차 것이 그대로 남은 자리를 고친 결과 (B단계). 「양산」 한 단추에서만
   * 채워진다 — `runDry` 만 부르면 없다.
   */
  revise?: ReviseResult
  steps: RunStep[]
  issues: RunIssue[]
  /** 안 될 때 사람에게 요구하는 것. 통과했으면 빈 배열 */
  asks: Ask[]
  swap?: SwapReport
  odd?: OddReport
  /**
   * `--dry` 가 만들어 본 파일. **에러가 나도 담는다** — 안 될 때야말로
   * 무엇을 만들려 했는지 봐야 한다 (`_document/양산계획.md` 3-2).
   */
  preview: MadeFile[]
  /**
   * 이미 반영한 학습코드에서 **호 저장소와 다른 것** — 액티비티 파일 이름 · 리소스 경로 (2026-10-02, `stale.ts`).
   * 호 저장소에 아직 없으면 없다. 이 결과가 쓴 판(`wrote`)이면 쓰기 전에 잰 값이라 보지 않는다
   */
  stale?: { files: string[]; rsc: string[] }
  /**
   * 실제로 썼나. **2단계에는 늘 false 다** — 남과 공유하는 호 저장소에
   * 쓰는 일이라 3단계로 미뤘다(`_document/양산계획.md`). 화면이 이 까닭을
   * 그대로 띄운다.
   */
  wrote: boolean
  writeNote: string
  /**
   * 답을 넣으면서 **다음 호까지 남긴 것** (5단계). 못 남긴 것도 담는다 —
   * 「올렸습니다」만 보이고 실제로는 안 올라갔으면 다음 호에서 또 묻는다.
   */
  carried?: Carried[]
  /** 「양산」 한 단추가 돈 자취 (3단계). 옛 「양산 시작」으로 돌리면 없다 */
  auto?: AutoTrace
  /** 카드가 0 일 때 쓰기·띄우기까지 이어 간 자취 (6단계) */
  finish?: FinishTrace
  /** 원본에서 무엇이 바뀌었나 — 모으기까지 갔으면 늘 있다 (M3) */
  changes?: RecipeChanges
  /** 원본에만 있던 자리라 뺀 것 (M3) */
  dropped?: DroppedSlot[]
  /**
   * 입력이 그대로라 **다시 안 만들고** 지난 결과를 보인 것이면 그 결과를 만든 시각 (M3, `make.ts`).
   * 비면 이번에 만든 것이다
   */
  reused?: string
  /** AI 없이 본 판에서 — 지금 「만들기」를 누르면 지난 결과가 그대로 뜬다(입력이 그대로다) */
  fresh?: boolean
  /** 「AI 에게 맡기기」가 한 일 (2026-09-30, `agent.ts`) — 넣은 답 수 · 버리거나 비운 것 · 값 · 초 */
  agent?: {
    put: number
    refused: string[]
    cost?: number
    seconds: number
    why: { path: string; why: string }[]
    /** 넣은 답 — `was` 는 그 자리에 원본이 쓰던 파일(원본 폴더 안 자리). 화면이 원본 그림 → 고른 그림을 나란히 그린다 (2026-10-01) */
    picks?: { path: string; value: string; was?: string }[]
  }
  /**
   * **통째로 맡기기** (2026-10-02, `whole.ts`) — 이번 결과가 AI 가 원본을 본보기로 만든 레시피를 썼나.
   * `notes` 는 AI 가 적은 바꾼 곳, `asks` 는 짐작이라 사람이 확인할 것
   */
  whole?: { at: string; notes: { path: string; why: string }[]; asks: number; cost?: number; seconds?: number }
  /** 아예 시작도 못 한 경우 */
  error?: string
}
