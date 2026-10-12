/**
 * **이름으로 못 맞춘 그림을 크기로 먼저 짝짓는다** (2026-09-29).
 *
 * figma 에서 받은 파일은 이름이 `Mask group-3.png` · `Group 11349.png` 꼴이라 이름 규칙 넷이 하나도 안 걸린다.
 * 9호 KOL1M08W1S3 에서 AI 에게 24자리를 물었는데, 크기만 봐도 무리가 갈렸다(필름 450x234 · 스티커 60x190 · 160x160 ·
 * 폴라로이드는 원본 1008x708 의 절반 504x354).
 *
 * - 원본 파일의 크기와 **같거나 절반 · 두 배**인 남은 파일을 찾는다(1x · 2x 로 내보내 흔하다) — 한 꼴만 걸릴 때만
 * - **그 크기가 자리 하나 · 파일 하나로 딱 떨어질 때만** 넣는다 — 짐작해서 남의 그림을 넣지 않는다
 * - 같은 크기가 여럿이면(폴라로이드 다섯) **차례 문제**라 넣지 않고 묶음으로 돌려준다 — 차례는 기획이 정한다
 * 넣는 것은 사람 답과 같은 자리(`assets.<갈래>.<별칭>`)에 쓰되 답 파일에는 안 남긴다 — 판마다 다시 잰다.
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import { applyAnswers } from './answer'
import type { Forge } from './runtime'

type Swap = ReturnType<Forge['swap']['swapResources']>

export type SizeTake = { kind: string; alias: string; to: string }
/** 같은 크기라 차례만 남은 묶음 — 자리(원본 이름)와 파일이 같은 수 */
export type SizeGroup = { size: string; aliases: string[]; files: string[] }

const PICTURE = /\.png$/i

export function matchBySize(forge: Forge, swap: Swap): { taken: SizeTake[]; groups: SizeGroup[] } {
  const taken: SizeTake[] = []
  const groups: SizeGroup[] = []
  const origin = forge.spec.parseStudyCode(swap.from)
  if (!origin) return { taken, groups }
  const originDir = path.join(forge.paths.workPath(`sparkon_m${String(origin.month).padStart(2, '0')}`), 'public', 'sparklab', origin.code)
  const sizeOf = (file: string): string => {
    const s = forge.png.pngSize(file)
    return s ? `${s.w}x${s.h}` : ''
  }

  // 남은 파일을 크기별로
  const spare = new Map<string, string[]>()
  for (const rel of swap.spare.filter((f) => PICTURE.test(f))) {
    const key = sizeOf(path.join(swap.dir, rel))
    if (key) spare.set(key, [...(spare.get(key) ?? []), rel])
  }
  // 못 맞춘 그림 자리를 원본 크기별로
  const miss = new Map<string, { kind: string; alias: string }[]>()
  for (const m of swap.misses.filter((x) => x.kind === 'image' && PICTURE.test(x.file))) {
    const key = sizeOf(path.join(originDir, m.file))
    if (key) miss.set(key, [...(miss.get(key) ?? []), { kind: m.kind, alias: m.alias }])
  }

  const used = new Set<string>()
  for (const [key, slots] of miss) {
    const [w, h] = key.split('x').map(Number) as [number, number]
    // 받은 것이 같은 크기 · 절반(1x 로 내보냄) · 두 배(2x 로 내보냄) — 9호 card_blur 가 7호의 두 배로 왔다
    const half = w % 2 === 0 && h % 2 === 0 ? `${w / 2}x${h / 2}` : ''
    const keys = [key, half, `${w * 2}x${h * 2}`].filter((k) => k && spare.has(k))
    // 크기 꼴이 둘 이상 걸리면 어느 쪽인지 모른다 — 한 꼴만 걸릴 때만
    const at = keys.length === 1 ? (keys[0] as string) : ''
    const one = at ? (spare.get(at) ?? []).filter((f) => !used.has(f)) : []
    if (slots.length === 1 && one.length === 1) {
      taken.push({ ...slots[0], to: one[0] as string })
      used.add(one[0] as string)
    } else if (slots.length > 1 && slots.length === one.length) {
      // 사람에게 보일 크기는 **받은 파일의 크기**다 — 원본 크기(1008x708)를 적으면 받은 504x354 와 달라 틀린 줄 안다
      groups.push({ size: at, aliases: slots.map((s) => s.alias), files: one })
      for (const f of one) used.add(f)
    }
  }
  return { taken, groups }
}

/** 걸음 글에 붙일 한 토막 */
export function sizeNote(r: { taken: SizeTake[]; groups: SizeGroup[] }): string {
  const bits: string[] = []
  if (r.taken.length) bits.push(`그림 크기로 ${r.taken.length}개 항목을 맞췄습니다.`)
  if (r.groups.length) bits.push(`같은 크기 묶음 ${r.groups.length}개(${r.groups.map((g) => `${g.aliases.length}장`).join(', ')})는 순서만 정하면 됩니다.`)
  return bits.join(' ')
}

/** 맞추기 결과에 크기 짝을 얹는다 — 넣은 자리는 못 맞춘 것 · 남은 파일에서 뺀다 */
export function withSizes(forge: Forge, s: Swap): Swap & { sized: { taken: SizeTake[]; groups: SizeGroup[] } } {
  const sized = matchBySize(forge, s)
  if (sized.taken.length) {
    applyAnswers(s.recipe, sized.taken.map((t) => ({ path: `assets.${t.kind}.${t.alias}`, value: t.to })), '')
    const took = new Set(sized.taken.map((t) => `${t.kind}|${t.alias}`))
    const files = new Set(sized.taken.map((t) => t.to))
    s.misses = s.misses.filter((m) => !took.has(`${m.kind}|${m.alias}`))
    s.spare = s.spare.filter((f) => !files.has(f))
  }
  return { ...s, sized }
}
