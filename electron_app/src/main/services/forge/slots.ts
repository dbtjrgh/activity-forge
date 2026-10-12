/**
 * **자리가 갈리는 것** — 이름으로 못 맞춘 자리를 가리고, 낱말 자리를 새로 세운다.
 *
 * 지금까지 양산기는 못 맞춘 자리를 전부 「이 이름의 파일을 폴더에 넣어 주세요」로
 * 물었다. 그런데 8호 76차시를 재 보니 못 맞춘 2,540자리 가운데 **1,562(61%)가
 * 이 회차에는 아예 없어지는 자리**였다 — 6호는 `skirt`·`tshirt` 이고 8호는
 * `fork`·`crayon` 이다. `skirt.png` 를 달라는 것은 **답이 없는 물음**이라,
 * AI 도 사람도 「맞출 짝이 하나도 없습니다」밖에 답할 수 없다.
 *
 * 그래서 묻기 전에 **가린다** (`forge/src/gen/reslot.ts`).
 *
 *   고정   모듈이 그 이름으로 찾는 자리 — 리소스를 달라고 한다 (지금까지와 같다)
 *   낱말   이 회차에는 없어질 자리 — **파일을 달라는 것이 아니라 자리를 세운다**
 *   개수·모름   짐작하지 않고 사람에게 묻는다
 *
 * 세우는 일은 `restock.ts` 가 한다 — `assets` 의 별칭과 `gameData` 안의 이름을
 * **한 레시피 안에서 같이** 바꾼다. 한쪽만 바꾸면 `alias-exists-in-assettable`
 * 로 막힌다.
 *
 * **차례는 여기서 짐작하지 않는다.** 어느 낱말이 몇 번째인지는 파일 이름에
 * 없다(8호도 알파벳순이 아니었다). 사람이 카드에서 고르거나, figma 스샷을 본
 * AI 가 정해 준 것을 받는다.
 *
 * 아직 안 세워진 자리를 카드로 내는 일은 `slotask.ts` 에 있다.
 */

import type { Answer } from '../../../shared/forge'
import { parseSlotPath, slotPath } from '../../../shared/forge'
import { applyAnswers } from './answer'
import { fieldAt } from './field'
import { nameInBase } from './rscplace'
import type { Forge } from './runtime'
import type { SlotJudge } from '@/gen/reslot'
import type { Recast } from '@/gen/restock'
import type { AssetKind, Spec } from '@/gen/types'
import type { Swap } from '@/gen/swap'

/** 못 맞춘 자리마다 갈래를 가린다. 넘어지면 빈 배열이다 — 양산을 여기서 멈추지 않는다. */
export function judgeMisses(forge: Forge, code: string, module: string, swap: Swap): SlotJudge[] {
  try {
    return forge.reslot.judgeSlots(code.slice(0, 2), module, code, swap.misses)
  } catch {
    // 가리지 못하면 지금까지처럼 전부 「리소스를 주세요」로 간다. 나빠지는 것은
    // 없다 — 이 판정은 **묻는 말을 고르는** 데만 쓰이기 때문이다.
    return []
  }
}

/**
 * 사람이 고른 파일로 **낱말 자리를 새로 세운다.** 레시피를 갈아 끼우고 무엇이
 * 바뀌었는지 돌려준다.
 *
 * **답이 없으면 아무것도 안 한다.** 폴더에 남은 파일로 차례를 짐작하지 않는다.
 */
