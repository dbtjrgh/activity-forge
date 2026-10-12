/** 폴더 트리 · 속성 · 권한 화면이 주고받는 모양 — `ipc.ts` 가 223줄이 되어 갈랐다 (2026-09-30, 동작 변화 없음). `ipc.ts` 가 다시 내보낸다. */

export interface FolderEntry {
  name: string
  path: string
}

export interface FolderListResult {
  /** 조회한 디렉터리 경로 */
  path: string
  /** 하위 폴더 목록. 오류가 있으면 빈 배열 */
  folders: FolderEntry[]
  /** 조회에 실패한 경우의 사용자용 메시지 */
  error?: string
}

/** ACL 항목 하나 — 어떤 사용자/그룹에게 어떤 권한이 부여(또는 거부)되었는지 */
export interface AccessEntry {
  /** 사용자 또는 그룹 (예: BUILTIN\Administrators, DESKTOP-1\user). 해석 불가 시 SID */
  principal: string
  /** Windows FileSystemRights 원본 문자열 (예: "FullControl, Synchronize") */
  rights: string
  /** 허용(Allow) 이 아니라 거부(Deny) 규칙인지 */
  deny: boolean
  /** 상위 폴더에서 상속된 규칙인지 */
  inherited: boolean
  /** 현재 사용자 본인 또는 소속 그룹에 적용되는 규칙인지 */
  appliesToMe: boolean
}

/** 폴더 권한 정보 */
export interface FolderPermissions {
  /**
   * 현재 사용자가 이 폴더에 쓸 수 있는지. ACL 에서 계산한다.
   * ACL 을 읽지 못했으면 null(알 수 없음).
   * Node 의 fs.access(W_OK) 는 Windows 에서 읽기 전용 속성만 보고 ACL 을 보지 않아 쓰지 않는다.
   */
  writable: boolean | null
  /** 폴더 소유자. 조회 실패 시 null */
  owner: string | null
  /** 권한을 판정한 기준 계정 (예: DESKTOP-1\user) */
  currentUser: string | null
  /** 사용자/그룹별 권한 목록 */
  entries: AccessEntry[]
  /** ACL 조회에 실패한 경우의 사용자용 메시지 */
  error?: string
}

/** 폴더 속성. 재귀 탐색이 필요한 총 용량은 별도 API 로 계산한다. */
export interface FolderInfo {
  path: string
  name: string
  /** epoch ms. 파일시스템이 제공하지 않으면 null */
  createdAt: number | null
  modifiedAt: number | null
  /** 바로 아래 항목 수 */
  folderCount: number
  fileCount: number
  /** 바로 아래 파일들의 용량 합계(바이트). 하위 폴더는 포함하지 않는다 */
  directFileBytes: number
  permissions: FolderPermissions
  error?: string
}

/** 하위 폴더까지 재귀로 합산한 용량 */
export interface FolderSize {
  path: string
  bytes: number
  files: number
  folders: number
  /** 시간/항목 제한에 걸려 중단된 경우 true */
  truncated: boolean
  error?: string
}

/** 첫 화면에서 보여줄 기본 경로 */
export const DEFAULT_DIR = 'D:\\'
