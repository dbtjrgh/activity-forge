/**
 * **무리 이름이 통째로 바뀐 것을 폴더 쪽으로 맞춘다** (2026-09-21).
 *
 * `swap.ts` 는 **파일을 갈아끼우고**, `restock.ts` 는 **자리 이름을 갈아끼웁니다**.
 * 둘 다 **자리 수는 그대로** 둡니다. 그런데 회차마다 **자리 수와 이름 짜임이
 * 같이 바뀌는** 자리가 있습니다.
 *
 * `MAL2M07W2S1` 이 그랬습니다 —
 *
 *   원본(6호)   `view_0_basic` … `view_5_basic`        여섯 자리
 *   이 회차 폴더 `view_0_0_basic` … `view_4_2_basic`   열다섯 개 (5이닝 × 3칸)
 *
 * 이름이 비슷해 보이지만 **숫자 마디가 하나 늘었습니다.** 그래서 맞추기 규칙
 * 넷이 하나도 안 걸리고, 「고정 자리인데 파일이 없다」로 71자리 가운데 12자리가
 * 남았습니다. AI 에게 물어도 답이 없습니다 — **여섯 자리에 열다섯 파일을 넣을
 * 수는 없기 때문**입니다. 실제로 AI 가 열두 번 「화면을 봐야 안다」고 답했고,
 * 화면을 줘도 마찬가지였습니다.
 *
 * **완성본이 답을 알려 줍니다.** 같은 모듈(MA/M05)의 `MAL2M03W4S1` 은
 * `AssetTable.ts` 에 `view_0_0_basic` … 으로 **파일 이름 그대로** 적혀 있습니다.
 * 즉 이 자리의 별칭은 **모듈이 박아 둔 이름이 아니라 폴더를 따라가는 이름**입니다
 * (저장소 함정 — 「도구의 규칙이 완성본과 어긋나면 완성본이 맞다」).
 *
 * 그래서 여기서 **무리를 통째로 갈아 끼웁니다.** 아무 때나 하지 않습니다 —
 * 아래 네 가지가 다 맞을 때만입니다.
 *
 *   ① 원본 무리의 파일이 폴더에 **한 개도** 없다
 *   ② 폴더에 **숫자 마디만 다른 같은 꼴** 무리가 있다
 *   ③ 그런 무리가 **딱 하나**다 (둘이면 어느 쪽인지 모른다)
 *   ④ `gameData` 가 그 별칭들을 **한 번도 안 부른다**
 *
 * ④ 가 빗장입니다. `gameData` 가 이름으로 부르고 있으면 자리를 없애는 순간
 * 없는 이름을 가리키게 됩니다 — 그때는 건드리지 않고 사람에게 묻습니다.
 * `MAL2M07W2S1` 의 `view_*` 는 `gameData` 에서 **0번** 불립니다(재서 확인).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Forge } from './runtime'
import type { Swap } from '@/gen/swap'
import type { AssetKind } from '@/gen/types'

/** 갈아 끼운 무리 하나. **무엇이 무엇으로 바뀌었나**를 사람이 그대로 본다. */
export interface FamilyFix {
  kind: AssetKind
  /** 원본이 쓰던 무리 (`images/view_#_basic.png`) */
  from: string
  /** 폴더에 있는 무리 (`images/view_#_#_basic.png`) */
  to: string
  /** 없앤 자리 수 · 세운 자리 수 */
  dropped: number
  added: number
  /**
   * 없앤 자리의 답 자리(`assets.image.view_0_basic`).
   *
   * **앞 판에서 받아 둔 답이 여기 걸려 있다.** 그대로 두면 `applyAnswers` 가
   * 「자리를 못 찾아 못 넣었습니다」로 세어, 도구가 없앤 자리를 **사람이 잘못
   * 적은 것처럼** 보인다. 부르는 쪽이 이걸로 걷어낸다.
   */
  gonePaths: string[]
}

type Asset = { alias: string; file: string; base?: string }

