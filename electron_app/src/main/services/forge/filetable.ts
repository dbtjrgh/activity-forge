/**
 * **폴더 파일 이름으로 표의 짜임을 다시 짠다** — 스펙 `fileTables` (2026-09-28).
 *
 * MAL2M07W2S1 — 원본(6호) 보기 표는 3이닝 × 6개였는데 이 회차 폴더는 `view_0_0 … view_4_2`
 * (5이닝 × 3개)다. 표를 원본 짜임대로 두면 정답표가 없는 단추 6·7 을 가리키고 에러 12개가 난다.
 * **짜임은 파일 이름에 그대로 있다** — M05 완성본 15개에서 이닝 수 · 이닝마다 보기 수 ·
 * 정답표·차례표 안쪽 칸 수가 다 맞았다(`forge/src/tool/m05shape.ts`).
 *
 * `cells.ts` 는 배열만 늘리고 줄인다. 여기는 **열쇠 표**(`inning_{i}.view_{j}`)와 거기 딸린
 * i×j 배열을 한꺼번에 맞춘다. 새로 생긴 칸은 **앞 칸을 떠서** 붙인다 — 좌표는 원본 것(좌표의
 * 정본이 figma 가 아니라는 것은 함정 문서), 정답·차례 값은 그 뒤 원래 길(기획서·카드)이 채운다.
 *
 * **빈틈이 있으면 안 짠다** — `view_0_0 · view_0_2` 처럼 가운데가 빠졌으면 어느 칸이 빠졌는지
 * 짐작해야 하므로 까닭만 돌려준다. Electron 을 import 하지 않는다(services 규칙).
 */

import type { FileTable } from '@/gen/types'
import { escapeRe as esc } from '../../lib/regex'
import { applyAnswers, valueAt } from './answer'

export type TableFix = { id: string; from: number[]; to: number[]; note: string }
const full = (root: string, p: string): string => (root ? `${root}.${p}` : p)

/** 폴더 파일에서 i → j 가짓수. 빈틈(0..N-1 중 빠진 것)이 있으면 까닭 */
function shapeOf(ft: FileTable, files: string[]): { per: number[] } | { why: string } | null {
  const re = new RegExp(
    '^' + esc(ft.file).replace(esc('{i}'), '(\\d+)').replace(esc('{j}'), '(\\d+)') + '$',
    'i'
  )
  const seen = new Map<number, Set<number>>()
  for (const f of files) {
    const m = re.exec(f)
    if (m) seen.set(Number(m[1]), (seen.get(Number(m[1])) ?? new Set()).add(Number(m[2])))
  }
  if (!seen.size) return null
  const per: number[] = []
  for (let i = 0; i < seen.size; i += 1) {
    const js = seen.get(i)
    if (!js) return { why: `${i}번 이닝의 파일이 없습니다 (${ft.file}).` }
    for (let j = 0; j < js.size; j += 1) if (!js.has(j)) return { why: `${i}_${j} 파일이 빠졌습니다 (${ft.file}).` }
    per.push(js.size)
  }
  return { per }
}

const keyOf = (pattern: string, n: number): string => pattern.replace(/\{[ij]\}/, String(n))

/** 앞 칸을 떠서 n 칸으로 */
function fit<T>(list: T[], n: number): T[] {
  const out = list.slice(0, n)
  while (out.length < n && list.length) out.push(structuredClone(list[list.length - 1] as T))
  return out
}

/**
 * 스펙의 `fileTables` 를 따라 표를 짠다. 바꾼 것만 돌려준다.
 * `files` 는 리소스 폴더 안 경로(`images/view_0_0_basic.png`).
 */
export function fitFileTables(
  recipe: unknown,
  tables: FileTable[] | undefined,
  files: string[],
  root: string
): TableFix[] {
  const out: TableFix[] = []
  for (const ft of tables ?? []) {
    const got = shapeOf(ft, files)
    if (!got) continue
    if ('why' in got) {
      out.push({ id: ft.id, from: [], to: [], note: `표 구조를 바꾸지 않았습니다. ${got.why}` })
      continue
    }
    const table = valueAt(recipe, full(root, ft.table), root) as Record<string, unknown> | undefined
    if (!table || typeof table !== 'object') continue
    const outerKeys = Object.keys(table).filter((k) => new RegExp('^' + esc(ft.outer).replace(esc('{i}'), '\\d+') + '$').test(k))
    if (!outerKeys.length) continue
    const innerRe = new RegExp('^' + esc(ft.inner).replace(esc('{j}'), '\\d+') + '$')
    const from = outerKeys.map((k) => Object.keys((table[k] ?? {}) as object).filter((v) => innerRe.test(v)).length)
    const same = JSON.stringify(from) === JSON.stringify(got.per)

    // ─ 열쇠 표 ─ 이닝 칸은 같은 번호가 없으면 마지막 이닝을, 보기 칸은 마지막 보기를 뜬다
    const last = outerKeys[outerKeys.length - 1] as string
    const rebuilt: Record<string, unknown> = {}
    if (!same) got.per.forEach((n, i) => {
      const src = (table[keyOf(ft.outer, i)] ?? table[last]) as Record<string, unknown>
      const views = Object.keys(src).filter((v) => innerRe.test(v))
      const inner: Record<string, unknown> = {}
      // 보기 말고 딸린 열쇠가 있으면 그대로 둔다
      for (const [k, v] of Object.entries(src)) if (!innerRe.test(k)) inner[k] = structuredClone(v)
      for (let j = 0; j < n; j += 1) {
        inner[keyOf(ft.inner, j)] = structuredClone(src[keyOf(ft.inner, j)] ?? src[views[views.length - 1] as string])
      }
      rebuilt[keyOf(ft.outer, i)] = inner
    })
    if (!same) {
      for (const k of outerKeys) delete table[k]
      Object.assign(table, rebuilt)
    }

    // ─ 딸린 i×j 배열 ─ 표가 이미 맞아도 배열만 어긋날 수 있어 늘 본다
    const done: string[] = []
    for (const p of ft.rows ?? []) {
      const arr = valueAt(recipe, full(root, p), root)
      if (!Array.isArray(arr) || !arr.every(Array.isArray)) continue
      const inner = (arr as unknown[][]).map((r) => r.length)
      if (JSON.stringify(inner) === JSON.stringify(got.per)) continue
      const next = fit(arr as unknown[][], got.per.length).map((row, i) => fit(row, got.per[i] as number))
      arr.splice(0, arr.length, ...next)
      done.push(p)
    }
    // ─ i 와 같아야 하는 수 ─
    const nums = (ft.counts ?? []).filter((p) => {
      const v = valueAt(recipe, full(root, p), root)
      return typeof v === 'number' && v !== got.per.length
    })
    applyAnswers(recipe, nums.map((p) => ({ path: full(root, p), value: got.per.length })), root)
    if (same && !done.length && !nums.length) continue

    const shape = (a: number[]): string => `${a.length}×${[...new Set(a)].join('/')}`
    out.push({
      id: ft.id,
      from,
      to: got.per,
      note:
        `${ft.table} 표 구조를 폴더(${ft.file})에 맞췄습니다 (${shape(from)} → ${shape(got.per)}).` +
        (done.length ? ` 함께 바꾼 항목: ${done.join(', ')}.` : '') +
        (nums.length ? ` 개수를 ${got.per.length}개로 맞춘 항목: ${nums.join(', ')}.` : '')
    })
  }
  return out
}
