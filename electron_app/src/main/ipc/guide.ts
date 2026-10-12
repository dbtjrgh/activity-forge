import { ipcMain } from 'electron'
import type { RscGuide, ThumbsResult, VoiceDone, VoiceInfo } from '../../shared/forge'
import { voiceSample } from '../services/forge/voicehear'
import { voiceInfo, voiceKeep, voiceSet, voiceUse } from '../services/forge/voiceset'
import { IPC } from '../../shared/ipc'
import { openGuide, setGuideTop } from '../guidewin'
import { toMessage } from '../lib/errors'
import { guideOriginDir, rscGuide } from '../services/forge/rscguide'
import { normalizeCode } from './answers'
import { isRscName, thumbsOf, THUMBS_MAX } from './shots'

/** 창에 그리는 원본 그림의 폭 — 격자 한 칸 · 크게 보기 */
const TILE_W = 200
const WIDE_W = 640

const NOT_CODE = '학습코드 형식이 올바르지 않습니다.'

/**
 * 받을 리소스 창 (2026-09-30) — **렌더러는 학습코드만 보낸다.** 원본 폴더는 메인이 배치표로 정한다 —
 * 렌더러가 준 경로의 그림을 읽지 않는다. 그림 이름은 `isRscName` 으로 원본 폴더 안인지 본다.
 * 창은 읽기만 하는데 **「대사 성우」 두 단추만 쓴다** (2026-10-02) — 성별을 스펙에 적고, 고른 완성본의 대사를 리소스 폴더로 복사한다(`voiceset.ts`).
 * 그때도 렌더러는 학습코드만 보낸다.
 */
export function registerGuideIpc(): void {
  ipcMain.handle(IPC.guideOpen, (_e, code: unknown): string => {
    const ok = normalizeCode(String(code ?? ''))
    if (!ok) return NOT_CODE
    openGuide(ok)
    return ''
  })
  ipcMain.handle(IPC.guideGet, async (_e, code: unknown): Promise<RscGuide> => {
    const ok = normalizeCode(String(code ?? ''))
    if (!ok) return { code: String(code ?? ''), module: '', origin: '', items: [], here: {}, dir: '', exists: false, error: NOT_CODE }
    return rscGuide(ok)
  })
  ipcMain.handle(IPC.guideThumbs, async (_e, code: unknown, rels: unknown, wide: unknown): Promise<ThumbsResult> => {
    const ok = normalizeCode(String(code ?? ''))
    if (!ok) return { thumbs: {}, truncated: false, error: NOT_CODE }
    if (!Array.isArray(rels)) return { thumbs: {}, truncated: false, error: '파일 목록을 읽지 못했습니다.' }
    const safe = rels.filter(isRscName)
    // 크게 보기는 한 장만
    const max = wide === true ? 1 : THUMBS_MAX
    try {
      const dir = await guideOriginDir(ok)
      if (!dir) return { thumbs: {}, truncated: false }
      return { thumbs: thumbsOf(dir, safe.slice(0, max), wide === true ? WIDE_W : TILE_W), truncated: safe.length > max }
    } catch (error) {
      return { thumbs: {}, truncated: false, error: toMessage(error) }
    }
  })
  ipcMain.handle(IPC.guideTop, (e, on: unknown): boolean => setGuideTop(e.sender, on === null ? null : on === true))

  // 대사 성우 (2026-10-02, `voiceset.ts`) — 학습코드 둘(이 학습코드 · 고른 완성본)만 받는다. 완성본인지는 서비스가 그 모듈 후보로 본다
  const voiceFail = (code: unknown): VoiceDone => ({
    ok: false,
    note: '',
    info: { code: String(code ?? ''), module: '', talk: [], gender: null, why: '', sets: [], have: 0, kept: false, error: NOT_CODE },
    error: NOT_CODE
  })
  ipcMain.handle(IPC.guideVoice, async (_e, code: unknown): Promise<VoiceInfo> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? voiceInfo(ok) : voiceFail(code).info
  })
  ipcMain.handle(IPC.guideVoiceSet, async (_e, code: unknown, target: unknown, gender: unknown): Promise<VoiceDone> => {
    const ok = normalizeCode(String(code ?? ''))
    const to = normalizeCode(String(target ?? ''))
    if (!ok || !to) return voiceFail(code)
    return voiceSet(ok, to, gender === '여' || gender === '남' ? gender : null)
  })
  ipcMain.handle(IPC.guideVoiceUse, async (_e, code: unknown, from: unknown): Promise<VoiceDone> => {
    const ok = normalizeCode(String(code ?? ''))
    const src = normalizeCode(String(from ?? ''))
    return ok && src ? voiceUse(ok, src) : voiceFail(code)
  })
  ipcMain.handle(IPC.guideVoiceKeep, async (_e, code: unknown): Promise<VoiceDone> => {
    const ok = normalizeCode(String(code ?? ''))
    return ok ? voiceKeep(ok) : voiceFail(code)
  })
  ipcMain.handle(IPC.guideVoiceHear, async (_e, code: unknown, from: unknown): Promise<{ file: string; bytes: Uint8Array } | null> => {
    const ok = normalizeCode(String(code ?? ''))
    const src = normalizeCode(String(from ?? ''))
    if (!ok || !src) return null
    const got = await voiceSample(ok, src)
    // 들어 볼 것 하나 — 대사 한 줄은 100KB 안팎이다. 큰 것은 안 보낸다
    return got && got.bytes.length <= 4 * 1024 * 1024 ? { file: got.file, bytes: new Uint8Array(got.bytes) } : null
  })
}
