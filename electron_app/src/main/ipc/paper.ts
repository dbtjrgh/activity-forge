/**
 * 작업대의 **붙이는 것** 채널 — figma 화면 · 기획서 · 썸네일 (2026-09-29, M4 에 `resource.ts` 에서 뗌).
 *
 * `resource.ts` 가 264줄이 되어 갈랐다. 옮긴 채널은 동작 변화 없음 — 붙일 때 1x 판정(`oneX`)과
 * 썸네일 채널(`forgeThumbs`)만 새로 붙었다.
 *
 * 로직을 두지 않는다. 인자 검증과 전달만 한다. 그리는 것(nativeImage)은 `ipc/shots.ts` 에 있다.
 */

import { isAbsolute } from 'node:path'
import { clipboard, ipcMain, nativeImage } from 'electron'
import { IPC } from '../../shared/ipc'
import type { ShotResult, ShotsResult, ThumbsResult } from '../../shared/forge'
import { addShotFile, dropOneShot, dropShot, plansOf, putShot, rscOf, shotsOf } from '../services/forge/shot'
import { isPaper } from '../services/forge/pasted'
import { movePaper } from '../services/forge/papermove'
import { normalizeCode } from './answers'
import { toMessage } from '../lib/errors'
import { hasDir, isRscName, isShotName, oneX, shotsWithThumbs, thumbsOf, THUMBS_MAX } from './shots'
import { badCode } from './respond'

