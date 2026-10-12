/**
 * **폴더에만 있고 자리가 없는 무리에 자리를 세운다** (2026-09-21).
 *
 * `family.ts` 는 이름 짜임이 바뀐 무리를 폴더 쪽으로 맞추고, `familytrim.ts` 는
 * 이 회차에 안 쓰는 자리를 덜어낸다. 둘 다 **원본에 있던 자리**를 손본다.
 * 여기는 반대다 — **원본에는 아예 없던 무리**가 폴더에 들어 있는 경우다.
 *
 * `MAL2M07W2S1` 이 그랬다. 원본(6호)은 캐릭터가 통그림 하나인데 이 회차는
 * **몸과 팔이 갈라져 있다** —
 *
 *   원본 자리     `character_0_idle` …            (몸·팔 구분 없음)
 *   이 회차 폴더  `character_0_body_idle` …
 *                 `character_0_arm_correct` …     ← **갈 자리가 없다**
 *
 * `body` 쪽은 AI 가 원본 자리에 짝지어 준다(이름이 닮았다). `arm` 쪽은
 * **짝지을 원본 자리 자체가 없어서** 여섯 장이 폴더에 남는다. 에러도 카드도
 * 안 나고 그림만 빠진 채 나간다 — 완성본(`MAL2M03W4S1`)에는 `arm_*` 별칭이
 * 따로 있고, 스펙 규칙(`character-parts-consistent`)도 몸·팔 여섯 상태가 다
 * 있어야 한다고 적어 두었다.
 *
 * **언제 세우나 — 여기가 이 파일의 핵심이다.**
 *
 * 재 보니 답이 없을 때(AI 를 부르기 전)는 「자리 없는 무리」가 **다섯**으로
 * 보인다 — `body_idle` · `body_correct` · `body_wrong` · 드럼 소리까지.
 * 그런데 그 넷은 **AI 가 곧 원본 자리에 짝지어 줄 것들**이다. 그때 자리를
 * 세워 버리면 파일이 이미 임자가 생겨 **AI 가 원본 자리를 못 채운다.**
 * 답이 있을 때 다시 재면 **하나만** 남는다 — 진짜로 갈 곳이 없는 `arm_correct`.
 *
 * 그래서 빗장이 넷이다.
 *
 *   ① 그 무리가 **두 장 이상**이다 (한 장짜리는 이름만으로 못 정한다)
 *   ② 원본 자리 가운데 그 무리를 쓰는 것이 **하나도 없다**
 *   ③ 받아 둔 답 가운데 그 무리를 가리키는 것이 **하나도 없다**
 *   ④ **같은 갈래에 받아 둔 답이 하나라도 있다** — AI 가 그 갈래를 이미 한 번
 *      보았다는 뜻이다. 이것이 「부르기 전에는 세우지 않는다」를 지키는 빗장이다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import type { Answer } from '../../../shared/forge'
import type { FamilyFix } from './family'
import { kindOf } from './briefslots'
import type { Forge } from './runtime'
import type { Swap } from '@/gen/swap'
import type { AssetKind } from '@/gen/types'

type Asset = { alias: string; file: string; base?: string }

/** 갈래마다의 바깥 폴더. `swap` 이 주는 파일 이름이 이 이름으로 시작한다. */
const BASE: Record<string, string> = { image: 'images', sound: 'sounds', lottie: 'animations' }

/**
 * 갈 자리가 없는 무리에 자리를 세운다. **레시피와 `swap` 을 그 자리에서 고친다** —
 * 아래 걸음이 바뀐 것을 그대로 보게 하려는 것이다.
 *
 * @param kept 받아 둔 답. 빗장 ③④ 가 이것을 본다.
 * @param pending 크기로 짝은 찾았는데 **차례만 남은 묶음**의 파일(`sizematch.ts`) — 원본 자리가 있는 파일이라 자리를 세우지 않는다.
 *   2026-09-30, 9호 KOL1M08W1S3 에서 스티커 차례 답을 비우자 그 15장으로 자리 13개가 새로 섰다
 */
