/**
 * **칸을 자른 뒤 따라오는 것** — 그 칸만 쓰던 별칭(`dropOrphans`)과, 그 목록의 번호를
 * 들고 있던 옆 목록의 꼬리 칸(`followIndexes`) (2026-09-28).
 *
 * ENL3M07W3S1 — 거품(`chapter[1].bubble`)을 5→4칸으로 자르자 거품이 뜨는 때를 적은
 * `chapter[1].game` 은 5칸 그대로였고 `game[4].bubble = 4` 가 **없는 거품**을 가리켰다.
 * 칸 수를 묶을 수는 없다 — 완성본에서 `game` 칸 수가 거품 칸 수와 다른 회차가 있다(2호 b2g 6 대 5).
 *
 * 무엇이 무엇의 번호인지는 스펙이 안다 — `indexes` 관계 가운데 `beside`(옆 목록의 번호)이고
 * `each` 가 붙은 것. **가리키는 번호가 새 칸 수 이상인 칸이 꼬리에 몰려 있을 때만** 자른다.
 * 가운데 섞여 있으면 어느 칸을 뺄지 모르므로 두고, 관계 검사가 에러로 알린다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { escapeRe as esc } from '../../lib/regex'
import { valueAt } from './answer'
import { resizeAt, uniform, type Resize } from './cells'
import type { SpecRelation } from '@/gen/types'

type Assets = Record<string, { alias: string }[] | undefined>

function strings(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === 'string') out.add(v)
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out))
  return out
}

/** 지금 값 안에 든 글 전부 — 칸을 자르기 **전에** 떠 둔다(`dropOrphans` 가 견준다). */
export function namesIn(recipe: unknown): Set<string> {
  return strings((recipe as { gameData?: unknown }).gameData)
}

/**
 * **칸을 잘라 아무도 안 부르게 된 별칭을 덜어낸다** (2026-09-28). ENL3M07W3S1 거품을
 * 5→4칸으로 자르자 `icon05`·`word05` 가 AssetTable 에 남아 「파일을 주세요」가 그대로 떴다.
 * `familytrim.ts` 는 칸을 자르기 **전에** 돌고, GameData 가 부르는 동안은 손대지 않는다.
 *
 * **자르기 전에는 값이 불렀고 지금은 안 부르는 것만** 뺀다 — 원래 값에 없던 별칭(모듈이
 * 이름으로 찾는 것)은 안 건드린다. 스펙이 이름을 박아 둔 것(`keep`)도 안 건드린다.
 * 덜어낸 자리(`assets.<갈래>.<별칭>`)를 돌려준다 — 그 자리의 답은 부르는 쪽이 걷어낸다.
 *
 * **값만 본다 — 열쇠가 별칭인 표(M05 `M05_Button.image`)는 안 본다.** 값에도 나오고
 * 그런 표의 열쇠이기도 한 별칭을 덜면 열쇠가 남아 관계 검사(`isAlias` of:keys)가 에러로
 * 잡는다. 조용히 깨지지는 않지만, 그런 모듈에서 칸을 자르려면 `familytrim.ts` 의
 * `dropKeys` 를 같이 불러야 한다 (2026-09-28 에는 CreateSong 만 이 길을 탄다).
 */
export function dropOrphans(recipe: unknown, before: Set<string>, keep: Set<string>): string[] {
  const now = namesIn(recipe)
  const gone = new Set([...before].filter((n) => !now.has(n) && !keep.has(n)))
  const assets = (recipe as { assets?: Assets }).assets ?? {}
  const out: string[] = []
  for (const [kind, list] of Object.entries(assets)) {
    if (!list) continue
    for (const a of list) if (gone.has(a.alias)) out.push(`assets.${kind}.${a.alias}`)
    assets[kind] = list.filter((a) => !gone.has(a.alias))
  }
  return out
}

export function followIndexes(
  recipe: unknown,
  done: Resize[],
  relations: SpecRelation[],
  gameDataRoot: string
): Resize[] {
  const full = (p: string): string => (gameDataRoot ? `${gameDataRoot}.${p}` : p)
  const out: Resize[] = []
  for (const r of relations) {
    if (r.kind !== 'indexes' || !r.beside || !r.each?.endsWith('[]')) continue
    // `game[].bubble` 꼴만 — 칸 하나에 번호 하나
    const m = /^([^[\]]+)\[\]\.([^.[\]]+)$/.exec(r.pick)
    if (!m) continue
    const [, arrKey, field] = m as unknown as [string, string, string]
    const scopeRe = new RegExp(`^(${esc(full(r.each.slice(0, -2)))}\\[\\d+\\])\\.${esc(r.list)}$`)
    for (const d of done) {
      const hit = d.to < d.from ? scopeRe.exec(d.path) : null
      if (!hit) continue
      const at = `${hit[1]}.${arrKey}`
      const arr = valueAt(recipe, at, gameDataRoot)
      if (!Array.isArray(arr) || !uniform(arr)) continue
      const over = arr.map((c) => {
        const n = (c as Record<string, unknown> | null)?.[field]
        return typeof n === 'number' && n >= d.to
      })
      const k = over.indexOf(true)
      if (k < 1 || over.slice(k).some((x) => !x)) continue
      const got = resizeAt(recipe, at, k, gameDataRoot)
      if (got.ok) out.push(got.did)
    }
  }
  return out
}