export function registerPaperIpc(): void {
  /**
   * **붙여넣기로 figma 화면을 받는다** (Ctrl+V).
   *
   * 클립보드를 읽는 것은 Electron 이라 여기서 하고, 파일로 쓰는 것은
   * 서비스가 한다(services 는 Electron 을 모른다). 그림이 아니면 **아무것도
   * 하지 않고 그렇다고 말한다** — 글을 붙여넣었을 때 빈 파일을 만들지 않는다.
   */
  ipcMain.handle(
    IPC.forgePasteShot,
    async (_e, code: unknown, kind: unknown = 'figma'): Promise<ShotResult> => {
      const ok = normalizeCode(String(code ?? ''))
      if (!ok) return { file: '', note: '', error: badCode(code).error as string }
      if (!isPaper(kind)) return { file: '', note: '', error: '알 수 없는 종류입니다.' }
      const png = await clipboardImage()
      if (!png) {
        return { file: '', note: '', error: '클립보드에 그림이 없습니다. 화면을 복사한 뒤 붙이세요.' }
      }
      // figma 화면만 1x 를 가른다 — 기획서 캡처는 글을 읽는 것이라 크기가 상관없다
      if (kind !== 'figma') return putShot(ok, png, kind)
      const one = oneX(png)
      if ('error' in one) return { file: '', note: '', error: one.error }
      return putShot(ok, one.png, kind, '.png', one.original)
    }
  )

  /**
   * **끌어다 놓은 기획서 파일을 넣는다** (PDF 가 이 길로 온다).
   *
   * 렌더러가 보내는 것은 `webUtils.getPathForFile` 로 얻은 **절대 경로**다 —
   * 끌어다 놓은 파일의 자리는 `File.path` 로 못 얻는다(저장소 함정).
   * 절대 경로인지는 여기서 보고, 받는 확장자인지는 서비스가 다시 본다.
   */
  ipcMain.handle(
    IPC.forgeAddShotFile,
    (_e, code: unknown, from: unknown, kind: unknown = 'plan'): Promise<ShotResult> => {
      const ok = normalizeCode(String(code ?? ''))
      if (!ok) return Promise.resolve({ file: '', note: '', error: badCode(code).error as string })
      if (!isPaper(kind)) return Promise.resolve({ file: '', note: '', error: '알 수 없는 종류입니다.' })
      const at = String(from ?? '')
      if (!isAbsolute(at)) {
        return Promise.resolve({ file: '', note: '', error: '파일 경로를 읽지 못했습니다.' })
      }
      return addShotFile(ok, at, kind)
    }
  )

  /**
   * **붙여넣은 화면을 미리보기까지 붙여 돌려준다.**
   *
   * 「잘 붙여넣었나」를 글이 아니라 그림으로 보게 하려는 것이다 — 엉뚱한
   * 것을 붙여도 글은 똑같이 「받았습니다」로 보인다.
   */
  ipcMain.handle(
    IPC.forgeShots,
    async (_e, code: unknown, kind: unknown = 'figma'): Promise<ShotsResult> => {
      const ok = normalizeCode(String(code ?? ''))
      if (!ok) return { shots: [], error: badCode(code).error as string }
      if (!isPaper(kind)) return { shots: [], error: '알 수 없는 종류입니다.' }
      try {
        const dir = await rscOf(ok)
        if (!hasDir(dir)) return { shots: [] }
        return { shots: shotsWithThumbs(dir, kind === 'plan' ? plansOf(dir) : shotsOf(dir)) }
      } catch (error) {
        return { shots: [], error: toMessage(error) }
      }
    }
  )

  /**
   * **리소스 폴더 안 그림의 썸네일** (M4) — 고르기 후보 · 리소스 목록이 이름만으로는 무엇인지 모른다.
   *
   * `files` 는 렌더러에서 온 글이라 **리소스 폴더 안의 상대 경로인지** 여기서 본다(`isRscName`).
   * 한 번에 `THUMBS_MAX` 장까지 — 넘는 것은 그리지 않고 `truncated` 로 알린다.
   */
  ipcMain.handle(IPC.forgeThumbs, async (_e, code: unknown, files: unknown): Promise<ThumbsResult> => {
    const ok = normalizeCode(String(code ?? ''))
    if (!ok) return { thumbs: {}, truncated: false, error: badCode(code).error as string }
    if (!Array.isArray(files)) return { thumbs: {}, truncated: false, error: '파일 목록을 읽지 못했습니다.' }
    const safe = files.filter(isRscName)
    try {
      const dir = await rscOf(ok)
      if (!hasDir(dir)) return { thumbs: {}, truncated: false }
      return { thumbs: thumbsOf(dir, safe.slice(0, THUMBS_MAX)), truncated: safe.length > THUMBS_MAX }
    } catch (error) {
      return { thumbs: {}, truncated: false, error: toMessage(error) }
    }
  })

  /**
   * 화면 **한 장**만 지운다.
   *
   * `file` 은 렌더러에서 온 글이다 — **파일을 지우러 가는 길**이라 여기서
   * 꼴을 먼저 본다(`isShotName`). 서비스 쪽에서 목록에 있는지 한 번 더 본다.
   */
  ipcMain.handle(
    IPC.forgeDropShot,
    (_e, code: unknown, file: unknown, kind: unknown = 'figma'): Promise<ShotResult> => {
      const ok = normalizeCode(String(code ?? ''))
      if (!ok) return Promise.resolve({ file: '', note: '', error: badCode(code).error as string })
      if (!isPaper(kind)) return Promise.resolve({ file: '', note: '', error: '알 수 없는 종류입니다.' })
      if (!isShotName(file)) {
        return Promise.resolve({ file: '', note: '', error: '지울 수 없는 파일입니다.' })
      }
      return dropOneShot(ok, file, kind)
    }
  )

  // 붙인 차례 바꾸기 — figma 화면은 붙인 차례가 이닝 차례다 (`papermove.ts`)
  ipcMain.handle(
    IPC.forgeMoveShot,
    (_e, code: unknown, file: unknown, step: unknown, kind: unknown = 'figma'): Promise<ShotResult> => {
      const ok = normalizeCode(String(code ?? ''))
      if (!ok) return Promise.resolve({ file: '', note: '', error: badCode(code).error as string })
      if (!isPaper(kind) || (step !== -1 && step !== 1)) return Promise.resolve({ file: '', note: '', error: '알 수 없는 요청입니다.' })
      if (!isShotName(file)) return Promise.resolve({ file: '', note: '', error: '옮길 수 없는 파일입니다.' })
      return movePaper(ok, file, step, kind)
    }
  )

  ipcMain.handle(
    IPC.forgeClearShot,
    (_e, code: unknown, kind: unknown = 'figma'): Promise<ShotResult> => {
      const ok = normalizeCode(String(code ?? ''))
      if (!ok) return Promise.resolve({ file: '', note: '', error: badCode(code).error as string })
      if (!isPaper(kind)) return Promise.resolve({ file: '', note: '', error: '알 수 없는 종류입니다.' })
      return dropShot(ok, kind)
    }
  )
}

/**
 * 클립보드에 든 그림을 PNG 바이트로. 그림이 없으면 null.
 *
 * **Electron 44 의 클립보드는 W3C 꼴이다** — 예전 `readImage()` 는 없고
 * `read()` 가 `ClipboardItem` 목록을 준다. 캡처 도구마다 내놓는 갈래가 달라
 * (`image/png`·`image/bmp`…) **가장 먼저 잡히는 그림 갈래**를 받는다.
 */
async function clipboardImage(): Promise<Buffer | null> {
  const items = await clipboard.read()
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (!type) continue
    const got = await item.getType(type)
    if (!(got instanceof Blob)) continue
    const bytes = Buffer.from(await got.arrayBuffer())
    // **PNG 로 맞춰 둔다.** 캡처 도구가 bmp 로 주는 일이 있는데, 이름만 png 인
    // 파일을 AI 에게 보내면 읽지 못한다. 이미 png 면 그대로다.
    if (type === 'image/png') return bytes
    const img = nativeImage.createFromBuffer(bytes)
    return img.isEmpty() ? null : img.toPNG()
  }
  return null
}
