/** 만들려던 글 보기 · 실제로 쓰기 · 띄워 보기 · 재현 검사. 왜 모양을 여기 적는지는 `../forge.ts` 머리말. */

import type { InboxResult } from './inbox'
import type { RunResult } from './run'

// ─── 만들려던 글 보기 (3단계 3-2) ──────────────────────────────────────
//
// 사용자 말: 「안 된다고 알림이 왔으면 GameData 랑 리소스를 볼 수 있게」.
// 쓰기 전에 그대로 보여 주고, **원본과 달라진 줄만** 따로 볼 수 있게 한다.

/** 견줌 한 줄. `before`·`after` 는 줄 번호(1부터), 없는 쪽은 null. */
export interface DiffRow {
  kind: 'same' | 'add' | 'del'
  before: number | null
  after: number | null
  text: string
}

export interface MadeFile {
  name: string
  chars: number
  /**
   * 만들려던 글 그대로. **너무 길면 자른다** — 자른 것은 `clipped` 로 알린다.
   * 조용히 반만 보여 주면 「끝까지 봤는데 멀쩡하더라」가 된다.
   */
  text: string
  clipped: boolean
  /**
   * 원본의 같은 파일과 견준 것. 원본에 그 파일이 없거나 너무 커서 못 견주면
   * `rows` 가 비고 `note` 에 까닭이 담긴다.
   */
  diff?: { rows: (DiffRow | null)[]; added: number; removed: number; note: string }
}

// ─── 실제로 쓰기 (3단계 끝) ────────────────────────────────────────────
//
// **여기서부터 남과 함께 쓰는 호 저장소에 파일이 들어갑니다.** 2단계까지는
// `--dry` 로만 돌았습니다. 되돌릴 길을 확인하고 나서 씁니다.

/** 쓰기 전에 봐 두는 것. 「눌러도 되나」를 화면이 스스로 판단하게 한다. */
export interface WriteCheck {
  /** 파일이 들어갈 자리 */
  dir: string
  /** 이미 액티비티가 있나. 있으면 덮어쓰기다 */
  exists: boolean
  /** ACL 로 판정한 쓰기 권한. 모르면 null */
  writable: boolean | null
  why: string
  /**
   * 되돌릴 길. 호 저장소가 git 이고 그 자리가 **깨끗하면** git 이 곧 되돌릴
   * 길이다. 손 안 댄 것이 아니면 덮어쓸 때 남의 일감이 사라진다.
   */
  git: {
    /** 호 저장소가 git 인가 */
    repo: boolean
    /** 커밋 안 된 것들 (`git status --porcelain` 그대로) */
    dirty: string[]
    /** 사람에게 보일 한 줄 */
    note: string
  }
  /** 덮어쓰기 확인 없이 바로 써도 되나 — 새 자리이거나 빈 뼈대(더미)일 때 */
  safe: boolean
  /** 9호 더미 뼈대인가(M7, `dummy.ts`) — 그러면 「덮어쓰기」 없이 채운다 */
  dummy: boolean
  /** 그 자리의 형편 한 줄 — 새 자리 · 빈 뼈대 · 사람 것 */
  slot: string
  /** 원격보다 몇 커밋 뒤처졌나(마지막으로 받은 것 기준) — 모르면 null */
  behind: number | null
  behindNote: string
  /**
   * 막지는 않지만 **알아야 하는 것**. 지금은 하나다 — 리소스를 호 저장소 밖에
   * (`.user.json` 의 `rscRoot`) 두고 있으면, 액티비티만 호 저장소로 가고 그림과
   * 소리는 그 자리에 남는다. 브라우저에서 404 로 **조용히** 안 보인다.
   */
  warn?: string
  /** 안 되면 왜 안 되는지 */
  blocked: string
  /**
   * 막은 까닭이 「도구가 쓴 그대로가 아닌 커밋 안 된 변경」인가 — 덮어쓰기(반영)만 막을 까닭이다.
   * 검수 완료는 이것으로 막지 않는다(`done.ts`) — 그 변경이 곧 검수한 것이다
   */
  dirtyHuman?: boolean
}

