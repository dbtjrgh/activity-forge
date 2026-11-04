import type { InboxResult } from './inbox'

/**
 * **사내 공유 폴더에서 가져오기** (2026-10-14) — 작업대 「리소스」 카드와 받을 리소스 창이 그린다. 메인 `services/forge/sharefetch.ts`.
 * 기획서에 적힌 소리 이름과 학습코드 자리의 애니메이션 · 영상을 공유 폴더에서 찾고, 없는 것은 앞 호 완성본에서 찾는다.
 * 리소스나 기획서를 넣은 학습코드(만드는 중)는 찾은 것을 저절로 가져오고 그렇다고 알린다(2026-10-15).
 */

/**
 * 공유 폴더의 기본 주소 — **주소는 여기만 안다.** 설정에서 바꾸면 `.user.json` 의 `shareRoot` 가 이것을 덮는다(비면 이것).
 * 설정 서랍이 「기본값」으로 보이고, 메인이 찾을 때 쓴다
 */
export const SHARE_DEFAULT = '\\\\nas.example\\share\\04. 콘텐츠'

/** 가져올 파일 하나 */
export interface ShareItem {
  /** 파일 이름 */
  name: string
  kind: 'sound' | 'lottie' | 'video'
  /** 어디서 — 공유 폴더 · 앞 호 완성본(호 저장소) */
  where: 'share' | 'hall'
  /** 어디서의 짧은 자리 — 공유 폴더 앞머리를 뗀 길, 앞 호는 학습코드 */
  from: string
  /** 리소스 폴더 안 자리 */
  to: string
  bytes: number
  /** 기획서 참고 이름이라 이 학습코드 폴더가 아니라 같은 호 앞선 학습코드 폴더에서 찾았다(`shareown.ts` `pickNear`) — 화면이 들어 보라고 알린다 */
  near?: boolean
}

/** 못 가져오는 것 하나와 그 까닭 */
export interface ShareMiss {
  name: string
  why: string
  /** 공유 폴더와 앞 호 완성본 어디에도 없다 — 화면의 「없음」. 거짓이면 있지만 고르지 않은 것(크기가 다른 판 여럿 · 다른 학습코드 파일) */
  none?: boolean
}

/** 마지막으로 저절로 가져온 것 — 때와 종류별 수(`_recipe/<코드>.share.json`) */
export interface ShareAuto {
  at: string
  kinds: Partial<Record<ShareItem['kind'], number>>
}

export interface ShareLook {
  code: string
  /** 리소스 폴더 */
  dir: string
  /** 찾은 공유 폴더 — 설정에서 바꾼 것 또는 기본 주소 */
  root: string
  /**
   * 공유 폴더에 닿지 못했으면 화면에 그대로 보일 한 문장 — 가져오기 단추를 막는다. 비면 닿았다.
   * `error` 와 따로 둔다 — 이것은 고칠 길(로그인 · 설정)이 있는 형편이고, `error` 는 학습코드 · 양산기 쪽 문제다
   */
  offline?: string
  items: ShareItem[]
  /** 이미 리소스 폴더나 호 저장소에 같은 이름이 있어 뺀 수 */
  have: number
  miss: ShareMiss[]
  /** 기획서에 낱개로 적힌 소리 이름 수(이 학습코드 몫 + 다시 쓰는 앞 학습코드 것 + 수학 숫자 읽기 이름) */
  planNames: number
  /** 소리를 기획서로 못 찾았거나, 영상을 안 본 까닭 같은 참고 — 받을 리소스 창(한 줄)에는 안 보인다 */
  notes: string[]
  /**
   * 자리를 모르는 종류가 있으면 그 한 문장(누리 영상 · 누리 전자책) — 받을 리소스 창에도 보인다. 참고(`notes`)로만 두면 그 창에서는
   * 「없음 0개」로만 읽혔다(2026-10-23 검토). 학습코드 전체를 모르면 `error` 다
   */
  unknown?: string
  /** 상한에 걸려 다 못 봤으면 그 까닭 */
  truncated: string
  /** 걸린 시간(ms) */
  ms: number
  /** 마지막으로 저절로 가져온 것 — 화면이 눈에 띄게 알린다. 때(`at`)가 바뀌면 화면은 리소스 목록을 다시 읽는다 */
  auto?: ShareAuto
  /** 지금 뒤에서 저절로 넣는 중인 수 — 화면은 「가져오는 중」을 보이고 단추를 막고, 끝날 때까지 다시 묻는다 */
  copying?: number
  /** 마지막 저절로 넣기에서 생긴 문제 한 줄(실패 · 이름 같은 다른 파일 · 시간 상한) */
  autoNote?: string
  /** 리소스 폴더에 있는, 기획서 참고 이름으로 다른 학습코드 폴더에서 가져온 소리(`near`) — 맞는 녹음인지 들어 보라고 알린다 */
  near?: string[]
  error?: string
}

/** 「가져오기」를 누른 결과 — 다시 재서 그때 찾은 것을 넣는다 */
export interface ShareTake {
  look: ShareLook
  put: InboxResult
}
