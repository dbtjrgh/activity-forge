/**
 * **파일 이름을 원본 이름으로 바꾼다** — 이름이 다르게 온 파일을 그 자리에 쓸 때
 * (2026-09-23, 사용자 결정).
 *
 * 영상은 `MAL1M07W3S1_ani_v1.1.mp4`, 썸네일은 `수학_8호(M07)_3주_…_01.png` 로 온다.
 * 처음에는 AssetTable 이 그 이름을 그대로 가리키게 했는데(「코드로 해결」), 사람은
 * 그렇게 만들지 않는다 — **파일 이름을 `video.mp4`·`thumb.png` 로 바꿔 넣는다.**
 * 그래야 다음 회차도 이름 그대로 맞고, 호 저장소 폴더도 앞 회차와 같은 꼴이 된다.
 *
 * 바꾸는 것은 둘이다 —
 *   ① 이름 맞추기의 ⑥(하나뿐)이 짝지은 영상 → 원본 자리의 이름
 *   ② 사람이 카드에서 고른 파일 → 그 자리의 원본 이름. **그 답은 뺀다** — 이룬 답이다
 *
 * **리소스 작업 폴더(`rscRoot`)에서만 한다.** 호 저장소 안이면 남의 자리라 안 한다.
 * **덮어쓰지 않는다** — 그 이름의 파일이 이미 있으면 안 바꾸고 알린다.
 * 바꾼 뒤 크기를 다시 센다(저장소 CLAUDE.md 7번).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Answer } from '../../../shared/forge'
import type { Forge } from './runtime'
import type { Swap } from '@/gen/swap'
import type { Spec } from '@/gen/types'

export interface Renamed {
  renamed: { from: string; to: string }[]
  /** 그 이름의 파일이 이미 있어 안 바꾼 것 */
  clash: string[]
  failed: string[]
  /** 원본 이름 파일과 바이트까지 같아 치운 사본 */
  removed: string[]
  /** 이름 바꾸기로 이룬 답 · 낡은 답 — 뺄 것 */
  consumed: string[]
  note: string
}

export function settleNames(forge: Forge, code: string, swap: Swap, answers: Answer[], spec: Spec | null): Renamed {
  const out: Renamed = { renamed: [], clash: [], failed: [], removed: [], consumed: [], note: '' }
  // **스펙이 이름을 박아 둔 자리만** 바꾼다. 낱말 자리(`skirt` 자리에 `crayon.png`)는
  // 파일 이름이 곧 뜻이라 원본 이름으로 바꾸면 틀린다 — 그쪽은 자리 이름을 새 파일
  // 이름으로 세운다(`slots.ts`). 스펙을 못 읽었으면 아무것도 안 바꾼다.
  const fixed = new Set(
    (spec?.assets?.required ?? []).filter((r) => r.fixedAlias).map((r) => `${r.kind}|${r.alias}`)
  )
  const dir = forge.files.rscDir(code)
  if (!dir || !forge.files.rscRoot()) {
    out.note = '리소스 폴더가 정해지지 않아 파일 이름을 바꾸지 않았습니다.'
    return out
  }

  const plan: { from: string; to: string; answer?: string }[] = []
  // ① 영상 — 짝은 지었는데 이름이 다르다
  for (const h of swap.hits) {
    if (h.rule === 'only' && h.to !== h.from && fixed.has(`${h.kind}|${h.alias}`)) plan.push({ from: h.to, to: h.from })
  }
  // ② 카드에서 고른 파일 — `assets.<갈래>.<별칭>` 에 폴더 파일 이름이 답으로 왔다.
  // **맞춰진 자리(hit)의 답도 본다** (2026-09-23). 영상을 카드에서 고른 답이 남아, 이름을
  // `video.mp4` 로 바꾼 뒤에도 그 답이 AssetTable 을 **옛 이름으로 되돌렸다** — 없는 파일을
  // 가리키니 카드가 다시 떴고, 사람이 같은 파일을 또 넣어 사본이 쌓였다.
  const target = (kind: string, alias: string): string | undefined =>
    swap.misses.find((x) => x.kind === kind && x.alias === alias)?.file ??
    swap.hits.find((x) => x.kind === kind && x.alias === alias)?.from
  for (const a of answers) {
    const m = /^assets\.(image|sound|lottie)\.(.+)$/.exec(a.path)
    if (!m || typeof a.value !== 'string' || !fixed.has(`${m[1]}|${m[2]}`)) continue
    const to = target(m[1] as string, m[2] as string)
    if (to && a.value !== to) plan.push({ from: a.value, to, answer: a.path })
  }

  for (const p of plan) {
    const src = path.join(dir, ...p.from.split('/'))
    const dst = path.join(dir, ...p.to.split('/'))
    // **원본 이름 파일이 이미 있으면 그 답은 낡은 것이다** — 빼고, 가리키던 파일이 그것과
    // 바이트까지 같으면 **사본이라 치운다**(같은 내용이 둘이라 잃는 것이 없다).
    if (fs.existsSync(dst)) {
      if (p.answer) out.consumed.push(p.answer)
      if (fs.existsSync(src) && sameBytes(src, dst)) {
        fs.rmSync(src)
        out.removed.push(p.from)
      } else if (fs.existsSync(src)) out.clash.push(p.to)
      continue
    }
    if (!fs.existsSync(src)) continue
    try {
      const bytes = fs.statSync(src).size
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      fs.renameSync(src, dst)
      if (fs.statSync(dst).size !== bytes) throw new Error('이름을 바꾼 뒤 파일 크기가 다릅니다.')
      out.renamed.push({ from: p.from, to: p.to })
      if (p.answer) out.consumed.push(p.answer)
    } catch (error) {
      out.failed.push(`${p.from}(${error instanceof Error ? error.message : String(error)})`)
    }
  }

  out.note = out.renamed.length
    ? `${out.renamed.length}개 파일을 원본 이름으로 바꿨습니다: ${out.renamed.map((r) => `${r.from} → ${r.to}`).join(', ')}.`
    : '바꿀 이름이 없습니다.'
  if (out.removed.length) out.note += ` 같은 내용의 사본을 삭제했습니다: ${out.removed.join(', ')}.`
  if (out.clash.length) out.note += ` 같은 이름이 이미 있어 바꾸지 않았습니다: ${out.clash.join(', ')}.`
  if (out.failed.length) out.note += ` 이름을 바꾸지 못했습니다: ${out.failed.join(', ')}.`
  return out
}

/** 두 파일이 바이트까지 같은가. 크기가 다르면 읽지도 않는다. */
function sameBytes(a: string, b: string): boolean {
  if (fs.statSync(a).size !== fs.statSync(b).size) return false
  return fs.readFileSync(a).equals(fs.readFileSync(b))
}
