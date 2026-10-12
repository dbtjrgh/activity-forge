/**
 * 렌더러에 노출하는 API 가운데 **작업대(학습코드 하나)** 몫 — `index.ts` 가 241줄이 되어 갈랐다 (2026-09-30, 동작 변화 없음).
 * `index.ts` 가 앞 몫과 합쳐 `window.api` 로 내보낸다. 채널 이름은 `shared/ipc.ts` 의 `IPC` 만 쓴다.
 * 이전 방식(보기 · 만들기 · 답 · AI 에게 맡기기 · 맞추기 · 반영 · 좌표 맞추기 · 걸음 소식)은 2026-10-08 에 걷었다.
 */
import { IPC } from '../shared/ipc'
import type {
  ChatInfo,
  CommitResult,
  DoneResult,
  InboxResult,
  SortedInbox,
  Prepare,
  ReproResult,
  Server,
  ShotResult,
  ShotsResult,
  ThumbsResult,
  LeftoverTrash,
  OriginChoices,
  ViewCheck,
  LinkResult
} from '../shared/forge'
import { ipcRenderer, webUtils } from 'electron'

export const benchApi = {
  /** 그 학습코드의 리소스 폴더를 만들고 탐색기로 연다 — 누를 때만 만든다 */
  forgeResourceDir: (code: string): Promise<{ ok: true; dir: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke(IPC.forgeResourceDir, code),
  /** 리소스 화면이 처음 보여 줄 것 — 모듈·원본·리소스 폴더·모자란 것·쓰기 권한 */
  forgePrepare: (code: string): Promise<Prepare> => ipcRenderer.invoke(IPC.forgePrepare, code),
  /**
   * 클립보드의 그림을 그 차시의 figma 화면으로 넣는다 (Ctrl+V).
   * 그림이 아니면 아무것도 안 하고 까닭만 온다.
   */
  forgePasteShot: (code: string, kind: 'figma' | 'plan' = 'figma'): Promise<ShotResult> =>
    ipcRenderer.invoke(IPC.forgePasteShot, code, kind),

  /** 끌어다 놓은 기획서 파일을 넣는다 — 자리는 `pathForFile` 로 얻는다 */
  forgeAddShotFile: (
    code: string,
    from: string,
    kind: 'figma' | 'plan' = 'plan'
  ): Promise<ShotResult> => ipcRenderer.invoke(IPC.forgeAddShotFile, code, from, kind),
  /** 붙여넣은 화면 전부 — 미리보기와 원본 크기까지 */
  forgeShots: (code: string, kind: 'figma' | 'plan' = 'figma'): Promise<ShotsResult> =>
    ipcRenderer.invoke(IPC.forgeShots, code, kind),
  /** 리소스 폴더 안 그림의 작은 썸네일 — 한 번에 받는 장 수에 상한이 있다 */
  forgeThumbs: (code: string, files: string[]): Promise<ThumbsResult> => ipcRenderer.invoke(IPC.forgeThumbs, code, files),
  forgeOriginChoices: (code: string): Promise<OriginChoices> => ipcRenderer.invoke(IPC.forgeOriginChoices, code),
  forgeOriginPick: (code: string, origin: string | null): Promise<OriginChoices> =>
    ipcRenderer.invoke(IPC.forgeOriginPick, code, origin),
  forgeLeftoverTrash: (code: string): Promise<LeftoverTrash> => ipcRenderer.invoke(IPC.forgeLeftoverTrash, code),
  /** 그 화면 **한 장**을 지운다 */
  forgeDropShot: (
    code: string,
    file: string,
    kind: 'figma' | 'plan' = 'figma'
  ): Promise<ShotResult> => ipcRenderer.invoke(IPC.forgeDropShot, code, file, kind),
  /** 그 화면을 한 칸 앞(-1) · 뒤(+1)로 — 붙인 차례가 이닝 차례다 */
  forgeMoveShot: (code: string, file: string, step: -1 | 1, kind: 'figma' | 'plan' = 'figma'): Promise<ShotResult> =>
    ipcRenderer.invoke(IPC.forgeMoveShot, code, file, step, kind),
  /** 그 화면을 **모두** 지운다 */
  forgeClearShot: (code: string, kind: 'figma' | 'plan' = 'figma'): Promise<ShotResult> =>
    ipcRenderer.invoke(IPC.forgeClearShot, code, kind),
  /**
   * 끌어다 놓은 것의 **실제 자리**.
   *
   * **Electron 32 부터 `File.path` 가 없다.** 렌더러에서 읽으면 `undefined`
   * 인데 오류는 안 나서, 빈 배열을 보내 놓고 「아무것도 안 들어갔다」가 된다.
   * 이 자리(preload)에서만 얻을 수 있다.
   */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  /** 놓은 것을 그 차시의 리소스 폴더에 넣는다 (4단계) */
  forgeInbox: (code: string, drops: string[], overwrite: boolean): Promise<InboxResult> =>
    ipcRenderer.invoke(IPC.forgeInbox, code, drops, overwrite),
  /**
   * **차시를 안 정하고 통째로 놓는다** — 도구가 학습코드를 가려 나눈다
   * (2026-09-16). 놓는 자리를 한 곳으로 하자는 결정을 잇는 자리다.
   */
  forgeSort: (drops: string[], overwrite: boolean): Promise<SortedInbox> =>
    ipcRenderer.invoke(IPC.forgeSort, drops, overwrite),
  /** 대화로 만들기 (2026-10-08) — 형편 · 새로 시작 · 사람의 답(글 · 붙인 그림) · 멈추기 · 메인이 미는 소식 */
  forgeChatGet: (code: string): Promise<ChatInfo> => ipcRenderer.invoke(IPC.forgeChatGet, code),
  forgeChatStart: (code: string): Promise<ChatInfo> => ipcRenderer.invoke(IPC.forgeChatStart, code),
  forgeChatReply: (code: string, text: string, images: Uint8Array[]): Promise<ChatInfo> =>
    ipcRenderer.invoke(IPC.forgeChatReply, code, text, images),
  forgeChatStop: (code: string): Promise<ChatInfo> => ipcRenderer.invoke(IPC.forgeChatStop, code),
  forgeChatClear: (code: string): Promise<ChatInfo> => ipcRenderer.invoke(IPC.forgeChatClear, code),
  onForgeChat: (listener: (info: ChatInfo) => void): (() => void) => {
    const wrapped = (_e: unknown, info: ChatInfo): void => listener(info)
    ipcRenderer.on(IPC.forgeChatEvent, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC.forgeChatEvent, wrapped)
    }
  },
  /** 띄우기 전 점검 — 정션이 걸렸나, 지금 어느 호가 걸려 있나 */
  forgeViewCheck: (code: string): Promise<ViewCheck> => ipcRenderer.invoke(IPC.forgeViewCheck, code),
  forgeLink: (code: string): Promise<LinkResult> => ipcRenderer.invoke(IPC.forgeLink, code),
  /** 호 저장소의 dev 서버를 띄운다. 뜨면 주소를 준다 */
  forgeViewStart: (code: string): Promise<Server> => ipcRenderer.invoke(IPC.forgeViewStart, code),
  /** 그 모듈 하나에만 재현 검사를 돌린다 (십수 초) */
  forgeRepro: (subject: string, module: string): Promise<ReproResult> =>
    ipcRenderer.invoke(IPC.forgeRepro, subject, module),
  /** 그 서버를 내린다 */
  forgeViewStop: (): Promise<Server> => ipcRenderer.invoke(IPC.forgeViewStop),
  /** 「끝」 — 개발 끝으로 적는다 (M7) */
  forgeDone: (code: string): Promise<DoneResult> => ipcRenderer.invoke(IPC.forgeDone, code),
  forgeCommit: (code: string): Promise<CommitResult> => ipcRenderer.invoke(IPC.forgeCommit, code),
  forgePushMain: (code: string, allow: string[] = []): Promise<CommitResult> => ipcRenderer.invoke(IPC.forgePushMain, code, allow),
  /**
   * 서버가 뱉는 줄. **끊는 함수를 돌려준다** — 컴포넌트가 사라질 때 안 끊으면 리스너가 쌓여 두 번 그린다.
   *
   * `listener` 를 그대로 넘기지 않고 감싸는 까닭 — `ipcRenderer.on` 의 첫
   * 인자는 `IpcRendererEvent` 이고, 그것은 `sender` 를 통해 렌더러에 메인
   * 프로세스 객체를 흘린다. contextBridge 를 세워 둔 뜻이 없어진다.
   */
  onForgeViewLog: (listener: (line: string) => void): (() => void) => {
    const wrapped = (_e: unknown, line: string): void => listener(line)
    ipcRenderer.on(IPC.forgeViewLog, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC.forgeViewLog, wrapped)
    }
  }
}
