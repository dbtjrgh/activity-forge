/**
 * **앱 안 창 채널** (2026-09-29, M6) — 만든 액티비티를 띄우는 창 · 그 창 콘솔에 모인 오류.
 *
 * 로직을 두지 않는다 — 주소가 내 컴퓨터의 dev 서버인지 · 학습코드 꼴인지만 보고 `main/preview.ts` 로 넘긴다.
 *
 * 2026-10-08 에 `ipc/canvas.ts` 에서 이름을 바꿨다. 비교 캔버스 · 창 찍기 · 「지금 화면 좌표 AI로 맞추기」 ·
 * 바깥 브라우저로 열기 채널을 이전 방식과 같이 걷어 앱 안 창 둘만 남았다. 되살리려면 fb5c0d4 를 본다.
 */

import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { localHttp } from '../lib/localurl'
import { openPreview, previewIssues } from '../preview'
import { normalizeCode } from './answers'

export function registerPreviewIpc(): void {
  ipcMain.handle(IPC.forgePreviewOpen, (_e, url: unknown, code: unknown): string => {
    const ok = localHttp(String(url ?? ''))
    if (!ok) return '이 컴퓨터의 dev 서버 주소만 열 수 있습니다.'
    const c = normalizeCode(String(code ?? ''))
    openPreview(ok, c ? `${c} 미리보기` : '미리보기')
    return ''
  })
  ipcMain.handle(IPC.forgePreviewIssues, (): { url: string; issues: string[] } => previewIssues())
}
