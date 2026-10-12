/** 리소스 인박스 · 끝 걸음 · figma 화면 · 「양산」 한 단추. 왜 모양을 여기 적는지는 `../forge.ts` 머리말. */

import type { MatchResult } from './ai'

// ─── 리소스 인박스 (4단계) ─────────────────────────────────────────────
//
// 「리소스 폴더에 넣으면」의 그 폴더를 **사람이 찾아 들어가지 않게** 한다.
// 끌어다 놓으면 갈래별로 나뉘어 들어가고, 넣은 뒤에 양산이 저절로 돈다.
//
// **넣지 못한 것을 감추지 않는다.** 갈래를 못 가린 것 · 다른 차시 이름이 붙은
// 것 · 이름이 같은데 내용이 다른 것은 **그대로 두고** 목록으로 돌려준다.
// 짐작해서 남의 파일을 덮어쓰는 것이 제일 나쁜 실패다.

/** 넣은 파일 하나. */
export interface InboxTook {
  /** 리소스 폴더 안에서의 자리 — `images/crayon1.png` */
  rel: string
  /** 어디서 왔나 (절대 경로) */
  from: string
  bytes: number
}

/** 넣지 않고 붙들어 둔 것 하나 — 물어야 하거나, 넣다 걸렸거나. */
export interface InboxHold {
  name: string
  from: string
  /** 왜 안 넣었는지. 사람이 읽을 한 문장 */
  why: string
}

/** 이름이 같은데 내용이 다른 자리. 덮어쓸지는 사람이 정한다. */
export interface InboxClash {
  rel: string
  from: string
  /** 지금 폴더에 있는 것의 크기 */
  mine: number
  /** 넣으려는 것의 크기 */
  theirs: number
}

/** 한 번 놓은 결과. */
export interface InboxResult {
  /** 넣은 자리 (리소스 폴더) */
  dir: string
  /** 놓은 것에서 찾아낸 파일 수 — 폴더를 놓으면 그 안까지 센다 */
  found: number
  took: InboxTook[]
  /** 이미 똑같은 것이 있어 건너뛴 자리 */
  same: string[]
  clash: InboxClash[]
  /** 갈래나 차시를 못 가려 **안 넣은** 것 */
  ask: InboxHold[]
  /** 넣다 걸린 것 — 크기가 안 맞거나 못 쓴 것 */
  failed: InboxHold[]
  /** 넣은 바이트 합 */
  bytes: number
  /** 상한에 걸려 다 못 봤나 */
  truncated: boolean
  /** 사람이 읽을 한 줄 */
  note: string
  error?: string
}

/**
 * **한 곳에 놓은 것을 차시별로 가른 결과** (2026-09-16).
 *
 * 놓는 자리가 한 곳이라 한 번에 여러 차시가 들어온다. 차시마다 여태 쓰던
 * `InboxResult` 를 그대로 담고, **어느 차시인지 못 가린 것**은 따로 모은다 —
 * 그것이 사람이 손댈 자리다.
 */
/** 놓은 것에서 가려 넣은 화면 · 기획서 한 개. 공용 EN 기획서는 `code` 가 빈 글이다 */
export interface PaperPlaced {
  code: string
  kind: 'figma' | 'plan'
  /** 넣은 자리(그 폴더 기준). 이미 같은 것이 있어 안 넣었으면 빈 글 */
  file: string
  note: string
}

export interface SortedInbox {
  /** 놓은 것에서 찾아낸 파일 수 */
  found: number
  truncated: boolean
  /** 차시별 결과. 차시 코드 순 */
  lessons: { code: string; result: InboxResult }[]
  /** figma 화면 · 기획서로 가려 제 자리(`_figma` · `_plan` · 공용 `_plan`)에 넣은 것 (M5, `sortpaper.ts`) */
  papers: PaperPlaced[]
  /** 갈래나 차시를 못 가려 **안 넣은** 것 */
  ask: InboxHold[]
  failed: InboxHold[]
  /** 사람이 읽을 한 줄 */
  note: string
  error?: string
}

