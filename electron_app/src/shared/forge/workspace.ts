/** 작업 폴더 · 스펙 갱신 · 업데이트 확인의 모양 — `board.ts` 가 309줄이 되어 갈랐다 (2026-09-30, 동작 변화 없음). 부르는 쪽은 늘 `shared/forge` 를 import 한다. */

/** 작업 폴더 상태 */
export interface Workspace {
  /** 호 repo(sparkon_mNN) 들이 있는 자리 */
  dir: string
  /** 무엇을 보고 그 자리를 골랐나 */
  from: string
  /** 그 자리에서 찾은 호 개수 */
  repos: number
  /** 스펙·배치표가 있는 자리(forge repo) */
  forgeRoot: string
  /**
   * 리소스를 놓는 자리. **비어 있으면 호 저장소 안**
   * (`sparkon_mNN/public/sparklab/<코드>`) 이라는 뜻이다.
   *
   * 따로 정할 수 있게 한 까닭 — 호 저장소는 **이미 만든 회차가 들어 있는 남의
   * 자리**다. 시험 삼아 넣고 빼는 일까지 거기서 하면 멀쩡한 것을 건드린다.
   */
  rscRoot: string
  /** 「끝」이 activityInfo.json 에 적는 만든 사람 · 팀 (`.user.json`) — 다른 개발자는 서랍에서 제 이름으로 바꾼다 */
  developer?: string
  devTeam?: string
  /** 사내 공유 폴더를 바꿨으면 그 자리(`.user.json` 의 shareRoot). 비면 기본 주소(`SHARE_DEFAULT`) */
  shareRoot?: string
  /** 공유 폴더 칸에 적은 글을 받지 않은 까닭 — 그 칸 아래에만 보인다(서랍 전체 `error` 와 따로) */
  shareError?: string
  /** 공용 모듈 저장소(sparkon_common) 자리 (2026-10-21) — forge `commonroot.commonPick()` 그대로 */
  common?: CommonPlace
  /** 고른 공용 폴더를 받지 않은 까닭 — 그 줄 아래에만 보인다(`shareError` 와 같은 까닭) */
  commonError?: string
  /** 고른 자리에 호가 없는 등, 알려야 할 것 */
  warn?: string
  /** 아예 읽지 못한 경우의 사용자용 메시지 */
  error?: string
}

/**
 * **공용 폴더 자리** (2026-10-21 사용자 말 — 「공용폴더도 비슷한 경로로 있긴한데 경로 정할 수 있게 해놔」).
 * forge `CommonPick` 의 모양을 적어 둔 것이다 — `workspace.ts` 가 그 결과를 대입하므로 갈라지면 컴파일에서 걸린다
 */
export interface CommonPlace {
  /** 쓰는 자리 */
  dir: string
  /** `.user.json` 의 commonRoot. 비면 기본 자리(`home`)를 본다 */
  saved: string
  /** 기본 자리 — `<작업 폴더>/sparkon_common` */
  home: string
  /** 기본 자리가 쓰는 자리로 이어지나(같은 자리이거나 그리로 가는 정션) — `sparkon link`(미리보기 연결)는 기본 자리만 본다 */
  beside: boolean
  /** 기본 자리에 아무것도 없나 — 그러면 미리보기 「연결」이 거기에 쓰는 자리로 가는 정션을 먼저 건다(`services/forge/commonlink.ts`) */
  free: boolean
}

/**
 * **「스펙 갱신」 결과** — clone 한 저장소에서 `git pull --ff-only` 한 것 (2026-09-18).
 *
 * 스펙(`_spec`·`_layout`)과 양산기 **코드**를 갈라 센다. 스펙은 부를 때마다
 * 디스크에서 읽어 바로 먹지만, 코드는 앱에 묶여 있어 **새 zip 이 있어야** 따라간다.
 */