export function addFolderOnly(forge: Forge, swap: Swap, kept: Answer[], pending: string[] = []): FamilyFix[] {
  const fam = forge.swap.familyOf
  const recipe = swap.recipe as { assets?: Record<string, Asset[]> }
  const fixes: FamilyFix[] = []

  // ② 원본 자리가 쓰는 무리
  const mine = new Set<string>()
  for (const [kind, list] of Object.entries(recipe.assets ?? {})) {
    const base = BASE[kind] ?? kind
    for (const a of list) mine.add(fam(`${a.base ?? base}/${a.file}`))
  }

  // ③④ 답이 가리키는 무리와, 답이 나온 갈래
  const claimed = new Set<string>()
  const answeredKinds = new Set<string>()
  for (const a of kept) {
    const m = /^assets\.([a-z]+)\./.exec(a.path)
    if (!m) continue
    answeredKinds.add(m[1])
    claimed.add(fam(String(a.value)))
  }

  // **이미 쓰이는 파일의 사본은 뺀다** (2026-09-29). `rscname.ts` 가 `Mask group-3.png` 를 원본 이름 `r_sticker3.png` 로
  // 복사해 두면 원래 이름 파일이 폴더에 남는다 — 9호 KOL1M08W1S3 에서 그 사본들로 자리 23개가 헛되이 세워졌다
  const usedPrints = new Set<string>()
  for (const [kind, list] of Object.entries(recipe.assets ?? {})) {
    const base = BASE[kind] ?? kind
    for (const a of list) {
      const p = forge.common.printOf(path.join(swap.dir, `${a.base ?? base}/${a.file}`))
      if (p) usedPrints.add(p)
    }
  }
  const waiting = new Set(pending)
  const fresh = swap.spare.filter((f) => {
    if (waiting.has(f)) return false
    const p = forge.common.printOf(path.join(swap.dir, f))
    return !p || !usedPrints.has(p)
  })

  // 폴더에 남은 파일을 무리별로
  const spare = new Map<string, string[]>()
  for (const f of fresh) spare.set(fam(f), [...(spare.get(fam(f)) ?? []), f])

  for (const [key, files] of spare) {
    if (files.length < 2) continue // ①
    if (mine.has(key) || claimed.has(key)) continue // ②③
    const kind = kindOf(files[0])
    if (!kind || !answeredKinds.has(kind)) continue // ④
    const base = BASE[kind]
    if (!base) continue
    // **한 무리가 여러 갈래면 손대지 않는다.** 이름이 같은데 확장자가 갈리는
    // 무리가 있다 — 어느 갈래로 세울지 모르면 세우지 않는다(저장소 규칙 6).
    if (files.some((f) => kindOf(f) !== kind)) continue

    const made: Asset[] = files
      .slice()
      .sort()
      .map((f) => {
        const name = f.startsWith(`${base}/`) ? f.slice(base.length + 1) : f
        return { alias: forge.restock.aliasOf(name), file: name, base }
      })
    // **지금 들어 있는 것에 더한다** (`family.ts` 에서 밟은 함정과 같은 자리).
    recipe.assets = recipe.assets ?? {}
    recipe.assets[kind] = [...(recipe.assets[kind] ?? []), ...made]
    swap.spare = swap.spare.filter((f) => !files.includes(f))
    fixes.push({
      kind: kind as AssetKind,
      from: '(원본에 없던 무리)',
      to: key,
      dropped: 0,
      added: made.length,
      gonePaths: []
    })
  }
  return fixes
}

/** 걸음에 적을 한 줄. 아무것도 안 세웠으면 빈 글이다. */
export function addNote(fixes: FamilyFix[]): string {
  if (!fixes.length) return ''
  const n = fixes.reduce((sum, f) => sum + f.added, 0)
  return (
    `원본에 없던 그룹에 항목 ${n}개를 새로 만들었습니다 (` +
    fixes.map((f) => `${f.to} ${f.added}개`).join(', ') +
    ').'
  )
}
