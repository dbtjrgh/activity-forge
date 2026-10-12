/**
 * **새로 세운 그림 자리를 자리 표에도 넣는다** (2026-09-28).
 *
 * 「없던 무리 자리 세우기」(`familyadd.ts`)와 「빠진 부품 채우기」(`partfill.ts`)는 AssetTable 에만
 * 자리를 세웠다. 그런데 M05 는 `M05_Button.image` 표에 칸이 없으면 그 그림을 안 그린다 —
 * MAL2M07W2S1 에서 캐릭터 팔 18칸(arm_correct 6 · arm_idle 6 · arm_wrong 6)이 표에 없어
 * 에러 없이 팔이 안 나올 뻔했다.
 *
 * **어느 표에 넣나 — 앞머리와 숫자 마디 수가 같은 이름이 이미 있는 표.** `character_0_arm_correct` 는
 * `character_0_body_idle` 이 있는 표로 간다. `button_0_0_number` 는 `button_0_basic` 과 숫자 마디 수가
 * 달라 안 간다. M05 완성본 21개에서 이 규칙에 어긋난 그림이 0개였다(반대 — 표에만 있는 이름을
 * 지우는 것 — 은 35개가 어긋나 안 한다. `button_0_number` 같은 자리만 잡는 칸이 있다).
 *
 * 칸의 값 — 빈 그림(`empty.png`)이면 완성본처럼 `{x:0, y:0, width:1, height:1}`. 제 그림이면
 * 같은 번호 · 같은 끝마디(`_correct`)인 형제 칸의 **가운데**에 그 그림 크기로 **짐작해** 놓는다
 * (완성본의 팔은 몸 가운데에서 60~85px 아래였다 — 규칙이 없어 사람이 옮긴다). 짐작한 칸은 알린다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import type { Forge } from './runtime'
import type { Swap } from '@/gen/swap'
import type { Spec } from '@/gen/types'

type Box = { x: number; y: number; width: number; height: number }
export type TableKeys = { empty: string[]; guessed: string[] }

const shape = (a: string): string => `${a.replace(/\d.*$/, '')}#${(a.match(/\d+/g) ?? []).length}`
const isBox = (v: unknown): v is Box =>
  !!v && typeof v === 'object' && ['x', 'y', 'width', 'height'].every((k) => typeof (v as Record<string, unknown>)[k] === 'number')

export function addTableKeys(forge: Forge, swap: Swap, spec: Spec | null, code: string): TableKeys {
  const out: TableKeys = { empty: [], guessed: [] }
  const recipe = swap.recipe as { assets?: { image?: { alias: string; file: string; base?: string }[] }; gameData?: unknown }
  if (!spec?.relations || recipe.gameData === undefined) return out
  const dir = forge.files.rscDir(code)
  const tables = [...forge.relpath.aliasKeyPaths(spec.relations, recipe.gameData, spec.gameData?.root ?? '').values()]
    .filter((t) => t.kind === 'image' && t.table && typeof t.table === 'object' && !Array.isArray(t.table))
    .map((t) => t.table as Record<string, unknown>)
  for (const a of recipe.assets?.image ?? []) {
    if (tables.some((t) => a.alias in t)) continue
    const table = tables.find((t) => Object.keys(t).some((k) => shape(k) === shape(a.alias)))
    if (!table) continue
    if (/(^|\/)empty\.png$/i.test(a.file)) {
      table[a.alias] = { x: 0, y: 0, width: 1, height: 1 }
      out.empty.push(a.alias)
      continue
    }
    // 같은 번호 · 같은 끝마디인 형제 칸 — `character_0_arm_correct` → `character_0_body_correct`
    const num = a.alias.match(/\d+/)?.[0]
    const tail = a.alias.split('_').pop()
    const sib = Object.entries(table).find(
      ([k, v]) => isBox(v) && k.match(/\d+/)?.[0] === num && k.split('_').pop() === tail && shape(k) === shape(a.alias)
    )?.[1] as Box | undefined
    const size = dir ? forge.placefind.pngSize(path.join(dir, a.base === 'root' ? '' : a.base ?? 'images', a.file)) : null
    if (!sib || !size) continue
    table[a.alias] = {
      x: Math.round(sib.x + sib.width / 2 - size.w / 2),
      y: Math.round(sib.y + sib.height / 2 - size.h / 2),
      width: size.w,
      height: size.h
    }
    out.guessed.push(a.alias)
  }
  return out
}

/** 걸음에 적을 한 줄. */
export function tableNote(t: TableKeys): string {
  return (
    `위치 표에 ${t.empty.length + t.guessed.length}개 항목을 추가했습니다${t.empty.length ? `(빈 그림 ${t.empty.length}개)` : ''}.` +
    (t.guessed.length ? ` ${t.guessed.length}개(${t.guessed.slice(0, 2).join(', ')}…)는 위치를 추정했습니다. 미리보기로 확인하고 옮기세요.` : '')
  )
}
