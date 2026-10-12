/**
 * **(채널 아님) 붙여넣은 화면의 미리보기를 그린다.**
 *
 * `ipc/answers.ts` 와 같은 자리다 — 채널이 아니라 채널이 쓰는 조각이다.
 *
 * **여기 있는 까닭은 Electron 때문이다.** 줄여 그리는 것은 `nativeImage` 가
 * 하는데 `services/` 는 Electron 을 import 하지 않는다(저장소 규칙). 그래서
 * 「어떤 그림이 있나」는 서비스(`services/forge/shot.ts`)가 세고, **그리는
 * 것만** 여기서 한다.
 *
 * **원본을 그대로 보내지 않는다.** figma 캡처 한 장이 1~3MB 라, 서너 장이면
 * IPC 한 번에 10MB 가 오간다. 가로 200px 로 줄이면 한 장에 수십 KB 다.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { nativeImage } from 'electron'
import type { Shot } from '../../shared/forge'
import { FRAME, frameScale } from '../services/forge/frame'
import { pagePng } from '../services/forge/poppler'
import { stamp } from '../services/forge/stamp'

/** 미리보기 가로 크기(px). 화면에서 나란히 놓고 보기에 이만하면 된다. */
const THUMB_W = 200

/**
 * 그 폴더의 화면 목록을 미리보기까지 붙여 돌려준다.
 *
 * `files` 는 `shotsOf` 가 준 `_figma/….png` 꼴이고 `rscDir` 아래의 자리다.
 * **못 그리는 한 장 때문에 목록 전체가 죽지 않는다** — 그때는 미리보기만
 * 빈 글이고 파일 이름은 그대로 보인다(저장소 규칙 6 — 모른다를 숨기지 않는다).
 */
export function shotsWithThumbs(rscDir: string, files: string[]): Shot[] {
  return files.map((file) => {
    try {
      const full = path.join(rscDir, file)
      const img = nativeImage.createFromPath(/\.pdf$/i.test(file) ? (pdfFirstPage(full) ?? full) : full)
      const size = img.getSize()
      if (img.isEmpty()) return { file, thumb: '', width: 0, height: 0 }
      const small = size.width > THUMB_W ? img.resize({ width: THUMB_W }) : img
      return { file, thumb: small.toDataURL(), width: size.width, height: size.height }
    } catch {
      return { file, thumb: '', width: 0, height: 0 }
    }
  })
}

/**
 * PDF 기획서의 첫 쪽 그림 — `nativeImage` 는 PDF 를 못 그려 기획서 칸이 늘 「썸네일 없음」이었다(2026-10-08).
 * poppler 로 그린 것을 임시 폴더에 파일 도장(크기 · 수정 시각)별로 두고 다시 쓴다 — 목록을 읽을 때마다 그리지 않는다. 못 그리면 null
 */
function pdfFirstPage(file: string): string | null {
  const dir = path.join(os.tmpdir(), 'sparkon-plan-thumbs')
  const key = crypto.createHash('sha1').update(`${file}|${stamp(file)}`).digest('hex')
  const out = path.join(dir, key)
  if (fs.existsSync(`${out}.png`)) return `${out}.png`
  fs.mkdirSync(dir, { recursive: true })
  return pagePng(file, 1, out)
}

/** 고르기 후보 · 리소스 목록의 썸네일 크기(px)와 한 번에 그리는 장 수 — 폴더에 그림이 수백 장이다 */
const MINI_W = 72
export const THUMBS_MAX = 60
const PICTURE = /\.(png|jpe?g|webp|gif)$/i

/**
 * 리소스 폴더 안 그림들의 작은 썸네일 — `{상대 경로: dataURL}`. 그림이 아니거나 못 그린 것은 **빠진다**
 * (화면은 그 줄에 이름만 보인다). 목록이 길어도 한 장 때문에 전체가 죽지 않는다.
 * `width` 는 받을 리소스 창이 크게 그릴 때만 준다 — 목록 썸네일은 72px 그대로.
 */
export function thumbsOf(rscDir: string, files: string[], width = MINI_W): Record<string, string> {
  const out: Record<string, string> = {}
  for (const file of files) {
    if (!PICTURE.test(file)) continue
    try {
      const img = nativeImage.createFromPath(path.join(rscDir, file))
      if (img.isEmpty()) continue
      out[file] = (img.getSize().width > width ? img.resize({ width }) : img).toDataURL()
    } catch {
      // 못 그린 한 장은 이름만 보인다
    }
  }
  return out
}

/**
 * 렌더러가 보낸 이름이 **리소스 폴더 안의 상대 경로인가** — 신뢰 경계.
 * 읽기만 하는 길이지만 `..` · 절대 경로로 폴더 밖 그림을 읽게 두지 않는다.
 */
export function isRscName(file: unknown): file is string {
  return (
    typeof file === 'string' &&
    file.length > 0 &&
    file.length < 400 &&
    !path.isAbsolute(file) &&
    !file.split(/[\\/]/).some((m) => m === '..' || m === '')
  )
}

/**
 * **붙이는 그 자리에서 1x 인가를 가른다** (2026-09-29, M4). 가름은 `services/forge/frame.ts` 한 곳 —
 * 끌어다 놓은 PNG(`sortpaper.ts`)도 같은 셈이다. 정배수면 **1920×1080 으로 줄여** 받고 원래 것도 돌려준다(`_figma/_원본/`).
 */
export function oneX(png: Buffer): { png: Buffer; original: Buffer | null } | { error: string } {
  const img = nativeImage.createFromBuffer(png)
  if (img.isEmpty()) return { error: '그림을 읽지 못했습니다.' }
  const { width, height } = img.getSize()
  const k = frameScale(width, height)
  if (typeof k === 'string') return { error: k }
  if (k === 1) return { png, original: null }
  return { png: img.resize({ ...FRAME, quality: 'best' }).toPNG(), original: png }
}

/**
 * 렌더러가 보낸 이름이 **`_figma`·`_plan` 안의 한 개인가.**
 *
 * 신뢰 경계 검사다 — 렌더러에서 온 글로 파일을 지우러 가는 길이 있다
 * (`forgeDropShot`). `..` 이나 다른 폴더를 가리키지 못하게 여기서 막는다.
 * **서비스 쪽에서도 목록에 있는지 한 번 더 본다** — 두 겹으로 둔다.
 *
 * **기획서를 더할 때 이 줄을 같이 고쳐야 한다** (2026-09-21). 여기를 빼먹으면
 * 폴더에는 들어갔는데 **지우기만 조용히 안 되는** 꼴이 된다.
 */
export function isShotName(file: unknown): file is string {
  return typeof file === 'string' && /^_(figma|plan)\/[^/\\]+\.(png|jpe?g|webp|pdf)$/i.test(file)
}

/** 그 폴더가 실제로 있나. 없으면 붙여넣은 적이 없는 것이다. */
export function hasDir(dir: string): boolean {
  return Boolean(dir) && fs.existsSync(dir)
}