export function restockSlots(
  forge: Forge,
  swap: Swap,
  judged: SlotJudge[],
  answers: Answer[],
  spec: Spec | null,
  code: string
): { casts: Recast[]; assets: number; data: string[]; unsure: string[]; missed: string[]; kept: string[]; renamed: string[] } {
  const chosen = new Map<string, string>()
  for (const a of answers) {
    const at = parseSlotPath(a.path)
    if (at && typeof a.value === 'string' && a.value.trim()) chosen.set(`${at.kind}|${at.alias}`, a.value.trim())
  }
  // **파일만 답한 꼴(`assets.<갈래>.<별칭>`)도 이름을 볼 수 있게 모은다** (2026-09-29, M3).
  // AI 맞추기는 늘 이 꼴로 답한다. 전에는 `#slot` 꼴만 여기 와서, MAL2M07W2S1 의
  // `character_0_idle ← character_0_body_idle.png` 가 이름을 둔 채 파일만 갈렸다 —
  // 완성본은 `character_0_body_idle` 이고, 09-28 사람 답 0 판에서 18자리가 다 그랬다.
  // 이 꼴은 **이름을 바꿀 때만** 여기서 쓴다. 둘 때는 아래 「사람이 정한 값」이 얹는다.
  const byFile = new Map<string, string>()
  for (const a of answers) {
    const m = /^assets\.([a-z]+)\.(.+)$/.exec(a.path)
    if (m && typeof a.value === 'string' && a.value.trim() && !chosen.has(`${m[1]}|${m[2]}`)) byFile.set(`${m[1]}|${m[2]}`, a.value.trim())
  }

  const casts: Recast[] = []
  const missed: string[] = []
  const took = new Set<string>()
  for (const j of judged) {
    if (j.verdict !== '낱말') continue
    const file = chosen.get(`${j.kind}|${j.alias}`)
    if (!file) continue
    took.add(`${j.kind}|${j.alias}`)
    // 화면이 보여 주는 이름에는 폴더가 붙어 있다(`images/crayon.png`). 레시피의
    // `file` 은 그 폴더 안에서의 이름이다 — `answer.ts` 와 같은 사정이다.
    const name = nameInBase(file)
    casts.push({ from: j.alias, to: forge.restock.aliasOf(name), file: name, kind: j.kind })
  }

  // **도구가 「낱말 자리」로 가리지 못한 것도 답이 오면 세운다** (2026-09-17).
  //
  // 여태는 `judged` 에 든 자리만 세웠다. 그런데 도구가 **이름으로 맞춰 버린**
  // 자리는 못 맞춘 것이 아니라 `judged` 에 안 들어온다 — 짝이 틀렸어도 그렇다.
  // 8호 `ENL1M07W3S2` 를 재 보니 AI 가 별칭 **36개를 갈아 끼워야** 완성본이
  // 되는데(`paper_skirt` → `paper_crayon`), 그 자리들이 전부 여기 못 들어와서
  // 답이 **한 개도 안 먹고 있었다.**
  //
  // **없는 별칭은 여전히 안 만든다.** 레시피에 있는 자리만 갈아 끼운다 —
  // 짐작해서 모듈이 안 읽는 자리를 만드는 것이 제일 나쁜 실패다.
  //
  // **이름을 바꾸지 않고 파일만 가는 자리가 있다** (2026-09-23). 모듈이 그 이름을
  // 코드에 박아 두고 찾는 자리(M05 의 `particle`)를 바꾸면 조용히 깨진다 —
  // 가름과 잰 값은 `forge/src/gen/rolename.ts` 머리말에. 스펙을 모르면 가를 수
  // 없으니 **두는 쪽**이다(잘못 두면 이름만 다르고, 잘못 바꾸면 깨진다).
  const assets = (swap.recipe as { assets?: Record<string, { alias: string }[]> }).assets ?? {}
  const originFile = new Map<string, string>()
  for (const h of swap.hits) originFile.set(`${h.kind}|${h.alias}`, h.from)
  for (const m of swap.misses) originFile.set(`${m.kind}|${m.alias}`, m.file)
  const inUse = spec ? forge.rolename.namesInUse(spec.subject, spec.module, [code, swap.from]) : null
  const fileOnly: Answer[] = []
  const has = (kind: string, alias: string): boolean => (assets[kind] ?? []).some((a) => a.alias === alias)
  // 같은 파일로 가는 자리를 셀 때는 두 꼴을 같이, **표에 아직 있는 자리만** 본다
  const claims = [...chosen, ...byFile].filter(([k]) => has(k.split('|')[0], k.split('|')[1]))
  const clashOf = (kind: string, name: string, to: string): boolean =>
    has(kind, to) || claims.filter(([k, f]) => k.startsWith(`${kind}|`) && nameInBase(f) === name).length > 1
  for (const [key, file] of byFile) {
    const [kind, alias] = key.split('|')
    if (!inUse || !has(kind, alias)) continue
    const name = nameInBase(file)
    const to = forge.restock.aliasOf(name)
    if (to === alias || forge.rolename.keepsName(alias, originFile.get(key) ?? '', inUse, { to, clash: clashOf(kind, name, to) })) continue
    casts.push({ from: alias, to, file: name, kind: kind as AssetKind })
  }
  for (const [key, file] of chosen) {
    if (took.has(key)) continue
    const [kind, alias] = key.split('|')
    if (!has(kind, alias)) {
      missed.push(slotPath(kind as AssetKind, alias))
      continue
    }
    const name = nameInBase(file)
    const to = forge.restock.aliasOf(name)
    // 부딪침 — 그 이름이 표에 이미 있거나, 같은 파일로 가는 자리가 또 있다
    const clash = clashOf(kind, name, to)
    if (!inUse || forge.rolename.keepsName(alias, originFile.get(key) ?? '', inUse, { to, clash })) {
      // 파일만 가는 것은 사람이 `assets.<갈래>.<별칭>` 에 답한 것과 같다 — 셈은 answer.ts 하나.
      fileOnly.push({ path: `assets.${kind}.${alias}`, value: name })
      continue
    }
    casts.push({ from: alias, to, file: name, kind: kind as AssetKind })
  }

  const root = spec?.gameData?.root ?? ''
  const kept = fileOnly.length ? applyAnswers(swap.recipe, fileOnly, root) : { put: 0, missed: [] }
  const keptNames = fileOnly.map((a) => a.path.replace(/^assets\./, '')).filter((p) => !kept.missed.includes(`assets.${p}`))

  if (!casts.length) return { casts, assets: 0, data: [], unsure: [], missed, kept: keptNames, renamed: [] }

  const got = forge.restock.recast(swap.recipe, casts, {
    // **갈래는 스펙이 안다.** `gameData` 에는 글자만 있어서 `skirt` 가 그림인지
    // 소리인지 알 길이 없다 — 짐작해서 바꾸면 조용히 틀린 액티비티가 나온다.
    kindAt: (path) => kindOfField(spec, path),
    // 열쇠로 이름을 부르는 표(`M05_Table.image`)도 스펙의 관계가 안다
    relations: spec?.relations ?? [],
    ...(root ? { root } : {})
  })
  // **바꾼 레시피를 그대로 밀어 넣는다.** `recast` 는 원본을 안 건드리고 새것을
  // 내놓으므로, 여기서 갈아 끼우지 않으면 아래 걸음이 옛 이름을 그대로 본다.
  swap.recipe = got.recipe
  return {
    casts,
    assets: got.assets,
    data: got.data,
    unsure: got.unsure.map((u) => `${u.at} 항목의 "${u.name}"`),
    missed: [...missed, ...got.missed.map((m) => `${m.from}: ${m.why}`)],
    kept: keptNames,
    // 새 이름으로 세운 자리의 **옛 이름 답**. 두 꼴 어느 쪽으로 세웠든 옛 이름은 표에 없다.
    // 못 바꾼 이름은 빼서 「사람이 정한 값」이 파일만이라도 얹게 둔다
    renamed: casts.filter((c) => !got.missed.some((m) => m.from === c.from)).map((c) => `assets.${c.kind}.${c.from}`)
  }
}

/** 스펙이 그 자리를 `asset:image` 처럼 적어 두었으면 그 갈래. 아니면 null. */
function kindOfField(spec: Spec | null, path: string): AssetKind | null {
  if (!spec) return null
  const type = fieldAt(spec, path)?.type
  return typeof type === 'string' && type.startsWith('asset:') ? (type.slice(6) as AssetKind) : null
}
