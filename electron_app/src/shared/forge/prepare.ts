/** 리소스 화면이 처음 보여 줄 것의 모양 — `board.ts` 가 309줄이 되어 갈랐다 (2026-09-30, 동작 변화 없음). */

/** 리소스 파일 한 개. forge `files.ts` 의 `RscFile` 과 같은 모양이다. */
export interface RscFile {
  /** 폴더 안에서의 이름. `tool/pattern1.png` 처럼 한 겹 들어간 것도 있다 */
  name: string
  /** 어느 폴더에 놓였나 — images · sounds · animations · font · root */
  base: string
  kind: string
}

/** 배치표가 정한 모듈과 원본. 못 정하면 `ok: false` 와 까닭. */
export interface LayoutPick {
  ok: boolean
  module: string
  /** 베낄 학습코드 */
  origin: string
  slot: string
  /** 사람이 정함 · 규칙 · 갈림 · 없음 */
  verdict: string
  /** 사람에게 보일 한 줄. 못 정했으면 왜 못 정하는지 */
  why: string
  /** 원본이 같은 차시자리인가. 아니면 값의 짜임이 다를 수 있다 */
  sameSlot: boolean
  /** 다음 후보 몇 개 */
  alt: string[]
}

/** 갈래마다 「원본은 몇 개, 지금 몇 개」 */
export interface NeedRow {
  kind: string
  /** 원본이 쓰는 별칭 수 */
  origin: number
  /** 리소스 폴더에 지금 놓인 파일 수 */
  here: number
}

/**
 * 리소스 화면이 처음 보여 주는 것 — **묻지 않고 알 수 있는 것**을 한 번에 모은다.
 *
 * 화면이 채널을 네 번 부르지 않고 한 번에 받는다. 넷 중 하나만 실패했을 때
 * 화면이 반쯤 채워진 채 멈추는 것을 막으려는 것이다 — 자리마다 실패를 담는다.
 */
export interface Prepare {
  /** 만들 학습코드 */
  code: string
  layout: LayoutPick
  /** 리소스 폴더. `exists: false` 면 아직 안 만든 것이다 */
  rsc: { dir: string; exists: boolean; files: RscFile[]; error?: string }
  /** 원본과 견준 모자란 것. 원본을 못 떠 왔으면 빈 배열이고 `needError` 에 까닭 */
  need: NeedRow[]
  needError?: string
  /**
   * 양산이 파일을 쓸 자리의 쓰기 권한. **ACL 로 판정한다** —
   * `fs.access(W_OK)` 는 Windows 에서 ACL 을 보지 않는다(CLAUDE.md 의 함정).
   * 모르면 `writable: null`.
   */
  write: {
    dir: string
    writable: boolean | null
    why: string
    /** 그 자리의 형편 한 줄(M7) — 새 자리 · 빈 뼈대 — 채웁니다 · 사람 것이 있음 */
    slot?: string
    /** 9호 빈 뼈대인가 — 「끝」을 못 누른다(아직 안 만듦) */
    dummy?: boolean
    /** 원격보다 뒤처진 커밋(마지막으로 받은 것 기준) — 모르면 null */
    behind?: number | null
    behindNote?: string
  }
  /** 그 모듈의 스펙이 있는가. 없으면 양산 전에 스펙부터 써야 한다 */
  hasSpec: boolean
  /** 기획서 PDF 를 읽을 poppler 가 안 돈다 — 그 까닭(M5, `poppler.ts`). 돌면 빈 글 */
  planReader: string
  /**
   * **작업 순서 막대가 보는 것** (2026-10-01, `lib/benchorder.ts`). 진행판 칸이 보는 것(`boardwork.ts`)과 같은 셈이다.
   * figma 화면이 몇 장인가 · 이 모듈이 화면을 받아야 하나 · 호 저장소에 이 학습코드가 이미 있나(빈 뼈대 빼고) · 개발 완료인가(모르면 null)
   */
  shots: number
  needsShot: boolean
  written: boolean
  finished: boolean | null
  /** 아예 읽지 못한 경우의 사용자용 메시지 */
  error?: string
}

