/**
 * 작업대 채널 — 진행판에서 학습코드를 누르면 열리는 화면이 부르는 것.
 * 처음 보여 줄 것 · 리소스 폴더 · 호 저장소 폴더 열기 · 놓은 것 넣기 · 원본 변경.
 *
 * 결과는 `unknown` 이 아니라 `shared/forge.ts` 의 타입이다 — 앱 화면은
 * 렌더러도 타입을 보므로 갈라지면 컴파일에서 걸린다(옛 양산 창의 `unknown` 채널은 M8 에 걷었다).
 * 이전 방식의 보기 · 만들기 · 도는 판 · 답 · AI 에게 맡기기 · 맞추기 채널은 2026-10-08 에 걷었다 — 만들기는 `ipc/chat.ts` 다.
 *
 * 로직을 두지 않는다. 인자 검증과 전달만 한다.
 */

import { isAbsolute } from 'node:path'
import { ipcMain, shell } from 'electron'
import { IPC } from '../../shared/ipc'
import type { FolderOpen, InboxResult, LeftoverTrash, OriginChoices, PageNeeds, PlanModule, Prepare, ShareLook, ShareTake, SortedInbox } from '../../shared/forge'
import { pageNeedsOf } from '../services/forge/chatpages'
import { hallFolder } from '../services/forge/hallfolder'
import { takeInbox } from '../services/forge/inbox'
import { planModuleFor, usePlanModule } from '../services/forge/planmodule'
import { sortPlans } from '../services/forge/sortplan'
import { prepare } from '../services/forge/prepare'
import { shareLook, shareTake } from '../services/forge/sharefetch'
import { makeRscDir } from '../services/forge/workspace'
import { originChoices, pickOrigin, trashOldOrigin } from '../services/forge/originpick'
import { normalizeCode } from './answers'
import { badCode, badInbox, badShare, badSort } from './respond'

const noOrigin = (code: unknown): OriginChoices => ({
  code: String(code ?? ''),
  module: '',
  now: '',
  first: '',
  pinned: '',
  changed: false,
  choices: [],
  running: false,
  scene: null,
  leftover: [],
  error: '학습코드 형식이 올바르지 않습니다.'
})

/** 한 번에 놓을 수 있는 것의 수. 폴더 안까지의 상한은 `inbox.ts` 가 따로 본다. */
const DROP_MAX = 500