/** 「끝」(M7) — 호 저장소의 activityInfo.json 을 「개발 끝」으로 다시 쓴 결과 */
export interface DoneResult {
  ok: boolean
  /** 고친 파일 */
  file: string
  /** 바뀐 칸 — 「devFinished false → true」 꼴 */
  changed: string[]
  note: string
  error?: string
}

/** 실제로 쓴 결과. */
export interface WriteResult extends RunResult {
  /** 만든 파일 — 자리와 바이트 수 */
  written: { path: string; bytes: number }[]
  /** 새로 만든 폴더 */
  dirs: string[]
  check?: WriteCheck
  /**
   * 리소스를 호 저장소로 **따라 보낸 것** (4단계). 리소스를 저장소 밖에
   * 두고 있을 때만 있다 — 액티비티만 가면 브라우저에서 404 다.
   */
  delivered?: InboxResult
}

// ─── 띄워 보기 (4단계) ─────────────────────────────────────────────────
//
// `tsc` 와 `check:repro` 를 둘 다 통과하고도 8호 결함 둘이 살아 있었습니다.
// **띄워 보지 않으면 양산이 끝난 것이 아닙니다.**

/** 정션 하나. 걸렸는지와 어디를 가리키는지. */
export interface LinkState {
  name: string
  at: string
  ok: boolean
  /** 따라간 실제 자리. 못 따라가면 그 까닭 */
  target: string
}

/** 띄우기 전에 봐 두는 것. */
export interface ViewCheck {
  repo: string
  /** 액티비티가 실제로 쓰여 있나. 안 썼으면 띄워도 볼 것이 없다 */
  activity: boolean
  links: LinkState[]
  /**
   * `sparkon_common/node_modules` 가 지금 가리키는 호.
   * **호마다 다시 거는 전역 상태다** — 다른 호가 걸려 있으면 이 차시는 못 띄운다.
   */
  linkedMonth: string
  sameMonth: boolean
  /** 못 띄울 때 걸 명령(`sparkon link MNN`). 앱의 「연결」 단추가 이것을 부른다(`services/forge/link.ts`) — 사람이 누를 때만 */
  command: string
  blocked: string
}

/** 호 저장소의 dev 서버 형편. 한 번에 하나만 띄운다. */
export interface Server {
  running: boolean
  /** vite 가 실제로 잡은 포트. 5300 이 막혀 있으면 올려 잡는다 */
  port: number | null
  /** 열 주소 — `http://localhost:<포트>/<학습코드>/` */
  url: string
  repo: string
  /** 뒤에서 200줄 */
  log: string[]
  error?: string
}

/**
 * 만든 직후 그 한 칸에만 돌리는 재현 검사 (4단계).
 *
 * `check:repro` 는 「스펙 + 원본의 값으로 다시 만들면 원본과 같은 글이 나오나」를
 * 봅니다. 전 모듈을 돌리면 9초쯤 걸리므로 **그 모듈 하나만** 돌립니다.
 */
export interface ReproResult {
  subject: string
  module: string
  ok: boolean
  /** 명령이 낸 글 그대로. 화면이 뒤 몇 줄을 보여 준다 */
  out: string[]
  error?: string
}

/** 「연결」 단추의 결과 — 걸고 나서 다시 잰 `check` 를 같이 준다 */
export interface LinkResult {
  ok: boolean
  /** CLI 가 낸 글 그대로 */
  out: string
  check: ViewCheck
  error?: string
}

/** 「양산 완료 커밋」의 결과 (`hallcommit.ts`) — 한 일을 차례대로 · 못 한 까닭 */
export interface CommitResult {
  ok: boolean
  done: string[]
  /** 커밋 · 푸시한 브랜치 — main 이 아니면 화면이 「main에 올리기」를 켠다 (2026-10-02) */
  branch?: string
  /**
   * main 에 갈 것 (`hallcommit.ts` `mainPlan`). `none` 이미 다 있음 · `behind` main 이 앞섬 · `ready` 올릴 수 있음.
   * `codes` 는 갈 「양산 완료」 커밋의 학습코드, `extra` 는 그 밖의 커밋과 까닭 — 사람이 보고 한 번 더 눌러야 같이 올라간다
   */
  toMain?: { state: 'none' | 'behind' | 'ready'; codes: string[]; extra: { sha: string; why: string }[] }
  note?: string
  error?: string
}
