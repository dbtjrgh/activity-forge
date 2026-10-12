/**
 * 브리프에 담을 **자리와 파일 갈래** — 못 맞춘 자리를 `Slot` 으로, 파일 이름 끝을 갈래로
 * (2026-09-30 에 `brief.ts` 에서 옮김, 200줄이 넘어서. 동작 변화 없음).
 *
 * 브리프 글을 짓는 것은 `brief.ts` 다. 여기는 그 재료만 센다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { AssetKind } from '@/gen/types'
import type { SwapMiss } from '@/gen/swap'
import type { Slot } from './brief'

/** 파일 이름 끝으로 갈래를 본다. 갈래가 어긋난 짝을 거르는 데 쓴다. */
export function kindOf(file: string): AssetKind | null {
  const ext = (file.split('.').pop() ?? '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4'].includes(ext)) return 'image'
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'sound'
  if (ext === 'json') return 'lottie'
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) return 'font'
  return null
}

/**
 * 못 맞춘 자리를 브리프에 담을 꼴로. 스펙에서 그 별칭의 설명을 끌어온다.
 *
 * **`spare` 가 비면 브리프를 만들지 않는다** — 고를 파일이 없으면 AI 가 할
 * 일이 없다. 그때는 사람이 폴더에 파일을 넣는 것이 먼저다.
 */
export function slotsOf(
  misses: SwapMiss[],
  spec: { assets?: { required?: { alias: string; note?: string }[] } } | null,
  hint: (alias: string) => string = () => ''
): Slot[] {
  const noteOf = new Map(
    (spec?.assets?.required ?? []).map((r) => [r.alias, (r.note ?? '').replace(/\s+/g, ' ').trim()])
  )
  return misses.map((m) => ({
    alias: m.alias,
    kind: m.kind,
    was: m.file,
    // 스펙 글 뒤에 **짝**을 붙인다 — 번호로 짝인 무리(`aliasfollow.ts`)가 그렇다
    note: [noteOf.get(m.alias) ?? '', hint(m.alias)].filter(Boolean).join(' · ')
  }))
}