export function registerResourceIpc(): void {
  ipcMain.handle(IPC.forgePrepare, (_e, code: unknown): Promise<Prepare> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? prepare(ok) : Promise.resolve(badCode(code))
  })

  ipcMain.handle(IPC.forgeResourceDir, (_e, code: unknown): Promise<FolderOpen> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? makeRscDir(ok) : Promise.resolve({ ok: false, error: badCode(code).error ?? '' })
  })

  // 렌더러는 학습코드와 어느 폴더인지만 보낸다 — 경로는 메인이 정한다(`hallfolder.ts`)
  ipcMain.handle(IPC.forgeHallFolder, async (_e, code: unknown, kind: unknown): Promise<FolderOpen> => {
    const ok = normalizeCode(String(code ?? ''))
    if (!ok) return { ok: false, error: badCode(code).error ?? '' }
    if (kind !== 'activity' && kind !== 'public') return { ok: false, error: '열 폴더를 알 수 없습니다.' }
    const found = await hallFolder(ok, kind)
    if (!found.ok) return found
    const why = await shell.openPath(found.dir)
    return why ? { ok: false, error: `폴더를 열지 못했습니다: ${why}` } : found
  })

  /**
   * **끌어다 놓은 것을 리소스 폴더에 넣는다** (4단계).
   *
   * 렌더러가 보내는 것은 `webUtils.getPathForFile` 로 얻은 **절대 경로**다.
   * 신뢰 경계 검사는 여기 한 곳에서 한다 — 절대 경로가 아니거나 상한을
   * 넘는 것은 서비스까지 보내지 않는다.
   */
  ipcMain.handle(
    IPC.forgeInbox,
    (_e, code: unknown, drops: unknown, overwrite: unknown): Promise<InboxResult> => {
      const ok = normalizeCode(String(code ?? ''))
      if (!ok) return Promise.resolve(badInbox(badCode(code).error as string))
      if (!Array.isArray(drops)) return Promise.resolve(badInbox('넣은 파일을 읽지 못했습니다.'))
      if (drops.length > DROP_MAX) {
        return Promise.resolve(badInbox(`한 번에 ${DROP_MAX}개까지만 넣을 수 있습니다.`))
      }
      const paths = drops.map((d) => String(d ?? '')).filter((d) => d && isAbsolute(d))
      if (!paths.length) return Promise.resolve(badInbox('넣은 파일의 경로를 읽지 못했습니다.'))
      // **`=== true` 로 본다.** 덮어쓰기는 남의 파일을 지우는 것과 같다.
      return takeInbox(ok, paths, overwrite === true)
    }
  )

  /**
   * **진행판에 기획서를 놓는다** (2026-09-16, 2026-10-26 부터 기획서 PDF 만).
   *
   * 위와 같은 검사를 하되 학습코드를 안 받는다 — 어느 학습코드 것인지는 `sortplan.ts` 가 1쪽을 읽어 가린다.
   */
  ipcMain.handle(
    IPC.forgeSort,
    (_e, drops: unknown, overwrite: unknown): Promise<SortedInbox> => {
      if (!Array.isArray(drops)) return Promise.resolve(badSort('넣은 파일을 읽지 못했습니다.'))
      if (drops.length > DROP_MAX) {
        return Promise.resolve(badSort(`한 번에 ${DROP_MAX}개까지만 넣을 수 있습니다.`))
      }
      const paths = drops.map((d) => String(d ?? '')).filter((d) => d && isAbsolute(d))
      if (!paths.length) return Promise.resolve(badSort('넣은 파일의 경로를 읽지 못했습니다.'))
      return sortPlans(paths, overwrite === true)
    }
  )

  // 원본 바꾸기 — 후보는 서비스가 forge 로 센다. 받는 원본은 학습코드 꼴만 보고, 후보인지는 서비스가 본다. null 은 「처음 추천으로」
  // 인터북 그림에서 아직 없는 판 — 작업대와 받을 리소스 창이 같이 부른다
  ipcMain.handle(IPC.forgePageNeeds, (_e, code: unknown): Promise<PageNeeds> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? pageNeedsOf(ok) : Promise.resolve({ stars: 0, needs: [], same: [], error: badCode(code).error as string })
  })
  // 사내 공유 폴더 — 렌더러는 학습코드와 화면에 보였던 자리(리소스 폴더 안 상대 길)만 보낸다. 무엇을 어디서 가져올지는 서비스가 다시 찾는다
  // `fresh` — 공유 폴더 연결을 다시 묻는다(「다시 확인」). 아니면 메인이 들고 있는 연결 형편을 쓴다
  ipcMain.handle(IPC.forgeShareLook, (_e, code: unknown, fresh: unknown): Promise<ShareLook> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? shareLook(ok, fresh === true) : Promise.resolve(badShare(code).look)
  })
  ipcMain.handle(IPC.forgeShareTake, (_e, code: unknown, shown: unknown): Promise<ShareTake> => {
    const ok = normalizeCode(String(code ?? ''))
    if (!ok) return Promise.resolve(badShare(code))
    if (!Array.isArray(shown) || shown.length > DROP_MAX * 4) return Promise.resolve(badShare(code, '가져올 목록을 읽지 못했습니다.'))
    return shareTake(ok, shown.map((s) => String(s ?? '')).filter(Boolean))
  })
  ipcMain.handle(IPC.forgeOriginChoices, (_e, code: unknown): Promise<OriginChoices> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? originChoices(ok) : Promise.resolve(noOrigin(code))
  })
  ipcMain.handle(IPC.forgeOriginPick, (_e, code: unknown, origin: unknown): Promise<OriginChoices> => {
    const ok = normalizeCode(String(code ?? ''))
    const to = origin === null ? null : normalizeCode(String(origin ?? ''))
    if (!ok || (origin !== null && !to)) return Promise.resolve(noOrigin(code))
    return pickOrigin(ok, to)
  })
  ipcMain.handle(IPC.forgeLeftoverTrash, (_e, code: unknown): Promise<LeftoverTrash> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? trashOldOrigin(ok) : Promise.resolve({ moved: [], failed: [], error: badCode(code).error as string })
  })
  // 기획서 모듈넘버와 배치표 — 바꿀 때도 학습코드만 받는다. 무엇으로 바꿀지는 서비스가 기획서를 다시 읽어 정한다
  const noPlan = (code: unknown): PlanModule => ({ code: String(code ?? ''), planModule: '', plan: '', layoutModule: '', differs: false, note: '', error: badCode(code).error as string })
  ipcMain.handle(IPC.forgePlanModule, (_e, code: unknown): Promise<PlanModule> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? planModuleFor(ok) : Promise.resolve(noPlan(code))
  })
  ipcMain.handle(IPC.forgePlanModuleUse, (_e, code: unknown): Promise<PlanModule> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? usePlanModule(ok) : Promise.resolve(noPlan(code))
  })
}
