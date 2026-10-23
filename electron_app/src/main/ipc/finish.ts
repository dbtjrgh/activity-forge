/**
 * **띄워 보기 · 검수 완료 · 커밋 채널** — 작업대의 끝 단계가 부르는 것.
 *
 * `ipc/resource.ts` 가 383줄이 되어 갈랐다 (2026-09-18, 동작 변화 없음).
 * dev 서버를 올려 띄워 보고, 호 저장소에 검수 완료를 적고 커밋하는 채널이라 **남의 자리를
 * 건드리는 것**만 여기 모인다. 「저장소에 반영」(쓰기 점검 · 쓰기)은 2026-10-08 에 이전 방식과 같이 걷었다 —
 * 대화로 만들기는 Claude 가 호 저장소에 직접 쓴다(`ipc/chat.ts`).
 *
 * 로직을 두지 않는다. 인자 검증과 전달만 한다.
 */

import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import type { CodeReset, CommitResult, DoneResult, LeftoverTrash, LinkResult, PubExtra, ReproResult, Server, ViewCheck } from '../../shared/forge'
import { commitDone } from '../services/forge/hallcommit'
import { pubExtraOf, trashPubExtra } from '../services/forge/pubextra'
import { resetCode, resetPlan } from '../services/forge/reset'
import { linkFor } from '../services/forge/link'
import { markDone } from '../services/forge/done'
import { normalizeCode } from './answers'
import { repro } from '../services/forge/repro'
import { serverState, startServer, stopServer } from '../services/forge/view'
import { viewCheck } from '../services/forge/viewcheck'
import { badCode } from './respond'

export function registerFinishIpc(): void {
  // 미리보기 연결 — 사람이 누를 때만 건다(전역이라 다른 호의 미리보기가 같이 바뀐다)
  ipcMain.handle(IPC.forgeLink, async (_e, code: unknown): Promise<LinkResult> => {
    const ok = normalizeCode(String(code ?? ''))
    if (ok) return linkFor(ok)
    const error = badCode(code).error as string
    return { ok: false, out: '', error, check: { repo: '', activity: false, links: [], linkedMonth: '', sameMonth: false, command: '', blocked: error } }
  })

  ipcMain.handle(IPC.forgeViewCheck, (_e, code: unknown): Promise<ViewCheck> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok
      ? viewCheck(ok)
      : Promise.resolve({
          repo: '',
          activity: false,
          links: [],
          linkedMonth: '',
          sameMonth: false,
          command: '',
          blocked: badCode(code).error as string
        })
  })

  ipcMain.handle(IPC.forgeViewStart, (event, code: unknown): Promise<Server> => {
    const ok = normalizeCode(String(code ?? ''))
    if (!ok) return Promise.resolve({ ...serverState(), error: badCode(code).error as string })
    return startServer(ok, (line) => {
      if (!event.sender.isDestroyed()) event.sender.send(IPC.forgeViewLog, line)
    })
  })

  ipcMain.handle(IPC.forgeViewStop, (): Server => stopServer())

  // `force` — 남이 끝낸 학습코드를 작업대의 「그래도 고치기」로 푼 뒤에만 true 가 온다(`owner.ts`). true 가 아니면 다 false 로 본다
  ipcMain.handle(IPC.forgeDone, (_e, code: unknown, force: unknown): Promise<DoneResult> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? markDone(ok, force === true) : Promise.resolve({ ok: false, file: '', changed: [], note: '', error: badCode(code).error as string })
  })

  ipcMain.handle(IPC.forgeCommit, (_e, code: unknown, force: unknown): Promise<CommitResult> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? commitDone(ok, { force: force === true }) : Promise.resolve({ ok: false, done: [], error: badCode(code).error as string })
  })
  // main 에 올리기는 진행판의 「main 에 모두 올리기」가 한다(`ipc/sync.ts`, 2026-10-14) — 학습코드마다 올리던 채널은 걷었다

  // 안 쓰는 리소스 — 지울 것은 메인이 누른 때 다시 세고, 화면에 보인 목록(`shown`, 글자만 받는다)과 겹치는 것만 옮긴다
  ipcMain.handle(IPC.forgePubExtra, (_e, code: unknown): Promise<PubExtra> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? pubExtraOf(ok) : Promise.resolve({ files: [], error: badCode(code).error as string })
  })
  ipcMain.handle(IPC.forgePubExtraTrash, (_e, code: unknown, shown: unknown, force: unknown): Promise<LeftoverTrash> => {
    const ok = normalizeCode(String(code ?? ''))
    const rels = Array.isArray(shown) ? shown.filter((s): s is string => typeof s === 'string').slice(0, 5000) : []
    return ok ? trashPubExtra(ok, rels, force === true) : Promise.resolve({ moved: [], failed: [], error: badCode(code).error as string })
  })
  // 완료 뒤 리소스 폴더 정리는 진행판의 「리소스 폴더 정리」로 옮겼다(`ipc/sync.ts`, 2026-10-14)
  // 학습코드 초기화 — 같은 꼴(누른 때 다시 재고 화면에 보인 열쇠만)
  ipcMain.handle(IPC.forgeResetPlan, (_e, code: unknown, force: unknown): Promise<CodeReset> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? resetPlan(ok, force === true) : Promise.resolve({ rsc: null, recipe: [], hall: [], why: '', error: badCode(code).error as string })
  })
  ipcMain.handle(IPC.forgeReset, (_e, code: unknown, shown: unknown, force: unknown): Promise<LeftoverTrash> => {
    const ok = normalizeCode(String(code ?? ''))
    const keys = Array.isArray(shown) ? shown.filter((s): s is string => typeof s === 'string').slice(0, 5000) : []
    return ok ? resetCode(ok, keys, force === true) : Promise.resolve({ moved: [], failed: [], error: badCode(code).error as string })
  })

  ipcMain.handle(
    IPC.forgeRepro,
    (_e, subject: unknown, module: unknown): Promise<ReproResult> =>
      repro(String(subject ?? ''), String(module ?? ''))
  )
}
