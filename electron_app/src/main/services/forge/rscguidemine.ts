/**
 * **받을 리소스 창의 「넣은 리소스」** (2026-10-12, 사용자 요청) — 이번 폴더에 놓인 파일마다 원본의 무엇과 짝인가.
 *
 * 이름이 다르게 온 그림은 원본 목록에 「크기 일치」 · 「n개 중 m개」로만 떠서 무엇을 넣었는지, 그래서 무엇을 빼먹었는지가
 * 안 보였다(「내가 무슨 이미지를 빼먹었는지는 확인할 수 있게 해야」). 넣은 파일을 그대로 늘어놓고 짝은 **사실만** 적는다 —
 * 이름이 같다 · 정했다 · 크기가 같은 원본이 있다. 크기가 같은 원본이 여럿이면 다 적고 어느 것인지는 안 고른다(저장소 CLAUDE.md 6번).
 *
 * 읽기만 한다. Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import type { GuideFile, GuideItem } from '../../../shared/forge'

/** 이번 폴더 파일 — `rscguide.ts` 가 폴더를 읽으며 채운다 */
export type Placed = Omit<GuideFile, 'how' | 'to'>

/** 같은 크기 · 절반 · 두 배 — `sizematch.ts` · `rscguide.ts` 의 `sizeHints` 와 같은 세 꼴 */
const fits = (f: Placed, i: GuideItem): boolean =>
  Boolean(f.w && f.h && i.w && i.h) &&
  ((f.w === i.w && f.h === i.h) || (f.w === (i.w as number) / 2 && f.h === (i.h as number) / 2) || (f.w === (i.w as number) * 2 && f.h === (i.h as number) * 2))

/**
 * `slots` — 원본 자리(rel)마다 그 파일을 가리키는 레시피 자리. `pick` — 레시피 자리 → 정한 이 폴더 파일.
 * 크기 짝은 **아직 안 온 원본 그림**(`wait` · `hint`)에서만 찾는다 — 이름으로 이미 온 것과 견주면 짝이 아닌 것이 짝처럼 보인다
 */
export function placedFiles(files: Placed[], items: GuideItem[], slots: Map<string, string[]>, pick: Map<string, string>): GuideFile[] {
  const byName = new Map(items.map((i) => [i.name.toLowerCase(), i.name]))
  const setTo = new Map<string, string[]>()
  for (const i of items) {
    for (const s of slots.get(i.rel) ?? []) {
      const v = pick.get(s)?.toLowerCase()
      if (v && !setTo.get(v)?.includes(i.name)) setTo.set(v, [...(setTo.get(v) ?? []), i.name])
    }
  }
  const open = items.filter((i) => i.kind === 'image' && (i.state === 'wait' || i.state === 'hint'))
  const out = files.map((f): GuideFile => {
    const same = byName.get(path.posix.basename(f.name).toLowerCase())
    if (same) return { ...f, how: 'name', to: [same] }
    const set = setTo.get(f.rel.toLowerCase())
    if (set) return { ...f, how: 'set', to: set }
    const size = f.kind === 'image' ? open.filter((i) => fits(f, i)).map((i) => i.name) : []
    return { ...f, how: size.length ? 'size' : 'none', to: size }
  })
  return out.sort((a, b) => a.rel.localeCompare(b.rel, 'en', { numeric: true }))
}
