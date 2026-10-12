/**
 * **빠진 부품은 빈 그림으로** (2026-09-23).
 *
 * 몸·팔로 나눠 쓰는 캐릭터는 여섯 자리가 다 있어야 합니다(`parts.ts`). 그런데
 * **팔은 정답일 때만 그림이 있는 것이 보통입니다** — 가만히 있을 때와 틀렸을
 * 때는 팔이 없습니다. 그래서 폴더에 `character_N_arm_idle.png` 같은 파일이
 * 아예 안 들어옵니다.
 *
 * 그 자리를 비워 두면 **에러도 카드도 없이 팔만 안 보입니다.** 스펙 규칙
 * `character-parts-consistent` 가 「없습니다」라고 짚기는 하는데, **무엇을
 * 넣으라고는 말하지 않습니다.** 짚기만 하는 규칙은 사람이 손으로 채워야 합니다.
 *
 * **완성본이 답을 갖고 있습니다 — 재 봤습니다** (`forge/src/tool/emptypart.ts`).
 * 몸·팔을 쓰는 완성본 13개에서, 제 이름의 파일이 폴더에 없는 부품 자리가
 * **36개**였고 **36개 전부 `empty.png`** 였습니다. 예외가 없습니다.
 *
 * 그래서 빗장이 셋뿐입니다.
 *
 *   ① 스펙 규칙이 **그 별칭을 빠졌다고 부른다** (`missingParts`)
 *   ② 폴더에 **제 이름의 파일이 없다** — 있으면 그것을 써야 하고, 자리를 세우는
 *      일은 `familyadd.ts` 몫입니다. 여기가 먼저 채우면 그 길을 막습니다
 *   ③ 폴더에 **`empty.png` 가 있다** — 없으면 넣을 것이 없습니다. 짐작해서
 *      아무 그림이나 넣지 않습니다(저장소 규칙 6)
 *
 * **`empty.png` 를 `spare` 에서 빼지 않습니다.** 한 장을 열두 자리가 같이 쓰는
 * 그림이라 「가져갔다」고 셈할 것이 아닙니다 — 빼면 다음 자리가 못 씁니다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Forge } from './runtime'
import type { Swap } from '@/gen/swap'

type Asset = { alias: string; file: string; base?: string }

/** 부품 그림이 놓이는 자리. 레시피의 `base` 와 같은 말입니다. */
const BASE = 'images'
const EMPTY = 'empty.png'

export interface PartFill {
  /** 새로 세운 별칭 */
  added: string[]
  /** 폴더에 제 파일이 있어서 손대지 않은 것 — `familyadd` 가 볼 자리입니다 */
  hasFile: string[]
  /** `empty.png` 가 폴더에 없어 못 채운 것 */
  noEmpty: string[]
}

/**
 * 빠진 부품 자리를 세워 `empty.png` 를 가리키게 합니다. **레시피를 그 자리에서
 * 고칩니다** — 아래 걸음이 바뀐 것을 그대로 보게 하려는 것입니다.
 *
 * @param code 이 회차. 폴더를 훑는 데 씁니다.
 */
export function fillEmptyParts(forge: Forge, swap: Swap, code: string): PartFill {
  const out: PartFill = { added: [], hasFile: [], noEmpty: [] }
  const recipe = swap.recipe as { assets?: Record<string, Asset[]> }
  const mine = recipe.assets?.image ?? []
  const missing = forge.parts.missingParts(mine.map((a) => a.alias))
  if (!missing.length) return out

  // **폴더를 통째로 봅니다.** `spare` 는 아무도 안 가져간 것뿐이라, 이미 임자가
  // 있는 `empty.png` 가 거기 없을 수 있습니다 — 그래도 쓸 수 있는 그림입니다.
  const here = new Set<string>()
  for (const f of forge.files.listFiles(code)?.files ?? []) {
    if (f.base === BASE) here.add(f.name.toLowerCase())
  }
  if (!here.size) return out

  const made: Asset[] = []
  for (const alias of missing) {
    if (here.has(`${alias.toLowerCase()}.png`)) {
      out.hasFile.push(alias)
      continue
    }
    if (!here.has(EMPTY)) {
      out.noEmpty.push(alias)
      continue
    }
    made.push({ alias, file: EMPTY, base: BASE })
    out.added.push(alias)
  }
  if (!made.length) return out

  // **지금 들어 있는 것에 더합니다** (`family.ts` 에서 밟은 함정과 같은 자리).
  recipe.assets = recipe.assets ?? {}
  recipe.assets.image = [...(recipe.assets.image ?? []), ...made]
  return out
}

/** 걸음에 적을 한 줄. 아무것도 안 채웠으면 빈 글입니다. */
export function fillNote(fill: PartFill): string {
  const bits: string[] = []
  if (fill.added.length) {
    bits.push(`몸과 팔로 나뉜 캐릭터에서 빠진 ${fill.added.length}개 항목을 빈 그림으로 채웠습니다.`)
  }
  // **못 채운 것은 숨기지 않습니다**(저장소 규칙 6). 사람이 `empty.png` 를
  // 폴더에 넣어 주면 다음 바퀴에 채워집니다.
  if (fill.noEmpty.length) {
    bits.push(`${fill.noEmpty.length}개 항목은 폴더에 ${EMPTY} 파일이 없어 채우지 못했습니다.`)
  }
  return bits.join(' ')
}
