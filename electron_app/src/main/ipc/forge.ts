import { app, dialog, ipcMain, nativeImage } from 'electron'
import { IPC } from '../../shared/ipc'
import type { BoardKey, Carried, LayoutAsks } from '../../shared/forge'
import { MODULE_PATH } from '../../shared/forge'
import { layoutAsks, pickModule } from '../services/forge/layoutasks'
import { board, closeBoard, listBoards, openIssue } from '../services/forge/board'
import { checkUpdate } from '../services/forge/refresh'
import { runUpdate } from '../services/forge/update'
import { getWorkspace, setForgeRoot, setMe, setRscRoot, setWorkspace } from '../services/forge/workspace'
import { newModules } from '../services/forge/newmodules'
import { normalizeCode } from './answers'
import { stopAllSessions } from '../services/forge/aisession'
import { runTable } from '../services/forge/runtable'

/**
 * 앱이 직접 만든 양산기 화면(진행판·작업 폴더)이 쓰는 채널.
 *
 * 경로 검증이 아니라 **과목·호 코드 검증**이 필요한 자리라 `folders.ts` 의
 * handlePathQuery 를 쓰지 않는다.
 *
 * 차례 줄(생성 대기열, M5)은 2026-10-08 에 걷었다 — 이전 방식의 만들기만 돌렸고, 대화는 사람에게 묻는다.
 */
