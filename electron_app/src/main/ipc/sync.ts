/**
 * **진행판 맨 위 — 「main 에 모두 올리기」 · 「리소스 폴더 정리」 채널** (2026-10-14). 둘 다 학습코드마다 있던 단추를 진행판 한 곳으로 모은 것이다.
 * `forge.ts`(진행판 · 작업 폴더)가 165줄이라 따로 둔다.
 *
 * 로직을 두지 않는다. 인자 검증과 전달만 한다 — 렌더러는 화면에 보인 열쇠(글자)만 보내고, 저장소 · 폴더 자리는 메인이 정한다.
 */

import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import type { RscCleanAll, RscCleanAllDone, SyncLine, SyncPlan, SyncResult } from '../../shared/forge'
import { syncPlan, syncRun } from '../services/forge/hallsyncall'
import { cleanRscAll, rscCleanAll } from '../services/forge/rsccleanall'

/** `c:<저장소>:<모듈 · 학습코드>` · `s:<저장소>:<40자 해시>` — 저장소 이름은 작업 폴더의 두 꼴만 */
const SYNC_KEY = /^(?:c:sparkon_(?:common|m\d\d):[A-Za-z0-9_\-./]{1,80}|s:sparkon_(?:common|m\d\d):[0-9a-f]{40})$/
/** `<학습코드>/<리소스 폴더 맨 위 이름>` — 이름에 경로 나눔 글자가 없어야 한다 */
const RSC_KEY = /^[A-Z]{2}L\d+M\d{2}W\d+S\d+\/[^/\\]+$/

const strings = (x: unknown, ok: RegExp, max: number): string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && ok.test(s) && !s.includes('..')).slice(0, max) : []

export function registerSyncIpc(): void {
  ipcMain.handle(IPC.forgeSyncPlan, (): Promise<SyncPlan> => syncPlan())
  // 도는 동안 진행 줄을 누른 창에만 민다 — 저장소마다 받기 · 푸시 · 타입 검사로 몇십 초 걸린다
  ipcMain.handle(IPC.forgeSyncRun, (event, shown: unknown): Promise<SyncResult> =>
    syncRun(strings(shown, SYNC_KEY, 2000), (l: SyncLine) => {
      if (!event.sender.isDestroyed()) event.sender.send(IPC.forgeSyncEvent, l)
    })
  )

  ipcMain.handle(IPC.forgeRscCleanAll, (): Promise<RscCleanAll> => rscCleanAll())
  ipcMain.handle(IPC.forgeRscCleanAllRun, (_e, shown: unknown): Promise<RscCleanAllDone> => cleanRscAll(strings(shown, RSC_KEY, 20000)))
}
