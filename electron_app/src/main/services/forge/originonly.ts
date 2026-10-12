/**
 * **원본에만 있던 자리를 뺀다** (2026-09-29, M3). 가름은 forge `gen/reslotorigin.ts` 의 `originOnly`, 여기는 덜어내기만.
 *
 * MAL2M07W2S1 의 `bg_button_table` 이 그랬다 — 원본(6호)에만 있는 그림이라 「그 파일을 주세요」
 * 카드가 났고, 사람은 줄 것이 없었다. 완성본에도 없다.
 *
 * **뺀 것은 숨기지 않는다.** 걸음에 「n자리를 뺐습니다」로 남기고, 결과에 목록을 실어 화면이
 * 「되살리기」를 보인다. 되살리면 `#keep|갈래|별칭` 답이 남아 다음부터 안 뺀다.
 *
 * `familytrim.ts` 뒤, 자리 가리기 앞에 돈다 — 뺀 자리가 카드가 되지 않게.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer } from '../../../shared/forge'
import { parseKeepPath, parseSlotPath } from '../../../shared/forge'
import { dropKeys, usedInData } from './familytrim'
import type { Forge } from './runtime'
import { judgeMisses } from './slots'
import type { Swap } from '@/gen/swap'
import type { AssetKind, Spec } from '@/gen/types'

export type OriginDrop = { kind: AssetKind; alias: string; file: string }

export function dropOriginOnly(
  forge: Forge,
  code: string,
  module: string,
  swap: Swap,
  kept: Answer[],
  spec: Spec | null
): { dropped: OriginDrop[]; gonePaths: string[] } {
  const recipe = swap.recipe as { assets?: Record<string, { alias: string }[]>; gameData?: unknown }
  const fixed = new Set((spec?.assets.required ?? []).filter((r) => r.fixedAlias).map((r) => r.alias))
  // 사람이나 AI 가 이미 정한 자리 · 사람이 되살린 자리
  const claimed = new Set<string>()
  for (const a of kept) {
    const m = /^assets\.([a-z]+)\.(.+)$/.exec(a.path)
    if (m) claimed.add(`${m[1]}|${m[2]}`)
    const slot = parseSlotPath(a.path) ?? parseKeepPath(a.path)
    if (slot) claimed.add(`${slot.kind}|${slot.alias}`)
  }
  const slots = Object.entries(recipe.assets ?? {}).flatMap(([k, list]) => list.map((a) => `${k}|${a.alias}`))
  const folder = [...swap.hits.map((h) => h.to), ...swap.spare]
  // **그림이고 「고정」으로 가려진 자리만** 본다 (8호 EN · MA 71개로 잰 것, `tool/onlygate.ts`).
  //   소리 · 애니   폴더에서 이름이 바뀌어 온다(`SL_ma_222_s1_nar01.mp3`) — 줄기로는 「없다」를 못 가려
  //                `ending_start` · `start02` · `particle` 따위 8개를 잘못 뺐다
  //   낱말 자리    `answer_three` 는 빠질 자리가 아니라 `answer_bicycle` 로 **바뀔** 자리다 (`slots.ts`)
  const fixedLike = new Set(judgeMisses(forge, code, module, swap).filter((j) => j.verdict === '고정').map((j) => `${j.kind}|${j.alias}`))
  const dropped = forge.reslot.originOnly(
    swap.misses.filter((m) => m.kind === 'image' && fixedLike.has(`${m.kind}|${m.alias}`)),
    folder,
    fixed,
    (alias) => usedInData(recipe.gameData, new Set([alias])),
    claimed,
    slots
  )
  for (const kind of new Set(dropped.map((d) => d.kind))) {
    const drop = new Set(dropped.filter((d) => d.kind === kind).map((d) => d.alias))
    recipe.assets![kind] = recipe.assets![kind].filter((a) => !drop.has(a.alias))
    dropKeys(forge, recipe.gameData, spec, kind, drop)
  }
  const gone = new Set(dropped.map((d) => `${d.kind}|${d.alias}`))
  swap.misses = swap.misses.filter((m) => !gone.has(`${m.kind}|${m.alias}`))
  return { dropped, gonePaths: dropped.map((d) => `assets.${d.kind}.${d.alias}`) }
}

/** 걸음에 적을 한 줄. */
export function originNote(dropped: OriginDrop[]): string {
  return (
    `원본에만 있고 이번 학습코드 폴더에는 없는 ${dropped.length}개 항목을 뺐습니다(` +
    dropped.map((d) => d.alias).join(', ') +
    '). 필요하면 되살리세요.'
  )
}