/**
 * **끝까지 저절로 간 자취** (6단계).
 *
 * 카드가 0 이면 쓰기와 띄우기를 이어서 합니다. **안 갔으면 왜 안 갔는지**가
 * 늘 `why` 에 옵니다 — 아무 말이 없으면 사람이 다음에 뭘 할지 모릅니다.
 *
 * **저절로 가는 것은 새로 만드는 차시뿐입니다.** 이미 있는 액티비티는
 * 덮어쓰기라, 사람이 눌러야 합니다 (`write.ts` 빗장 ③).
 */
export interface FinishTrace {
  /** 실제로 이어 갔나 (쓰기까지 갔나) */
  went: boolean
  /** 어디까지 갔는지 · 왜 멈췄는지. 사람이 읽을 한 줄 */
  why: string
  /** 띄운 주소. 못 띄웠으면 빈 글 */
  url: string
}

/** 붙여넣은 figma 화면 한 장의 결과. */
export interface ShotResult {
  /** 리소스 폴더 안에서의 자리 — `_figma/screen-….png`. 없으면 빈 글 */
  file: string
  /** 사람이 읽을 한 줄. 왜 안 됐는지도 여기 */
  note: string
  error?: string
}

/**
 * 붙여넣은 화면 한 장과 그 **미리보기.**
 *
 * **미리보기를 같이 보내는 까닭** (2026-09-21 사용자 말 — 「잘 붙여넣었는지
 * 미리보기도 구현해놓으면 좋을듯」). 붙여넣기는 결과가 글 한 줄뿐이라
 * **엉뚱한 것을 붙여도 똑같이 「화면을 받았습니다」로 보인다.** 그림을 보여
 * 주면 그 자리에서 안다.
 */
export interface Shot {
  /** 리소스 폴더 안에서의 자리 — `_figma/screen-….png` */
  file: string
  /** 줄여 그린 미리보기 (`data:image/png;base64,…`). 못 그리면 빈 글 */
  thumb: string
  /** 원본 크기 — 「잘렸나」를 사람이 가늠할 값 */
  width: number
  height: number
}

/** 그 회차에 붙여넣은 화면 전부. */
export interface ShotsResult {
  shots: Shot[]
  error?: string
}

/** 리소스 폴더 안 그림의 썸네일 (M4) — `{상대 경로: dataURL}`. 그림이 아니거나 못 그린 것은 없다 */
export interface ThumbsResult {
  thumbs: Record<string, string>
  /** 한 번에 그리는 장 수를 넘어 뒤쪽은 안 그렸다 */
  truncated: boolean
  error?: string
}

/**
 * 한 단추가 **몇 바퀴 돌고 왜 멈췄는가** (3단계).
 *
 * **왜 멈췄는지를 늘 적는다.** 단추 하나로 묶으면 그 안에서 무슨 일이
 * 있었는지 사람이 볼 길이 없어진다 — 「끝났습니다」만 보이면 AI 를 부른
 * 것인지, 부르고 물린 것인지, 아예 부를 값어치가 없어 건너뛴 것인지 모른다.
 */
export interface AutoTrace {
  /** 「양산 시작」을 몇 번 돌렸나. 처음 한 번을 1 로 센다 */
  rounds: number
  /** AI 를 부른 횟수. 0 이면 부르지 않은 것이고 why 에 까닭이 있다 */
  calls: number
  /** 그동안 나간 대략 토큰 (브리프 글자 수로 센 어림 — 껍데기는 뺀 값) */
  tokens: number
  /** 왜 여기서 멈췄나 — 사람이 읽을 한 줄 */
  why: string
  /** 마지막으로 AI 가 한 일. 물린 줄과 브리프가 그대로 들어 있다 */
  match?: MatchResult
  /**
   * 이 판에서 **실제로** 부른 것 — claude 가 적어 준 토큰 넷 · 값 · 시간 (2026-09-28, M2).
   * 위 `calls` · `tokens` 는 맞추기 바퀴 수와 글자 수 어림이라 이것과 다르다.
   */
  spent?: AiSpent
}

/** 실제로 부른 것의 합. 녹음에서 튼 답은 안 센다 — 돈이 안 나갔다 */
export interface AiSpent {
  calls: number
  /** 값을 못 받은 부름 수 — 0 이 아니면 합이 모자란 것이다 */
  unknown: number
  input: number
  cacheWrite: number
  cacheRead: number
  output: number
  /** 달러 */
  cost: number
  ms: number
}
