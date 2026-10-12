/**
 * **figma 화면 PNG 로 좌표를 넣는다** (2026-09-28). 셈은 forge `gen/placefind.ts`, 여기는 얹기만.
 *
 * 전에는 좌표를 앞 회차 값 그대로 두었다. MAL2M07W2S1 에서 50자리 중 38자리가 완성본과 100px 넘게
 * 떨어졌다. 1이닝 화면 한 장(PNG 1x)으로 찾으면 찾은 칸 평균 18px · 다른 이닝 칸 71px ·
 * 눌린 그림 1px 이다(`tool/placefind.ts`, 원본 값이면 262 · 455 · 193px).
 *
 * **사람은 한 장만 준다**(사용자 결정 — 「이닝마다 png 는 무리」). 다른 이닝은 자리 번호로 짐작해
 * 놓고, 그렇다고 알린다. 차례를 그 한 장으로 못 믿겠으면 그때 나머지 이닝 화면을 더 붙인다.
 *
 * **사람이 준 값은 덮지 않는다** — 받아 둔 답이 그 칸(또는 그 아래)을 가리키면 건너뛴다.
 * 「사람이 정한 값」 **뒤**에 돈다. 정답표(`M05_View.answer`)가 이 회차 것이어야 칸마다 어느 그림인지 안다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import type { Answer } from '../../../shared/forge'
import type { Forge } from './runtime'
import type { Swap } from '@/gen/swap'
import type { Spec } from '@/gen/types'
import { applyAnswers, valueAt } from './answer'
import { cachedPlaces, placeKey } from './placecache'
import { shotsOf } from './shot'

export type ShotPlace = {
  found: number
  slot: number
  state: number
  carry: number
  kept: number
  notes: string[]
  /** 화면 파일 이름과 그 화면의 이닝(못 정했으면 null) — 비교 캔버스가 쓴다 (M6) */
  screens: { name: string; inning: number | null }[]
}

/** 별칭 → 그 그림 파일(절대 경로). 찾기와 비교 캔버스(`overlay.ts`)가 같은 자리를 본다 */
export function imageFiles(recipe: unknown, dir: string): Map<string, string> {
  const list = (recipe as { assets?: { image?: { alias: string; file: string; base?: string }[] } }).assets?.image ?? []
  return new Map(list.map((a) => [a.alias, path.join(dir, a.base === 'root' ? '' : a.base ?? 'images', a.file)]))
}

/** 좌표 꼴의 답인가 — 상자 · 점 · figma 네 칸 */
const isCoord = (v: unknown): boolean =>
  !!v && typeof v === 'object' && ((typeof (v as { x?: unknown }).x === 'number' && typeof (v as { y?: unknown }).y === 'number') || 'fx' in v)

/**
 * **찾기에 넣을 값 — 사람이 옮긴 좌표는 원본 값으로 되돌려 넣는다** (M6). 사람 좌표는 어차피 안 덮으니
 * 찾기가 알 까닭이 없다. 넣어 두면 캔버스에서 한 칸 옮길 때마다 지문이 바뀌어 15초 찾기를 다시 한다 —
 * 「저장하면 5초 안에 다시 그려진다」가 깨진다. 정답표 같은 좌표 아닌 답은 그대로 둔다(칸마다 그림을 거기서 안다).
 */
function findInput(gameData: unknown, origin: unknown, kept: Answer[], root: string): unknown {
  const human = kept.filter((a) => !a.path.startsWith('#') && isCoord(a.value))
  if (!human.length) return gameData
  const copy = { gameData: structuredClone(gameData) }
  const back = human
    .map((a) => ({ ...a, value: valueAt({ gameData: origin }, a.path, root) }))
    .filter((a) => a.value !== undefined)
    .map((a) => ({ ...a, value: structuredClone(a.value) }))
  applyAnswers(copy, back, root)
  return copy.gameData
}

const setAt = (root: unknown, dotted: string, box: Record<string, number>): boolean => {
  const keys = dotted.split('.')
  let v = root as Record<string, unknown> | undefined
  for (const k of keys.slice(0, -1)) v = v?.[k] as Record<string, unknown> | undefined
  const last = keys[keys.length - 1] as string
  const cell = v?.[last] as Record<string, unknown> | undefined
  if (!cell || typeof cell !== 'object') return false
  Object.assign(cell, box)
  return true
}

export function placeFromShots(
  forge: Forge,
  code: string,
  swap: Swap,
  spec: Spec | null,
  kept: Answer[],
  /** 원본을 떠 온 그대로의 gameData — 사람 좌표를 여기 값으로 되돌려 찾는다 */
  origin: unknown
): ShotPlace | null {
  const dir = forge.files.rscDir(code)
  const shots = dir ? shotsOf(dir) : []
  if (!dir || !shots.length || !spec) return null
  const recipe = swap.recipe as { gameData?: unknown }
  const files = imageFiles(swap.recipe, dir)
  const screens = shots.map((s) => path.join(dir, s))
  const tables = spec.fileTables ?? []
  const input = findInput(recipe.gameData, origin, kept, spec.gameData?.root ?? '')
  // **같은 입력이면 다시 안 찾는다** — 찾기가 메인 스레드를 15초 붙잡는다 (`placecache.ts`)
  const key = placeKey({ gameData: input, tables, screens, images: [...files.entries()] })
  const { hits, notes, screens: innings } = cachedPlaces(forge.paths.REPO_ROOT, code, key, () =>
    forge.placefind.findPlaces({
      gameData: input,
      root: '',
      imageOf: (alias) => files.get(alias) ?? null,
      rscDir: dir,
      tables,
      screens
    })
  )
  // 사람이 준 값이 있는 칸은 건너뛴다 — 답은 `quizData.…` 꼴로 온다
  const root = spec.gameData?.root ? `${spec.gameData.root}.` : ''
  const human = kept.map((a) => a.path).filter((p) => p.startsWith(root)).map((p) => p.slice(root.length))
  const out: ShotPlace = {
    found: 0,
    slot: 0,
    state: 0,
    carry: 0,
    kept: 0,
    notes,
    screens: shots.map((name, i) => ({ name, inning: innings[i] ?? null }))
  }
  for (const h of hits) {
    if (human.some((p) => p === h.path || p.startsWith(`${h.path}.`))) {
      out.kept += 1
      continue
    }
    if (setAt(recipe.gameData, h.path, h.box)) out[h.how] += 1
  }
  return out
}

/** 걸음에 적을 한 줄. */
export function placeNote(p: ShotPlace): string {
  return (
    `figma 화면에서 좌표 ${p.found}개를 찾아 넣었습니다.` +
    (p.state ? ` 눌린 상태 그림 ${p.state}개는 기본 그림 위치에 맞췄습니다.` : '') +
    (p.slot ? ` ${p.slot}개는 화면에 없는 이닝이라 같은 위치로 추정해 넣었습니다.` : '') +
    (p.carry ? ` ${p.carry}개는 같은 번호에서 찾은 좌표만큼 옮겼습니다.` : '') +
    (p.kept ? ` 사람이 정한 ${p.kept}개는 그대로 두었습니다.` : '') +
    (p.notes.length ? ` ${p.notes.join(' ')}` : '')
  )
}
