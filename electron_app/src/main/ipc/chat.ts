/**
 * 작업대의 **대화로 만들기** 채널 (2026-10-08, `services/forge/chat.ts`).
 *
 * 렌더러는 학습코드 · 답 글 · 붙인 그림 바이트만 보낸다. 경로는 메인이 정한다. 형편이 바뀔 때마다 모든 창에 민다
 * (작업대를 떠났다 와도 이어 보인다). **로직을 두지 않는다.**
 */

import { BrowserWindow, ipcMain } from 'electron'
import type { ChatInfo } from '../../shared/forge'
import { IPC } from '../../shared/ipc'
import { chatClear, chatInfo, chatReply, chatStart, chatStop } from '../services/forge/chat'
import { onChat } from '../services/forge/chatstore'
import { normalizeCode } from './answers'

/** 붙인 그림 상한 — 한 번에 넉 장, 장마다 8MB */
const IMAGES_MAX = 4
const IMAGE_BYTES = 8 * 1024 * 1024
/** 답 글 상한 */
const TEXT_MAX = 20_000

const bad = (code: unknown): ChatInfo => ({
  code: String(code ?? ''),
  state: 'error',
  sessionId: null,
  turns: [],
  questions: [],
  progress: [],
  checks: { tsc: null, spec: null, files: null },
  cost: 0,
  since: null,
  rev: 0,
  error: '학습코드 형식이 아닙니다.'
})

export function registerChatIpc(): void {
  onChat((info) => {
    for (const w of BrowserWindow.getAllWindows()) if (!w.webContents.isDestroyed()) w.webContents.send(IPC.forgeChatEvent, info)
  })
  ipcMain.handle(IPC.forgeChatGet, async (_e, code: unknown) => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? chatInfo(ok) : bad(code)
  })
  ipcMain.handle(IPC.forgeChatStart, async (_e, code: unknown) => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? chatStart(ok) : bad(code)
  })
  ipcMain.handle(IPC.forgeChatReply, async (_e, code: unknown, text: unknown, images: unknown) => {
    const ok = normalizeCode(String(code ?? ''))
    if (!ok) return bad(code)
    const pics = (Array.isArray(images) ? images : [])
      .filter((b): b is Uint8Array => b instanceof Uint8Array && b.length > 0 && b.length <= IMAGE_BYTES)
      .slice(0, IMAGES_MAX)
    return chatReply(ok, String(text ?? '').slice(0, TEXT_MAX), pics)
  })
  ipcMain.handle(IPC.forgeChatStop, async (_e, code: unknown) => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? chatStop(ok) : bad(code)
  })
  ipcMain.handle(IPC.forgeChatClear, async (_e, code: unknown) => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? chatClear(ok) : bad(code)
  })
}