export function registerForgeHandlers(): void {
  ipcMain.handle(IPC.forgeBoards, () => listBoards())
  // 배치표 파일 이름이 되는 값이라 과목 두 글자 · 호 두 자리만 받는다
  ipcMain.handle(IPC.forgeCloseBoard, (_e, key: Partial<BoardKey>) => {
    const subject = String(key?.subject ?? '')
    const issue = String(key?.issue ?? '')
    return /^[A-Z]{2}$/.test(subject) && /^\d\d$/.test(issue)
      ? closeBoard({ subject, issue })
      : listBoards().then((b) => ({ ...b, error: '과목과 호가 올바르지 않습니다.' }))
  })
  ipcMain.handle(IPC.forgeOpenIssue, (_e, issue: unknown) => {
    const i = String(issue ?? '')
    return /^\d\d$/.test(i) ? openIssue(i) : listBoards().then((b) => ({ ...b, error: '호가 올바르지 않습니다.' }))
  })
  ipcMain.handle(IPC.forgeWorkspace, () => getWorkspace())

  ipcMain.handle(IPC.forgeBoard, (_event, key: Partial<BoardKey>) => {
    // 이 값은 배치표 파일 이름(`EN07.json`)이 된다. 렌더러가 보낸 것을 그대로 쓰지 않고
    // 과목 두 글자 · 호 두 자리만 허용한다.
    const subject = String(key?.subject ?? '')
      .trim()
      .toUpperCase()
    const issue = String(key?.issue ?? '')
      .trim()
      .padStart(2, '0')

    if (!/^[A-Z]{2}$/.test(subject) || !/^[0-9]{2}$/.test(issue)) {
      return {
        subject,
        issue,
        rows: [],
        groups: [],
        skipped: { note: '', slots: [] },
        error: '과목은 영문 두 글자, 호는 두 자리 숫자여야 합니다.'
      }
    }
    return board({ subject, issue })
  })

  // 학습코드별 기록 표 — 과목 · 호를 진행판과 같은 꼴로만 받는다 (`runtable.ts`)
  ipcMain.handle(IPC.forgeRunTable, (_event, key: Partial<BoardKey>) => {
    const subject = String(key?.subject ?? '').trim().toUpperCase()
    const issue = String(key?.issue ?? '').trim().padStart(2, '0')
    return /^[A-Z]{2}$/.test(subject) && /^[0-9]{2}$/.test(issue) ? runTable(subject, issue) : Promise.resolve([])
  })

  // 배치표가 갈린 칸 한 장 (M7) — 붙인 기획서 쪽은 data URL 로
  ipcMain.handle(IPC.forgeLayoutAsks, async (_e, key: Partial<BoardKey>): Promise<LayoutAsks> => {
    const subject = String(key?.subject ?? '').toUpperCase()
    const issue = String(key?.issue ?? '')
    if (!/^[A-Z]{2}$/.test(subject) || !/^[0-9]{2}$/.test(issue)) return { subject, issue, rows: [], error: '과목과 호가 올바르지 않습니다.' }
    const got = await layoutAsks({ subject, issue })
    for (const r of got.rows) {
      if (!r.plan) continue
      const img = nativeImage.createFromPath(r.plan.image)
      r.plan.image = img.isEmpty() ? '' : img.toDataURL()
    }
    return got
  })

  // 그 칸의 모듈을 고른다 — 사람 답과 같은 길(`carry.ts`)로 배치표에. 까닭 없이는 안 받는다
  ipcMain.handle(IPC.forgeLayoutPick, async (_e, code: unknown, module: unknown, why: unknown): Promise<Carried> => {
    const ok = normalizeCode(String(code ?? ''))
    const m = String(module ?? '')
    const w = String(why ?? '').trim().slice(0, 500)
    if (!ok || !/^[A-Za-z0-9_+]+$/.test(m) || !w) return { path: MODULE_PATH, ok: false, file: '', note: '학습코드, 모듈, 이유를 모두 입력하세요.' }
    return pickModule(ok, m, w)
  })

  /**
   * 리소스를 놓을 자리 고르기. **호 저장소 안이 아니어도 된다** — 바탕화면에
   * 두고 시험해 보는 것이 이 칸의 쓸모다 (완성된 회차를 안 건드린다).
   */
  ipcMain.handle(IPC.forgePickRscRoot, async () => {
    const current = await getWorkspace()
    const picked = await dialog.showOpenDialog({
      title: '리소스 폴더 고르기 (아래에 학습코드 폴더가 생깁니다)',
      properties: ['openDirectory', 'createDirectory'],
      ...(current.rscRoot ? { defaultPath: current.rscRoot } : {})
    })
    if (picked.canceled || picked.filePaths.length === 0) return current
    return setRscRoot(picked.filePaths[0] as string)
  })

  // 빈 글이면 원래대로(호 저장소 안). 그 밖의 글은 서비스가 절대 경로인지 본다.
  ipcMain.handle(IPC.forgeSetRscRoot, (_event, dir: unknown) => setRscRoot(String(dir ?? '')))
  ipcMain.handle(IPC.forgeSetMe, (_e, developer: unknown, devTeam: unknown) =>
    setMe(String(developer ?? '').slice(0, 80), String(devTeam ?? '').slice(0, 40))
  )
  ipcMain.handle(IPC.forgeNewModules, () => newModules())

  /**
   * **양산기 폴더 고르기.** zip 으로 받은 앱이 스펙을 읽을 수 있게 하는 자리다 —
   * 저장소를 clone 한 뒤 그 안의 `forge` 를 고른다. 폴더가 맞는지는 서비스가 본다.
   */
  ipcMain.handle(IPC.forgePickForgeRoot, async () => {
    const current = await getWorkspace()
    const picked = await dialog.showOpenDialog({
      title: '양산기 폴더 고르기 (clone 한 저장소의 forge)',
      properties: ['openDirectory'],
      ...(current.forgeRoot ? { defaultPath: current.forgeRoot } : {})
    })
    if (picked.canceled || picked.filePaths.length === 0) return current
    return setForgeRoot(picked.filePaths[0] as string)
  })

  ipcMain.handle(IPC.forgeSetForgeRoot, (_event, dir: unknown) => setForgeRoot(String(dir ?? '')))

  // 인자가 없다 — 어느 저장소인지는 앱이 이미 찾아 둔 양산기 폴더로 정한다.
  // 렌더러가 경로를 보내게 하면 아무 저장소나 pull 하게 된다.
  // 앱 새 버전을 받았으면 잠깐 뒤 다시 켠다 — 그 사이 화면이 결과 줄을 보인다. 단일 실행 파일은 그 파일을 다시 연다
  ipcMain.handle(IPC.forgeRefreshSpecs, async () => {
    const r = await runUpdate()
    if (r.appChanged) {
      setTimeout(() => {
        app.relaunch({ execPath: process.env['PORTABLE_EXECUTABLE_FILE'] ?? process.execPath, args: process.argv.slice(1) })
        // app.exit 는 will-quit 을 안 낸다 — 도는 대화의 claude 를 여기서 내린다
        stopAllSessions()
        app.exit(0)
      }, 1500)
    }
    return r
  })
  ipcMain.handle(IPC.forgeUpdateCheck, () => checkUpdate())

  ipcMain.handle(IPC.forgePickWorkspace, async () => {
    const current = await getWorkspace()
    const picked = await dialog.showOpenDialog({
      title: '호 저장소(sparkon_mNN)가 있는 폴더 고르기',
      properties: ['openDirectory'],
      ...(current.dir ? { defaultPath: current.dir } : {})
    })
    if (picked.canceled || picked.filePaths.length === 0) return current
    return setWorkspace(picked.filePaths[0] as string)
  })
}
