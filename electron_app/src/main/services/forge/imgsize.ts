/**
 * **그림 크기 맞추기** — 스펙이 크기를 정한 그림(영상 모듈의 썸네일)을 그 크기로 줄인다
 * (2026-09-23).
 *
 * MAL1M07W3S1 에 썸네일이 1921×1081 로 와서 **재생을 눌러도 영상이 확대되지 않았다**
 * — 확대 비율이 `1080 ÷ 썸네일 높이` 라 1배가 됐다. 에러도 없어서 띄워 봐야 안다.
 * 까닭과 잰 값은 forge `rscsize.ts`. 생성기는 크기가 틀리면 막고, 여기서는
 * **가로세로 비율이 같으면** 그 크기로 줄인다(1921×1081 도 16:9). 비율이 다르면
 * 자르거나 늘려야 해서 도구가 정할 일이 아니다 — 생성기의 막힘이 카드로 간다.
 *
 * **원래 파일은 `_원본/` 에 둔다** — `_` 로 시작하는 폴더는 호 저장소로 안 간다(`inbox.ts`).
 * 리소스 작업 폴더(`rscRoot`)에서만 한다. 호 저장소 안이면 남의 자리라 안 한다.
 *
 * **줄이는 일은 Electron 이 한다**(`nativeImage`). services 는 Electron 을 import 하지
 * 않으므로 앱이 켤 때 `configureResizer` 로 넘겨준다(`main/index.ts`). 안 넘겨졌으면
 * (Node 로만 돌 때) 줄이지 않고 그렇다고 말한다.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Forge } from './runtime'
import type { Swap } from '@/gen/swap'
import type { Spec } from '@/gen/types'

/** 그림 파일을 w×h 로 줄인 PNG. 못 읽으면 null. */
export type Resizer = (file: string, w: number, h: number) => Buffer | null

let resizer: Resizer | null = null

export function configureResizer(fn: Resizer): void {
  resizer = fn
}

/** 그 그림을 w×h PNG 로 — 앱 밖(Node)이라 줄이는 도구가 없거나 못 읽으면 null. 끌어다 놓은 figma 화면(`sortpaper.ts`)이 쓴다 */
export function resizePng(file: string, w: number, h: number): Buffer | null {
  return resizer ? resizer(file, w, h) : null
}

/** 가로세로 비율이 이만큼 안에서 같으면 줄여도 모양이 안 바뀐다. 1921×1081 은 0.02%. */
const ASPECT_SLACK = 0.01

export interface Fitted {
  resized: { rel: string; from: string; to: string }[]
  /** 비율이 달라 안 줄인 것 — 생성기가 막고 카드로 간다 */
  odd: string[]
  note: string
}

/**
 * @param origin 원본 학습코드와 그 레시피(떠 온 그대로) — 주면 **원본 그림의 딱 두 배로 온 그림**도 원본 크기로 줄인다
 *   (2026-09-30 사용자 규칙 「그림 크기는 앞 호와 같게, 2x 로 오면 줄인다」). 9호 card_blur 가 1088×788 로 와서
 *   사람이 544×394 로 줄여 달라고 했다. **딱 두 배(±1px)일 때만** — 1.5배 같은 것은 디자인이 바뀐 것일 수 있어 안 건드린다
 */
export function fitSizes(forge: Forge, code: string, swap: Swap, spec: Spec | null, origin?: { code: string; recipe: unknown }): Fitted {
  const out: Fitted = { resized: [], odd: [], note: '' }
  const dir = forge.files.rscDir(code)
  if (!dir || !forge.files.rscRoot()) return out
  const slots = spec ? forge.rscsize.sizedSlots(spec, swap.recipe.assets ?? {}, code) : []
  const sized = new Set(slots.map((s) => s.rel))
  for (const s of slots) {
    if (!s.got || forge.rscsize.fits(s.got, s.want)) continue
    const shape = `${s.got.w}×${s.got.h}`
    const same = Math.abs(s.got.w / s.got.h - s.want.w / s.want.h) / (s.want.w / s.want.h) <= ASPECT_SLACK
    if (!same) {
      out.odd.push(`${s.rel} ${shape}(비율이 다름)`)
      continue
    }
    if (!resizer) {
      out.note = '그림을 줄일 도구가 없습니다(앱 밖에서 실행되었습니다).'
      continue
    }
    const png = resizer(s.file, s.want.w, s.want.h)
    if (!png) {
      out.odd.push(`${s.rel}(그림을 읽지 못함)`)
      continue
    }
    // 원래 것을 먼저 옮겨 둔다 — 되돌릴 길 (저장소 CLAUDE.md 7번)
    const keep = path.join(dir, '_원본', ...s.rel.split('/'))
    if (!fs.existsSync(keep)) {
      fs.mkdirSync(path.dirname(keep), { recursive: true })
      fs.copyFileSync(s.file, keep)
    }
    fs.writeFileSync(s.file, png)
    out.resized.push({ rel: s.rel, from: shape, to: `${s.want.w}×${s.want.h}` })
  }
  if (origin) halveDoubles(forge, dir, swap, origin, sized, out)
  const said = [
    out.resized.length
      ? `그림 크기를 줄였습니다 (${out.resized.map((r) => `${r.rel} ${r.from} → ${r.to}`).join(', ')}). 원래 파일은 _원본/ 폴더에 있습니다.`
      : '',
    out.odd.length ? `줄이지 못한 그림이 있습니다 (${out.odd.join(', ')}).` : '',
    out.note
  ]
  out.note = said.filter(Boolean).join(' ')
  return out
}

/** 원본의 같은 자리 그림보다 **딱 두 배**로 온 그림을 원본 크기로 — 스펙이 크기를 정한 자리(`sized`)는 위에서 봤다 */
function halveDoubles(forge: Forge, dir: string, swap: Swap, origin: { code: string; recipe: unknown }, sized: Set<string>, out: Fitted): void {
  type Rel = Parameters<Forge['common']['relOf']>[0]
  const was = forge.common.relOf(origin.recipe as Rel)
  const now = forge.common.relOf(swap.recipe as Rel)
  const originDir = forge.common.rscOfDone(origin.code)
  const done = new Set<string>()
  for (const [slot, rel] of now) {
    const old = was.get(slot)
    if (!slot.startsWith('image|') || !old || sized.has(rel) || done.has(rel) || !/\.png$/i.test(rel)) continue
    const file = path.join(dir, rel)
    const got = forge.png.pngSize(file)
    const want = forge.png.pngSize(path.join(originDir, old))
    if (!got || !want) continue
    const double = Math.abs(got.w - want.w * 2) <= 1 && Math.abs(got.h - want.h * 2) <= 1
    if (!double) continue
    done.add(rel)
    if (!resizer) {
      out.note = '그림을 줄일 도구가 없습니다(앱 밖에서 실행되었습니다).'
      continue
    }
    const png = resizer(file, want.w, want.h)
    if (!png) {
      out.odd.push(`${rel}(그림을 읽지 못함)`)
      continue
    }
    const keep = path.join(dir, '_원본', ...rel.split('/'))
    if (!fs.existsSync(keep)) {
      fs.mkdirSync(path.dirname(keep), { recursive: true })
      fs.copyFileSync(file, keep)
    }
    fs.writeFileSync(file, png)
    out.resized.push({ rel, from: `${got.w}×${got.h}`, to: `${want.w}×${want.h}(원본 크기)` })
  }
}
