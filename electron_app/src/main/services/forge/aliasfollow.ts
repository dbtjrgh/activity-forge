/**
 * **번호로 짝인 이름 무리를 정하는 쪽에 맞춘다** — 스펙 `aliasFollows` (2026-09-28).
 *
 * M05 는 `btn_sfx_${누른 단추}` 로 소리를 부른다. 단추(`button_{k}_basic`)는 폴더 파일이
 * 정하고 `familytrim.ts` 가 줄어든 만큼 덜어내지만, 소리 파일 이름(`SL_drum_sfx05`)에는 그
 * 번호가 없어 **형제가 증인이 못 된다.** 7호 MAL2M07W2S1 에서 단추는 0~5 로 줄었는데
 * `btn_sfx_6·7` 이 남았고, AI 가 상어 소리를 `btn_sfx_6` 에 얹었다(완성본은 `btn_sfx_5`).
 *
 * 그래서 **덜어내기 뒤, AI 를 부르기 전에** 정하는 쪽에 없는 번호를 덜어낸다. 없어야 할
 * 자리를 물으면 AI 는 아무거나 집어넣는다(함정). **모자란 번호는 세우지 않는다** —
 * 무엇을 넣을지 모르니 검사(`alias-follows`)가 막고 사람에게 묻는다.
 *
 * 빗장은 `familytrim.ts` 와 같다 — `gameData` 가 그 이름을 부르면 건드리지 않는다.
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Forge } from './runtime'
import type { Swap } from '@/gen/swap'
import type { Spec } from '@/gen/types'
import { usedInData } from './familytrim'

export type FollowFix = { id: string; dropped: string[]; gonePaths: string[] }

export function fitFollows(forge: Forge, swap: Swap, spec: Spec | null): FollowFix[] {
  const recipe = swap.recipe as { assets?: Record<string, { alias: string }[]>; gameData?: unknown }
  const fixes: FollowFix[] = []
  for (const f of spec?.aliasFollows ?? []) {
    const names = Object.values(recipe.assets ?? {}).flatMap((list) => list.map((a) => a.alias))
    // 정하는 쪽이 하나도 없으면 그 무리를 안 쓰는 회차다 — 검사와 같이 안 본다
    if (!forge.aliasfollow.followNumbers(f.follows, names).size) continue
    const extra = forge.aliasfollow.followGaps(f, names).extra
    const drop = new Set(extra.filter((n) => !usedInData(recipe.gameData, new Set([n]))))
    if (!drop.size) continue
    const gonePaths: string[] = []
    for (const [kind, list] of Object.entries(recipe.assets ?? {})) {
      for (const a of list) if (drop.has(a.alias)) gonePaths.push(`assets.${kind}.${a.alias}`)
      recipe.assets![kind] = list.filter((a) => !drop.has(a.alias))
    }
    swap.misses = swap.misses.filter((m) => !drop.has(m.alias))
    fixes.push({ id: f.id, dropped: [...drop], gonePaths })
  }
  return fixes
}

/**
 * **맞추기 브리프에 적을 짝** (2026-09-28). `btn_sfx_0` 이 무엇의 소리인지는 이름에도 파일에도 없다 —
 * 같은 번호의 단추 그림을 봐야 안다. MAL2M07W2S1 에서 기획서(「동물별 매칭 음원」 표)를 줘도 AI 가
 * 번호순으로 이었다 — `btn_sfx_0` 이 불가사리 단추의 소리라는 것을 몰랐기 때문이다.
 * 짝이 없으면 빈 글.
 */
export function followHint(forge: Forge, swap: Swap, spec: Spec | null, alias: string): string {
  const recipe = swap.recipe as { assets?: Record<string, { alias: string; file: string; base?: string }[]> }
  const all = Object.entries(recipe.assets ?? {}).flatMap(([kind, list]) => list.map((a) => ({ kind, ...a })))
  for (const f of spec?.aliasFollows ?? []) {
    const k = [...forge.aliasfollow.followNumbers(f.alias, [alias]).keys()][0]
    if (k === undefined) continue
    const lead = f.follows.replace('{k}', String(k))
    const got = all.find((a) => a.alias === lead)
    const dir = got?.base ?? (got?.kind === 'image' ? 'images' : got?.kind === 'sound' ? 'sounds' : 'animations')
    return `짝: ${lead}` + (got?.file ? ` (\`${dir}/${got.file}\` — 열어 보면 무엇인지 보입니다)` : '') + ` · ${f.note}`
  }
  return ''
}

/** 걸음에 적을 한 줄. */
export function followNote(fixes: FollowFix[]): string {
  return fixes.map((f) => `짝이 없는 항목을 뺐습니다 (${f.dropped.join(', ')}).`).join(' ')
}