export interface SpecRefresh {
  /** 받았거나 이미 최신이면 참. 안 받았으면(고친 것이 있다·갈라졌다 등) 거짓 */
  ok: boolean
  /** git 저장소 뿌리 */
  repo: string
  /** 받기 전·후 커밋 (짧은 꼴). 못 물어봤으면 빈 글 */
  before: string
  after: string
  /** 받은 커밋 수 */
  commits: number
  /** 바뀐 스펙·배치표 파일 (저장소 기준 경로) */
  specs: string[]
  /** 바뀐 양산기 코드 파일 — **새 zip 이 있어야 앱에 들어온다** */
  code: string[]
  /** 받지 않은 까닭이 「고친 것이 있다」일 때 그 목록 */
  dirty: string[]
  /** 패키지(package.json · yarn.lock)가 바뀌었나 — 그러면 앱을 다시 켜야 한다(켤 때 받는다) */
  packages?: boolean
  /** 앱 새 버전을 받아 두었다 — 앱이 곧 다시 시작한다(`services/forge/appupdate.ts`) */
  appChanged?: boolean
  /** 사람이 읽을 한 줄 */
  note: string
  error?: string
  /** 공용 저장소(sparkon_common)를 받은 결과 — 자료 · 앱 받기와 따로 보인다(`services/forge/commonpull.ts`) */
  common?: CommonPull
}

/** 「업데이트」가 공용 저장소를 받은 결과 (2026-10-21) — 못 받아도 자료 · 앱 받기는 그대로다 */
export interface CommonPull {
  /** 받았거나 이미 최신이면 참. 안 받았으면(하던 일 · 고친 파일 · 충돌 · 폴더 없음 등) 거짓 */
  ok: boolean
  /** 사람이 읽을 한 줄 */
  note: string
  /** 받기를 막은 커밋 안 한 파일 · 충돌한 파일(공용 저장소 기준 경로) */
  files?: string[]
}

/** 공용 저장소에 받을 것이 있나 (2026-10-21) — 원격 main 커밋만 묻고(`ls-remote`) 받지 않는다 */
export interface CommonCheck {
  /** 원격 main 의 커밋이 지금 브랜치에 없으면 참. 못 물어봤으면 null — 단추를 켜지 않는다 */
  newer: boolean | null
  /** 못 물어본 까닭 한 줄 */
  why?: string
}

/**
 * **원격에 새 판이 있나** (2026-09-29 사용자 말 — 「업데이트할 때마다 업데이트 버튼이 활성화돼서」).
 * `git fetch` 뒤 지금 판이 원격보다 몇 커밋 뒤인가. 받지는 않는다(받는 것은 `SpecRefresh`).
 */
export interface UpdateCheck {
  /** 원격보다 뒤처진 커밋 수. 못 물어봤으면 null */
  behind: number | null
  /** 받을 커밋의 제목 — 새것부터, 열 개까지 */
  commits: string[]
  /** 물어본 때(ms) */
  checkedAt: number
  /** 받을 수 있는 앱 새 버전 — 없거나 소스로 띄운 앱이면 null */
  app: AppStamp | null
  /** 공용 저장소 — 못 물어봐도 `error` 에 넣지 않는다(화면이 1분마다 묻기를 멈춘다) */
  common?: CommonCheck
  error?: string
}

/** 앱을 빌드한 판 — 어느 커밋에서 언제(`electron.vite.config.ts` 가 `version.json` 으로 남긴다) */
export interface AppStamp {
  source: string
  builtAt: number
  /** 사람이 읽는 판 번호(package.json `version`) — 2026-10-02 전에 빌드한 판에는 없다 */
  version?: string
}

/** dev 앱에서 켤 때 빌드한 뒤 고친 소스(`main/lib/newer.ts`) — 메인 · preload 는 앱을 다시 켜야 먹는다 */
export interface CodeChanged {
  /** electron_app 기준 경로, 늦게 고친 것부터 */
  files: string[]
  /** 훑을 파일 수 상한에 걸려 그 뒤는 안 봤다 */
  truncated: boolean
}

/** 작업대 머리줄에서 여는 호 저장소 폴더 — 액티비티 `src/activity/<코드>` · 리소스 `public/sparklab/<코드>`(`services/forge/hallfolder.ts`) */
export type HallFolder = 'activity' | 'public'

/** 폴더를 탐색기로 열었나 — 못 열었으면 사람이 읽을 까닭 */
export type FolderOpen = { ok: true; dir: string } | { ok: false; error: string }
