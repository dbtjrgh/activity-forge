/**
 * **원본 바꾸기**의 모양 (2026-09-30) — 기계가 고른 앞 학습코드가 틀렸을 때 사람이 다른 것으로 정한다.
 * 받을 리소스 창 · 만들기가 다 이 원본을 따르므로, 틀린 원본은 figma 에서 엉뚱한 것을 내보내게 한다.
 */

export interface OriginChoice {
  code: string
  /** M 번호 두 자리 — 화면이 `HO_OF` 로 호 이름을 붙인다 */
  issue: string
  /** L1W1S3 */
  slot: string
  /** 만들 학습코드와 같은 레벨 · 주 · 순서인가 — 아니면 값 짜임이 다를 수 있다 */
  sameSlot: boolean
}

export interface OriginChoices {
  code: string
  module: string
  /** 지금 쓰는 원본 — 사람이 적었으면 그것, 아니면 기계 판정 */
  now: string
  /** 사람이 안 적었으면 기계가 고를 것 — 목록에 「추천」이 붙는다 */
  first: string
  /** 배치표에 사람이 적은 원본. 없으면 빈 글 */
  pinned: string
  /** 작업대에서 바꾼 원본인가 — 참이면 「원래 원본으로 되돌리기」가 뜬다(파일에 적힌 원본은 안 지운다) */
  changed: boolean
  /** 그 모듈을 쓴 학습코드 전부, 베끼기 좋은 차례로 */
  choices: OriginChoice[]
  /** 이 학습코드가 도는 중이면 참 — 도는 동안은 못 바꾼다 */
  running: boolean
  /** figma 화면과 후보 장면을 견준 것 — 생성 때 잰 것만(열 때 새로 재지 않는다). 아직 안 쟀으면 null */
  scene: SceneCheck | null
  /** 폴더에 남은 다른 호 원본의 파일 — 지금 원본은 안 쓰는 것(`services/forge/leftover.ts`) */
  leftover: Leftover[]
  error?: string
}

/** 후보 하나의 장면 점수 — figma 화면에 그 후보의 장면 그림이 몇 장 있나 */
export interface SceneScore {
  code: string
  /** 화면에 있다고 본 그림 수 */
  hits: number
  /** 잰 그림 수 */
  tried: number
  /** 그림마다 맞음 0~1 */
  seen: { rel: string; ratio: number }[]
}

/**
 * **figma 화면과 원본 장면 비교** (2026-10-02) — 원본은 AI 보다 먼저 정해지고 그 뒤로 아무도 다시 안 물었다.
 * 9호 KOL1M08W4S2 가 7호 박사 장면으로 만들어졌는데 figma 는 2호 탐험가였다. 셈은 forge `gen/scenefind.ts`
 */
export interface SceneCheck {
  /** 잰 원본 */
  origin: string
  /** 견준 figma 화면 수(1x 만) */
  shots: number
  scores: SceneScore[]
  /** 장면이 더 맞는 후보 — 지금 원본이 맞으면 null */
  better: string | null
}

/** 폴더에 남은 다른 호 원본 파일 하나 */
export interface Leftover {
  /** 리소스 폴더 안 경로 */
  rel: string
  /** 바이트까지 같은 파일을 가진 다른 호 완성본 */
  from: string
}

/** 「다른 호 원본 파일 휴지통으로」 결과 */
export interface LeftoverTrash {
  moved: string[]
  failed: { rel: string; why: string }[]
  error?: string
}
