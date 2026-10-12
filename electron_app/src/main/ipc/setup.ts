import { dialog, ipcMain, shell } from 'electron'
import type { SetupResult, WorkPick } from '../../shared/forge'
import { IPC } from '../../shared/ipc'
import { inspectWork, runSetup, setupState } from '../services/forge/setup'
import { installPage } from '../services/forge/setupchecks'

/**
 * **처음 설정** 채널 (2026-10-01) — 양산기 폴더를 못 찾으면 렌더러가 처음 설정 창을 띄운다.
 * 폴더는 사람이 대화상자로 고른다 — 렌더러가 경로를 적어 보내지 않는다. 설정이 끝나면 화면이 새로 읽는다 —
 * 앱을 다시 켤 필요는 없다: 못 찾은 양산기를 붙잡아 두지 않는다(`runtime.ts` · `forgeroot.ts`). 다시 켜면 dev 에서는 개발 서버까지 꺼진다
 */
let picked = ''

export function registerSetupIpc(): void {
  ipcMain.handle(IPC.setupState, () => setupState())

  ipcMain.handle(IPC.setupPickWork, async (): Promise<WorkPick | null> => {
    const got = await dialog.showOpenDialog({
      title: '작업 폴더 선택 (sparkon_m01 ~ sparkon_m11 이 들어 있는 폴더)',
      properties: ['openDirectory']
    })
    if (got.canceled || got.filePaths.length === 0) return null
    picked = got.filePaths[0] as string
    return inspectWork(picked)
  })

  // 경로는 받지 않는다 — 대화상자로 고른 것만 쓴다(신뢰 경계)
  ipcMain.handle(IPC.setupRun, (_e, developer: unknown, devTeam: unknown): Promise<SetupResult> | SetupResult => {
    if (!picked) return { ok: false, error: '작업 폴더를 먼저 선택하세요.' }
    return runSetup(picked, String(developer ?? '').slice(0, 80), String(devTeam ?? '').slice(0, 40))
  })

  // 주소도 받지 않는다 — 프로그램 이름만 받고 정해 둔 설치 페이지만 연다
  ipcMain.handle(IPC.setupOpenInstall, async (_e, name: unknown): Promise<void> => {
    const url = installPage(String(name ?? ''))
    if (url) await shell.openExternal(url)
  })
}
