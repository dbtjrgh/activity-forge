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
  /**
   * 이 모듈로 만든 첫 학습코드라 원본 후보가 하나도 없다(`ok` 는 false, `module` 은 있음).
   * 대화로 생성은 못 하지만, Claude Code 세션에서 만든 것을 미리보기 · 검수 완료는 한다 (2026-10-12, M38_1 · M38_2)
   */
  first?: boolean
  /**
   * 배치표가 모듈을 못 정했지만 호 저장소에 개발 완료로 만들어 둔 학습코드라 그 모듈을 보인다(`ok` 는 false).
   * 앞선 호 기록으로만 정하는 배치표가 지난 호의 완성본을 「갈림」으로 막던 것 — 열어서 보고 미리보기는 된다 (2026-10-14)
   */
  made?: boolean
}

/**
 * 종류마다 지금 몇 개, 같은 모듈 완성본은 몇~몇 개, 기획서에 적혔는데 없는 소리 (2026-10-14, `services/forge/rsccount.ts`).
 * **「없음」으로 세는 것은 `missing` 하나뿐이다** — 원본 하나와 개수를 견주던 때는 다 넣은 완성본에도 절반이 「부족」이었다
 */
export interface NeedRow {
  kind: string
  /** 리소스 폴더에 지금 놓인 파일 수 */
  here: number
  /** 같은 모듈 개발 완료 완성본이 쓴 수의 범위 — 완성본이 둘 밑이거나 모듈을 모르면 null(`rscrange.ts`) */
  range: { min: number; max: number; n: number } | null
  /** 기획서에 낱개로 적혔는데 리소스 폴더와 호 저장소 어디에도 없는 이 학습코드 소리 — 소리 줄에만 */
  missing: string[]
  /** 기획서에 범위(`nar01~16`)로만 나와 확실하지 않은 것 가운데 없는 것 — 세지 않는다 */
  unsure: string[]
}

/** 기획서로 소리 이름을 확인했나 — `note` 가 비었으면 `names` 개를 확인했다(`plansound.ts`) */
export interface PlanCheck {
  names: number
  note: string
}

/**
 * **그 학습코드를 누가 끝냈나** (`services/forge/owner.ts`) — 호 저장소 작업 트리의 activityInfo.json.
 * `mine` 개발 완료이고 만든 사람과 팀이 설정(.user.json)과 둘 다 같다. `theirs` 개발 완료인데 내 것이 아니다.
 * 개발 완료가 아니면 둘 다 false 다 — 만드는 중인 학습코드는 막지 않는다. 못 읽었으면 `finished` 가 null
 */
export interface Owner {
  finished: boolean | null
  developer: string
  devTeam: string
  finishedDate: string
  mine: boolean
  theirs: boolean
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
  /** 종류마다 지금 수 · 같은 모듈 범위 · 기획서에 적혔는데 없는 소리. 못 셌으면 빈 배열이고 `needError` 에 까닭 */
  need: NeedRow[]
  /** 기획서로 소리 이름을 확인했나 */
  planSound: PlanCheck
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
  /**
   * 주인 형편 (2026-10-14). `line` 은 남이 끝냈을 때 보일 한 문장(아니면 빈 글),
   * `committed` 는 마지막 커밋에서도 개발 완료인가 — 그러면 커밋 단추가 「수정사항 커밋」이다
   */
  owner?: Owner & { line: string; committed: boolean }
  /** 아예 읽지 못한 경우의 사용자용 메시지 */
  error?: string
}


/**
 * 인터북 그림에서 **아직 없는 판** (`chatpages.ts` · forge `gen/pagemarks.ts`, 2026-10-13).
 * figma 는 누를 자리에 별을 그려서만 내보내 준다 — 그림에서 별을 찾아 별을 숨긴 판 · 효과만 남긴 판을 그림마다 적는다
 */
export interface PageNeeds {
  /** 누를 자리 별이 그려진 그림 수 — 0 이면 화면이 칸을 안 그린다 */
  stars: number
  needs: { rel: string; missing: string[] }[]
  /** 픽셀까지 같은 그림 */
  same: [string, string][]
  error?: string
}

/**
 * **기획서 1쪽 모듈넘버와 배치표 모듈** (2026-10-14, `services/forge/planmodule.ts`). 9호 MAL3M08W2S1 은 배치표가 M30 인데
 * 기획서는 M30_3 이었고, 앱 어디에도 다르다는 말이 없었다 — 대화 속 Claude 가 기획서를 읽고서야 물었다.
 */
export interface PlanModule {
  code: string
  /** 기획서 1쪽에서 읽은 모듈 — 기획서가 없거나 못 읽었으면 빈 글 */
  planModule: string
  /** 그 기획서 파일 이름 */
  plan: string
  /** 배치표가 정한 모듈 — 못 정했으면(갈림) 빈 글 */
  layoutModule: string
  /** 기획서 모듈이 모듈 폴더(또는 스펙)가 있는 다른 모듈일 때만 true — 작업대가 「기획서대로 바꾸기」를 보인다 */
  differs: boolean
  /** 다르다고는 안 하지만 알릴 한 줄 — 판 이름(`M30_1`) · 기획서마다 다름 · 다른 학습코드 기획서. 없으면 빈 글 */
  note: string
  /** 「기획서대로 바꾸기」를 누른 결과 한 줄 */
  said?: string
  error?: string
}
