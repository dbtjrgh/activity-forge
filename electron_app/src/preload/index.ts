import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC, type FolderInfo, type FolderListResult, type FolderSize } from '../shared/ipc'
import type {
  SetupResult,
  SetupState,
  WorkPick,
  BoardKey,
  BoardList,
  Carried,
  RunRow,
  LayoutAsks,
  BoardResult,
  SpecRefresh,
  NewModules,
  UpdateCheck,
  Workspace,
  GateResult,
  HallStatus,
  RscWait,
  TeamSheet,
  TeamTally,
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
  /** 만든 사람 · 팀을 바꾼다 — 둘 다 적어야 받는다 */
  forgeSetMe: (developer: string, devTeam: string): Promise<Workspace> =>
    ipcRenderer.invoke(IPC.forgeSetMe, developer, devTeam),
  /** 스펙이 없는 모듈 — 열린 진행판마다 배치표가 정한 것 가운데 */
  forgeNewModules: (): Promise<NewModules> => ipcRenderer.invoke(IPC.forgeNewModules),
  /** 팀 일정표 갱신 — 렌더러는 아무것도 안 보낸다. 일정표 주소는 메인이 안다 */
  forgeTeamSheet: (): Promise<TeamSheet> => ipcRenderer.invoke(IPC.forgeTeamSheet),
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
  /** 처음 설정 — 필요한가 · 작업 폴더 고르기(대화상자) · 설정하고 다시 켜기 */
  setupState: (): Promise<SetupState> => ipcRenderer.invoke(IPC.setupState),
  setupPickWork: (): Promise<WorkPick | null> => ipcRenderer.invoke(IPC.setupPickWork),
  setupRun: (developer: string, devTeam: string): Promise<SetupResult> => ipcRenderer.invoke(IPC.setupRun, developer, devTeam),
  setupOpenInstall: (name: string): Promise<void> => ipcRenderer.invoke(IPC.setupOpenInstall, name),
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
