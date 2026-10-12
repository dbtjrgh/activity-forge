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
  /** 스펙 주인인가 — 참이면 스펙 화면 · 「새 모듈」 알림이 열린다 (`.user.json` 의 specOwner, PC 마다 따로) */
  specOwner?: boolean
  /** 고른 자리에 호가 없는 등, 알려야 할 것 */
  warn?: string
  /** 아예 읽지 못한 경우의 사용자용 메시지 */
  error?: string
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
  error?: string
}

/** 앱을 빌드한 판 — 어느 커밋에서 언제(`electron.vite.config.ts` 가 `version.json` 으로 남긴다) */
export interface AppStamp {
  source: string
  builtAt: number
  /** 사람이 읽는 판 번호(package.json `version`) — 2026-10-02 전에 빌드한 판에는 없다 */
  version?: string
}

