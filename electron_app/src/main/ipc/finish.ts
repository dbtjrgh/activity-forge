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
import type { CommitResult, DoneResult, LeftoverTrash, LinkResult, PubExtra, ReproResult, RscClean, Server, ViewCheck } from '../../shared/forge'
import { commitDone, pushMain } from '../services/forge/hallcommit'
import { pubExtraOf, trashPubExtra } from '../services/forge/pubextra'
import { cleanRsc, rscCleanPlan } from '../services/forge/rscclean'
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

  ipcMain.handle(IPC.forgeDone, (_e, code: unknown): Promise<DoneResult> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? markDone(ok) : Promise.resolve({ ok: false, file: '', changed: [], note: '', error: badCode(code).error as string })
  })

  ipcMain.handle(IPC.forgeCommit, (_e, code: unknown): Promise<CommitResult> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? commitDone(ok) : Promise.resolve({ ok: false, done: [], error: badCode(code).error as string })
  })
  // main 에 올리기는 커밋과 따로 누른다 (2026-10-02)
  // `allow` — 사람이 보고 같이 올리기로 한 다른 커밋(40자 해시만 받는다). 서비스가 누른 때 다시 재 본다
  ipcMain.handle(IPC.forgePushMain, (_e, code: unknown, allow: unknown): Promise<CommitResult> => {
    const ok = normalizeCode(String(code ?? ''))
    const shas = Array.isArray(allow) ? allow.filter((s): s is string => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s)).slice(0, 200) : []
    return ok ? pushMain(ok, shas) : Promise.resolve({ ok: false, done: [], error: badCode(code).error as string })
  })

  // 안 쓰는 리소스 — 지울 것은 메인이 누른 때 다시 세고, 화면에 보인 목록(`shown`, 글자만 받는다)과 겹치는 것만 옮긴다
  ipcMain.handle(IPC.forgePubExtra, (_e, code: unknown): Promise<PubExtra> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? pubExtraOf(ok) : Promise.resolve({ files: [], error: badCode(code).error as string })
  })
  ipcMain.handle(IPC.forgePubExtraTrash, (_e, code: unknown, shown: unknown): Promise<LeftoverTrash> => {
    const ok = normalizeCode(String(code ?? ''))
    const rels = Array.isArray(shown) ? shown.filter((s): s is string => typeof s === 'string').slice(0, 5000) : []
    return ok ? trashPubExtra(ok, rels) : Promise.resolve({ moved: [], failed: [], error: badCode(code).error as string })
  })
  // 완료 뒤 리소스 폴더 정리 — 같은 꼴(누른 때 다시 재고 화면에 보인 항목만)
  ipcMain.handle(IPC.forgeRscCleanPlan, (_e, code: unknown): Promise<RscClean> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? rscCleanPlan(ok) : Promise.resolve({ dir: '', finished: false, entries: [], why: '', error: badCode(code).error as string })
  })
  ipcMain.handle(IPC.forgeRscClean, (_e, code: unknown, shown: unknown): Promise<LeftoverTrash> => {
    const ok = normalizeCode(String(code ?? ''))
    const names = Array.isArray(shown) ? shown.filter((s): s is string => typeof s === 'string').slice(0, 5000) : []
    return ok ? cleanRsc(ok, names) : Promise.resolve({ moved: [], failed: [], error: badCode(code).error as string })
  })

  ipcMain.handle(
    IPC.forgeRepro,
    (_e, subject: unknown, module: unknown): Promise<ReproResult> =>
      repro(String(subject ?? ''), String(module ?? ''))
  )
}
