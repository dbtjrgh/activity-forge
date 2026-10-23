import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC, type FolderInfo, type FolderListResult, type FolderSize } from '../shared/ipc'
import type {
  BranchPlans,
  SetupLine,
  SetupResult,
  SetupRun,
  SetupState,
  WorkPick,
  BoardKey,
  BoardList,
  Carried,
  RunRow,
  LayoutAsks,
  ModuleFolders,
  BoardResult,
  CodeChanged,
  SpecRefresh,
  NewModules,
  UpdateCheck,
  Workspace,
  GateResult,
  HallStatus,
  RegressChanged,
  RegressProgress,
  RegressResult,
  RegressState,
  RscWait,
  TeamSheet,
  TeamTally,
  SyncLine,
  SyncPlan,
  SyncResult,
  RscCleanAll,
  RscCleanAllDone,
  RscGuide,
  ThumbsResult,
  VoiceDone,
  VoiceGender,
  VoiceInfo,
} from '../shared/forge'

import { benchApi } from './bench'

// 렌더러에 노출할 커스텀 API — 작업대 몫은 `bench.ts`
const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.getVersion),
  /** dev 앱에서 켤 때 빌드한 뒤 고친 메인 · preload · 공용 소스. 실행 파일은 null */
  appCodeChanged: (): Promise<CodeChanged | null> => ipcRenderer.invoke(IPC.appCodeChanged),
  /** 하위 폴더 목록. 경로를 생략하면 기본 경로를 조회한다. */
  listFolders: (dirPath?: string): Promise<FolderListResult> =>
    ipcRenderer.invoke(IPC.listFolders, dirPath),
  /** 폴더 속성(생성/수정 시각, 항목 수, 소유자, 권한). 즉시 반환된다. */
  folderInfo: (dirPath?: string): Promise<FolderInfo> => ipcRenderer.invoke(IPC.folderInfo, dirPath),
  /** 하위 폴더까지 재귀로 합산한 용량. 큰 트리에서는 시간이 걸린다. */
  folderSize: (dirPath?: string): Promise<FolderSize> => ipcRenderer.invoke(IPC.folderSize, dirPath),
  /** 바깥 브라우저로 주소 열기. 내 컴퓨터의 dev 서버만 열린다 */
  openUrl: (target: string): Promise<string> => ipcRenderer.invoke(IPC.openUrl, target),
  /** 앱 안 창 — 실패하면 까닭, 열었으면 빈 글 */
  forgePreviewOpen: (url: string, code: string): Promise<string> => ipcRenderer.invoke(IPC.forgePreviewOpen, url, code),
  forgePreviewIssues: (): Promise<{ url: string; issues: string[] }> => ipcRenderer.invoke(IPC.forgePreviewIssues),
  /** 탐색기 등 OS 기본 프로그램으로 경로 열기. 실패 시 오류 문자열을 반환한다. */
  openPath: (target: string): Promise<string> => ipcRenderer.invoke(IPC.openPath, target),

  /** 배치표가 있는 과목·호 목록 */
  forgeBoards: (): Promise<BoardList> => ipcRenderer.invoke(IPC.forgeBoards),
  /** 다음 호 열기 (M7) */
  forgeOpenIssue: (issue: string): Promise<BoardList> => ipcRenderer.invoke(IPC.forgeOpenIssue, issue),
  /** 진행판 닫기 — 빈 배치표만 휴지통으로 */
  forgeCloseBoard: (key: BoardKey): Promise<BoardList> => ipcRenderer.invoke(IPC.forgeCloseBoard, key),
  /** 배치표가 갈린 칸 한 장 (M7) */
  forgeLayoutAsks: (key: BoardKey): Promise<LayoutAsks> => ipcRenderer.invoke(IPC.forgeLayoutAsks, key),
  /** 그 칸의 모듈을 까닭과 함께 배치표에 */
  forgeLayoutPick: (code: string, module: string, why: string): Promise<Carried> =>
    ipcRenderer.invoke(IPC.forgeLayoutPick, code, module, why),
  /** 과목의 공용 모듈 폴더 — 앞선 호가 없는 학습코드의 모듈을 고를 목록 */
  forgeModuleFolders: (subject: string): Promise<ModuleFolders> => ipcRenderer.invoke(IPC.forgeModuleFolders, subject),
  /** 진행판 한 화면 (차시 줄 + 모듈 무리 + 건너뛴 차시) */
  forgeBoard: (key: BoardKey): Promise<BoardResult> => ipcRenderer.invoke(IPC.forgeBoard, key),
  forgeRunTable: (key: BoardKey): Promise<RunRow[]> => ipcRenderer.invoke(IPC.forgeRunTable, key),
  /** 작업 폴더 상태 (호 저장소가 있는 자리) */
  forgeWorkspace: (): Promise<Workspace> => ipcRenderer.invoke(IPC.forgeWorkspace),
  /** 폴더 고르기 대화상자를 띄우고 고른 자리를 .user.json 에 적는다 */
  forgePickWorkspace: (): Promise<Workspace> => ipcRenderer.invoke(IPC.forgePickWorkspace),
  /** 리소스를 놓을 폴더 고르기. 이 아래에 학습코드 폴더가 생긴다 */
  forgePickRscRoot: (): Promise<Workspace> => ipcRenderer.invoke(IPC.forgePickRscRoot),
  /** 리소스 폴더를 글로 정한다. **빈 글이면 원래대로**(호 저장소 안) */
  forgeSetRscRoot: (dir: string): Promise<Workspace> =>
    ipcRenderer.invoke(IPC.forgeSetRscRoot, dir),
  /** 사내 공유 폴더를 글로 정한다. **빈 글이면 기본 주소** */
  forgeSetShareRoot: (dir: string): Promise<Workspace> => ipcRenderer.invoke(IPC.forgeSetShareRoot, dir),
  /** 공용 폴더(sparkon_common) 고르기 — 안에 _common/module 이 있어야 적는다 */
  forgePickCommonRoot: (): Promise<Workspace> => ipcRenderer.invoke(IPC.forgePickCommonRoot),
  /** 공용 폴더를 기본 자리(<작업 폴더>/sparkon_common)로 */
  forgeClearCommonRoot: (): Promise<Workspace> => ipcRenderer.invoke(IPC.forgeClearCommonRoot),
  /** 만든 사람 · 팀을 바꾼다 — 둘 다 적어야 받는다 */
  forgeSetMe: (developer: string, devTeam: string): Promise<Workspace> =>
    ipcRenderer.invoke(IPC.forgeSetMe, developer, devTeam),
  /** 스펙이 없는 모듈 — 열린 진행판마다 배치표가 정한 것 가운데 */
  forgeNewModules: (): Promise<NewModules> => ipcRenderer.invoke(IPC.forgeNewModules),
  /** 팀 일정표 갱신 — 렌더러는 아무것도 안 보낸다. 일정표 주소는 메인이 안다 */
  forgeTeamSheet: (): Promise<TeamSheet> => ipcRenderer.invoke(IPC.forgeTeamSheet),
  /** 진행판 맨 위 「main 에 모두 올리기」 — 계획(받아 오지 않음) · 실행(화면에 보인 열쇠만) · 도는 동안 진행 줄(끊는 함수를 돌려준다) */
  forgeSyncPlan: (): Promise<SyncPlan> => ipcRenderer.invoke(IPC.forgeSyncPlan),
  forgeSyncRun: (shown: string[]): Promise<SyncResult> => ipcRenderer.invoke(IPC.forgeSyncRun, shown),
  onForgeSync: (listener: (l: SyncLine) => void): (() => void) => {
    const wrapped = (_e: unknown, l: SyncLine): void => listener(l)
    ipcRenderer.on(IPC.forgeSyncEvent, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC.forgeSyncEvent, wrapped)
    }
  },
  /** 진행판 맨 위 「리소스 폴더 정리」 — 학습코드 전부를 재기 · 옮기기(메인이 다시 재어 화면에 보인 `<학습코드>/<이름>` 만) */
  forgeRscCleanAll: (): Promise<RscCleanAll> => ipcRenderer.invoke(IPC.forgeRscCleanAll),
  forgeRscCleanAllRun: (shown: string[]): Promise<RscCleanAllDone> => ipcRenderer.invoke(IPC.forgeRscCleanAllRun, shown),
  /** 스펙을 읽을 양산기 폴더 고르기 — clone 한 저장소 안의 forge */
  forgePickForgeRoot: (): Promise<Workspace> => ipcRenderer.invoke(IPC.forgePickForgeRoot),
  /** 그 폴더를 글로 정한다 */
  forgeSetForgeRoot: (dir: string): Promise<Workspace> =>
    ipcRenderer.invoke(IPC.forgeSetForgeRoot, dir),
  /** 양산기 폴더의 저장소에서 새 스펙을 받는다. 고친 것이 있으면 안 받는다 */
  forgeRefreshSpecs: (): Promise<SpecRefresh> => ipcRenderer.invoke(IPC.forgeRefreshSpecs),
  /** 원격에 새 판이 있나 — 받지는 않는다. 옆줄 업데이트 막대가 켤 때 · 10분마다 부른다 */
  forgeUpdateCheck: (): Promise<UpdateCheck> => ipcRenderer.invoke(IPC.forgeUpdateCheck),
  /** 「관리」 화면 — 호 저장소 · 받을 리소스 · 완성본 점검(지난 결과 · 다시 재기) · 팀별 */
  manageRepos: (): Promise<HallStatus> => ipcRenderer.invoke(IPC.manageRepos),
  manageRsc: (month?: string): Promise<RscWait> => ipcRenderer.invoke(IPC.manageRsc, month),
  manageGate: (): Promise<GateResult> => ipcRenderer.invoke(IPC.manageGate),
  manageGateRun: (): Promise<GateResult> => ipcRenderer.invoke(IPC.manageGateRun),
  manageTeams: (): Promise<TeamTally> => ipcRenderer.invoke(IPC.manageTeams),
  /** 빠른 모듈 회귀 검사 — 고친 모듈 · 지난 결과와 지금 진행 · 돌려 보기(모듈 열쇠나 이름만 보낸다) · 도는 동안 진행 줄(끊는 함수를 돌려준다) */
  manageRegressChanged: (): Promise<RegressChanged> => ipcRenderer.invoke(IPC.manageRegressChanged),
  manageRegress: (): Promise<RegressState> => ipcRenderer.invoke(IPC.manageRegress),
  manageRegressRun: (names: string[]): Promise<RegressResult> => ipcRenderer.invoke(IPC.manageRegressRun, names),
  onManageRegress: (listener: (p: RegressProgress) => void): (() => void) => {
    const wrapped = (_e: unknown, p: RegressProgress): void => listener(p)
    ipcRenderer.on(IPC.manageRegressEvent, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC.manageRegressEvent, wrapped)
    }
  },
  /** 받을 리소스 창 — 열기 · 형편 · 원본 그림(`wide` 면 크게 한 장) · 항상 위(그 창만) */
  guideOpen: (code: string): Promise<string> => ipcRenderer.invoke(IPC.guideOpen, code),
  guideGet: (code: string): Promise<RscGuide> => ipcRenderer.invoke(IPC.guideGet, code),
  guideThumbs: (code: string, rels: string[], wide = false): Promise<ThumbsResult> =>
    ipcRenderer.invoke(IPC.guideThumbs, code, rels, wide),
  guideTop: (on: boolean | null): Promise<boolean> => ipcRenderer.invoke(IPC.guideTop, on),
  // 대사 성우 — 렌더러는 학습코드만 보낸다. 들어 볼 소리는 바이트로 받는다(CSP 를 넓히지 않게)
  guideVoice: (code: string): Promise<VoiceInfo> => ipcRenderer.invoke(IPC.guideVoice, code),
  guideVoiceSet: (code: string, target: string, gender: VoiceGender | null): Promise<VoiceDone> =>
    ipcRenderer.invoke(IPC.guideVoiceSet, code, target, gender),
  guideVoiceUse: (code: string, from: string): Promise<VoiceDone> => ipcRenderer.invoke(IPC.guideVoiceUse, code, from),
  guideVoiceKeep: (code: string): Promise<VoiceDone> => ipcRenderer.invoke(IPC.guideVoiceKeep, code),
  guideVoiceHear: (code: string, from: string): Promise<{ file: string; bytes: Uint8Array } | null> =>
    ipcRenderer.invoke(IPC.guideVoiceHear, code, from),
  /** 처음 설정 — 필요한가 · 작업 폴더 고르기(대화상자) · 점검표 다시 재기 · 브랜치 계획 · 설정 완료(진행 줄) · 마치기 */
  setupState: (): Promise<SetupState> => ipcRenderer.invoke(IPC.setupState),
  setupPickWork: (): Promise<WorkPick | null> => ipcRenderer.invoke(IPC.setupPickWork),
  setupRecheck: (): Promise<WorkPick | null> => ipcRenderer.invoke(IPC.setupRecheck),
  setupBranchPlan: (branch: string): Promise<BranchPlans> => ipcRenderer.invoke(IPC.setupBranchPlan, branch),
  /** `follow` — 원격에 같은 이름 브랜치가 있어 사람이 두 번 눌러 따라가기로 한 저장소 이름 */
  setupRun: (branch: string, follow: string[]): Promise<SetupRun> => ipcRenderer.invoke(IPC.setupRun, branch, follow),
  onSetupLine: (listener: (l: SetupLine) => void): (() => void) => {
    const wrapped = (_e: unknown, l: SetupLine): void => listener(l)
    ipcRenderer.on(IPC.setupEvent, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC.setupEvent, wrapped)
    }
  },
  setupFinish: (developer: string, devTeam: string): Promise<SetupResult> => ipcRenderer.invoke(IPC.setupFinish, developer, devTeam),
  setupOpenInstall: (name: string): Promise<void> => ipcRenderer.invoke(IPC.setupOpenInstall, name),
  /** git 사용자 이름 · 메일을 전역으로 — 못 하면 그 까닭(빈 글이면 됨) */
  setupGitIdentity: (name: string, email: string): Promise<string> => ipcRenderer.invoke(IPC.setupGitIdentity, name, email),
  ...benchApi
}
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (contextIsolation 미사용 시 폴백)
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

export type Api = typeof api