/** 숫자 마디와 이음표를 걷어낸 **꼴**. `view_#_basic.png` 와 `view_#_#_basic.png` 가 같아진다. */
function shapeOf(family: string): string {
  return family.replace(/#/g, '').replace(/[_-]+/g, '_').replace(/_+\./g, '.').toLowerCase()
}

/** `gameData` 어딘가에 그 글자가 값으로 들어 있나. 이름으로 부르는 자리를 찾는 것이다. */
function usedInData(data: unknown, names: Set<string>): boolean {
  if (typeof data === 'string') return names.has(data)
  if (Array.isArray(data)) return data.some((v) => usedInData(v, names))
  if (data && typeof data === 'object') {
    return Object.values(data as Record<string, unknown>).some((v) => usedInData(v, names))
  }
  return false
}

/**
 * 폴더를 따라 무리를 갈아 끼운다. **레시피와 `swap` 을 그 자리에서 고친다** —
 * 아래 걸음(자리 가리기·맞추기)이 바뀐 것을 그대로 보게 하려는 것이다.
 */
export function followFolder(forge: Forge, swap: Swap): FamilyFix[] {
  const fam = forge.swap.familyOf
  const recipe = swap.recipe as { assets?: Record<string, Asset[]>; gameData?: unknown }
  const fixes: FamilyFix[] = []

  // 폴더에 남은 파일을 무리별로. **맞추기가 이미 가져간 것은 여기 없다.**
  const spare = new Map<string, string[]>()
  for (const f of swap.spare) {
    const key = fam(f)
    spare.set(key, [...(spare.get(key) ?? []), f])
  }

  for (const [kind, list] of Object.entries(recipe.assets ?? {})) {
    const base = kind === 'image' ? 'images' : kind === 'sound' ? 'sounds' : 'animations'
    // 원본 자리를 무리별로 묶는다. 자리가 하나뿐인 무리는 건드리지 않는다 —
    // 이름 한 개짜리는 맞추기 규칙 다섯이 이미 볼 만큼 봤다.
    const mine = new Map<string, Asset[]>()
    for (const a of list) {
      const key = fam(`${a.base ?? base}/${a.file}`)
      mine.set(key, [...(mine.get(key) ?? []), a])
    }

    for (const [key, slots] of mine) {
      if (slots.length < 2) continue
      // ① 그 무리 파일이 폴더에 하나도 없다
      if (spare.has(key)) continue
      const missing = new Set(swap.misses.filter((m) => m.kind === kind).map((m) => m.alias))
      if (!slots.every((s) => missing.has(s.alias))) continue
      // ②③ 숫자 마디만 다른 무리가 폴더에 **딱 하나**
      const same = [...spare.entries()].filter(([k]) => k !== key && shapeOf(k) === shapeOf(key))
      if (same.length !== 1) continue
      const [toKey, files] = same[0]
      if (!files.length) continue
      // ④ `gameData` 가 그 이름들을 안 부른다
      if (usedInData(recipe.gameData, new Set(slots.map((s) => s.alias)))) continue

      // ─ 갈아 끼운다 ─
      // **지금 들어 있는 것에서 덜어낸다.** 한 갈래에 바뀌는 무리가 둘일 수
      // 있어서(`view_#_basic` 과 `view_#_effect`), 위에서 묶어 둔 `list` 를
      // 그대로 쓰면 **앞 무리에서 세운 자리를 뒤 무리가 도로 지운다.**
      const cur = recipe.assets![kind]
      const keep = cur.filter((a) => !slots.includes(a))
      const sub = (a: Asset): string => a.base ?? base
      const made: Asset[] = files
        .slice()
        .sort()
        .map((f) => {
          const name = f.startsWith(`${base}/`) ? f.slice(base.length + 1) : f
          return { alias: forge.restock.aliasOf(name), file: name, base: sub(slots[0]) }
        })
      recipe.assets![kind] = [...keep, ...made]

      // 아래 걸음이 옛 자리를 다시 물으면 안 된다.
      swap.misses = swap.misses.filter((m) => !(m.kind === kind && missing.has(m.alias) && slots.some((s) => s.alias === m.alias)))
      swap.spare = swap.spare.filter((f) => !files.includes(f))
      spare.delete(toKey)
      fixes.push({
        kind: kind as AssetKind,
        from: key,
        to: toKey,
        dropped: slots.length,
        added: made.length,
        gonePaths: slots.map((s) => `assets.${kind}.${s.alias}`)
      })
    }
  }
  return fixes
}

/** 걸음에 적을 한 줄. 아무것도 안 바꿨으면 빈 글이다. */
export function familyNote(fixes: FamilyFix[]): string {
  if (!fixes.length) return ''
  return `이름 구조가 바뀐 그룹을 폴더에 맞췄습니다 (${fixes
    .map((f) => `${f.from} ${f.dropped}개 → ${f.to} ${f.added}개`)
    .join(', ')}).`
}
