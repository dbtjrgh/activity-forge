/**
 * **원본보다 리소스가 몇 개 모자란가 — 세는 곳은 여기 하나** (2026-10-01).
 *
 * 전에는 셋이 따로 셌다 — 작업대 「부족한 리소스」는 별칭 수로(`prepare.ts`), 「관리」 받을 리소스는 파일 수로(`rscwait.ts`),
 * 진행판은 아예 안 셌다. 그래서 진행판은 「화면 붙이기」, 작업대는 「리소스 35개 부족」이라 말이 갈렸다.
 * - **파일 수로 센다** — 별칭 여럿이 한 파일을 쓰면 별칭 수는 실제로 받을 수보다 많다
 * - **모자람은 개수로 잰다** — 파일은 이름이 바뀌어 오므로 이름만 견주면 온 것도 없다고 나온다. 원본 이름은 참고로만 싣는다
 * - 영상은 AssetTable 이 그림 목록에 올리지만 사람에게는 그림이 아니다 — 따로 센다
 * - **원본은 만들 때 쓰는 원본**(`originNow` — 배치표에 크기 맞추기까지) — 받을 리소스 창과 같다. 배치표 판정만 보면 크기로 원본이 바뀐 칸에서 수가 갈린다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path, { basename } from 'node:path'
import { originNow } from './originpick'
import type { Forge } from './runtime'
import { stamp, stampTree } from './stamp'

export const kindKey = (file: string, kind: string): string => (file.toLowerCase().endsWith('.mp4') ? 'video' : kind)

export interface RscCount {
  kind: string
  /** 원본이 쓰는 파일 수 */
  origin: number
  /** 이번 폴더에 있는 수 */
  here: number
  /** 원본 이름 가운데 이번 폴더에 없는 것 — 참고용 */
  files: string[]
}

type Recipe = { assets?: Record<string, { file: string }[] | undefined> }

/** 종류마다 원본 · 지금. 원본에도 폴더에도 없는 종류는 안 싣는다 */
export function rscCount(recipe: Recipe, files: { name: string; kind: string }[]): RscCount[] {
  const names = new Set(files.map((f) => basename(f.name).toLowerCase()))
  const here = new Map<string, number>()
  for (const f of files) here.set(kindKey(f.name, f.kind), (here.get(kindKey(f.name, f.kind)) ?? 0) + 1)
  const want = new Map<string, Set<string>>()
  for (const [kind, list] of Object.entries(recipe.assets ?? {})) {
    for (const a of list ?? []) {
      const f = basename(a.file)
      want.set(kindKey(f, kind), (want.get(kindKey(f, kind)) ?? new Set()).add(f))
    }
  }
  const kinds = [...new Set([...want.keys(), ...here.keys()])]
  return kinds.map((kind) => {
    const set = want.get(kind) ?? new Set<string>()
    return { kind, origin: set.size, here: here.get(kind) ?? 0, files: [...set].filter((f) => !names.has(f.toLowerCase())).sort() }
  })
}

/** 모자란 수의 합 */
export const gapOf = (rows: RscCount[]): number => rows.reduce((n, r) => n + Math.max(0, r.origin - r.here), 0)

type Counted = { origin: string; rows: RscCount[] } | string

/**
 * **한 번 센 것은 다시 안 센다** (2026-10-01). 진행판은 리소스가 든 칸마다 이것을 부르고, 도는 판이 있으면 30초마다 다시 읽는다.
 * 원본을 불러오는 것이 메인 스레드를 붙잡아(함정 — 동기 계산은 화면 전체를 멈춘다) 칸이 수십 개면 몇 초씩 멈춘다.
 * 열쇠는 그 리소스 폴더의 파일 도장과 배치표(원본 고정) 도장 — 바뀌면 다시 센다. 호 저장소에 새 액티비티가 들어와
 * 원본 후보가 바뀌는 것은 도장에 안 잡혀서 **10분이 지나면 다시 센다**
 */
const KEEP_MS = 10 * 60_000
const kept = new Map<string, { key: string; at: number; value: Counted }>()

function keyOf(forge: Forge, code: string): string {
  const layout = path.join(forge.paths.REPO_ROOT, '_layout', `${code.slice(0, 2)}${/M(\d\d)/.exec(code)?.[1] ?? ''}.json`)
  return [stamp(layout), ...stampTree(forge.files.rscDir(code), forge.files.walk)].join('\n')
}

/** 만들 때 쓰는 원본을 불러와 센다 — 못 하면 까닭 */
export function countFor(forge: Forge, code: string): Counted {
  const key = keyOf(forge, code)
  const hit = kept.get(code)
  if (hit && hit.key === key && Date.now() - hit.at < KEEP_MS) return hit.value
  const value = countNow(forge, code)
  kept.set(code, { key, at: Date.now(), value })
  return value
}

function countNow(forge: Forge, code: string): Counted {
  const now = originNow(forge, code)
  if (typeof now === 'string') return now
  const cloned = forge.api.clone(now.origin, code)
  if (!cloned.ok) return cloned.error ?? '원본을 불러오지 못했습니다.'
  return { origin: now.origin, rows: rscCount(cloned.recipe as Recipe, forge.files.listFiles(code)?.files ?? []) }
}
