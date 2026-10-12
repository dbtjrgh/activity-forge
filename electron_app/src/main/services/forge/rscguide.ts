/**
 * **받을 리소스 창** — 앞 학습코드가 쓴 리소스와 이번 폴더의 형편 (2026-09-30, 사용자 요청).
 *
 * 사람이 앞 학습코드 폴더를 열어 무엇이 있었나 본 뒤 figma 에서 하나씩 내보냈다(「이 형식이 너무 불편하네」).
 * 이 창이 그 목록을 그림 · 크기와 함께 figma 옆에 띄운다. **이름은 안 붙여도 된다** — 크기(`sizematch.ts`) ·
 * AI(`match.ts`)가 맞추고 원본 이름으로 바꾼다(`rscname.ts`).
 *
 * - **읽기만 한다.** 복사 · 폴더 만들기 없음 — 창을 여는 것만으로 폴더에 무엇이 생기면 안 된다
 * - 원본 쪽(목록 · 크기 · 앱이 가져올 것)은 학습코드 · 원본마다 **한 번** 재 둔다 — 바이트 견주기가 비싸다.
 *   창이 몇 초마다 다시 묻는 것은 이번 폴더 쪽뿐이다(메인 스레드를 붙잡지 않게)
 * - 앱이 가져올 것은 가져오는 두 걸음과 **같은 셈**을 부른다 — 공용(`commonToCopy`) · 돌려 쓰는 파일(`carryable`)
 * - AI · 사람이 이 폴더의 파일로 정한 자리(`answer.json`)는 「정함」이다 — 이름도 크기도 다르게 온 것이 끝까지 「남음」으로 떠 있었다(2026-10-01, 9호 KOL1M08W2S2).
 *   2026-10-08 부터 앱에서 그 파일에 쓰는 곳은 「대사 성우」(`voiceset.ts`)뿐이다 — 대화는 `answer.json` 을 안 쓰므로 Claude 가 고른 파일은 「정함」이 안 된다
 * - 크기가 맞는 파일은 **실마리**다(`hint`). 같은 크기가 여럿이면 어느 것이 왔는지 모르니 묶음 수만 적는다.
 *   크기가 없는 소리 · 영상은 이름이 다른 파일의 **수**로만 본다
 * - 이번 폴더 파일 전부와 그 짝은 「넣은 리소스」로 같이 보낸다(`rscguidemine.ts`) — 무엇을 넣었나 보여야 빼먹은 것을 찾는다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import type { GuideItem, RscGuide } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { readAnswers } from './answer'
import { carryable } from './carryrsc'
import { originNow } from './originpick'
import { kindKey } from './rsccount'
import { placedFiles, type Placed } from './rscguidemine'
import { loadForge, type Forge } from './runtime'
import { isTalkCopy, sameVoice, talkSlots, voiceGated } from './voice'

type Base = Omit<GuideItem, 'state' | 'group' | 'pick'>
/** `slots` — 원본 자리(rel)마다 그 파일을 가리키는 레시피 자리(`image|img01`). 두 별칭이 한 파일을 가리킬 수 있다 */
type OriginSide = { module: string; origin: string; items: Base[]; slots: Map<string, string[]>; auto: Set<string>; dir: string; note: string }

/** forge `pngSize` 가 읽는 것 — 머리만 읽어 싸다 */
const PICTURE = /\.png$/i
const sides = new Map<string, OriginSide>()

function originSide(forge: Forge, code: string): OriginSide | string {
  // 만들 때 쓸 원본 그대로 — 크기로 바꾼 것까지(`originNow`). 창과 만들기가 다른 원본을 보면 엉뚱한 것을 내보낸다
  const pick = originNow(forge, code)
  if (typeof pick === 'string') return pick
  // 성우 성별이 정해지면 「앱이 가져올 것」이 바뀐다 — 열쇠에 넣는다 (`voice.ts`)
  const voiced = sameVoice(forge, code, pick.origin, pick.module) || !voiceGated(forge, code, pick.module)
  const key = `${code}|${pick.origin}|${voiced}`
  const hit = sides.get(key)
  if (hit) return hit
  const cloned = forge.api.clone(pick.origin, code)
  if (!cloned.ok) return cloned.error ?? '원본을 불러오지 못했습니다.'
  const dir = forge.common.rscOfDone(pick.origin)
  const talk = new Set([...talkSlots(forge, cloned.recipe, pick.origin).values()].map((r) => r.toLowerCase()))
  const items: Base[] = []
  const slots = new Map<string, string[]>()
  for (const [slot, rel] of forge.common.relOf(cloned.recipe)) {
    const had = slots.get(rel)
    slots.set(rel, [...(had ?? []), slot])
    if (had) continue // 두 별칭이 한 파일을 가리킨다
    const name = path.posix.basename(rel)
    const size = PICTURE.test(name) ? forge.png.pngSize(path.join(dir, rel)) : null
    const one: Base = { rel, name, kind: kindKey(name, slot.split('|')[0] ?? ''), w: size?.w ?? null, h: size?.h ?? null }
    items.push(talk.has(rel.toLowerCase()) ? { ...one, talk: true } : one)
  }
  items.sort((a, b) => a.rel.localeCompare(b.rel, 'en', { numeric: true }))

  const auto = new Set<string>()
  const mine = forge.files.rscDir(code)
  // 공용은 리소스 자리(rscRoot)를 정해 두었을 때만 가져온다 — `copyCommon` 과 같은 빗장
  if (mine && forge.files.rscRoot()) {
    for (const c of forge.common.commonToCopy(pick.origin, code, mine, pick.module)) if (voiced || !isTalkCopy(c.slot, c.to)) auto.add(c.to)
  }
  for (const c of carryable(forge, pick.origin, code, cloned.recipe)) auto.add(c.rel)

  const side = { module: pick.module, origin: pick.origin, items, slots, auto, dir, note: pick.fitNote }
  sides.set(key, side)
  return side
}

/**
 * AI · 사람이 정한 파일 — 레시피 자리(`image|img01`) → 이 폴더 안 경로. **폴더에 실제로 있는 것만** 센다(지운 파일을 정했다고 보이지 않게).
 * 레시피 자리가 아닌 답(`#` 로 시작)은 `assets.` 로 시작하지 않아 저절로 빠진다
 */
function picked(repoRoot: string, code: string, have: Set<string>): Map<string, string> {
  const out = new Map<string, string>()
  for (const a of readAnswers(repoRoot, code).answers) {
    const m = /^assets\.(\w+)\.(.+)$/.exec(a.path)
    if (!m || typeof a.value !== 'string' || !have.has(a.value.toLowerCase())) continue
    out.set(`${m[1]}|${m[2]}`, a.value)
  }
  return out
}

/** 아직인 그림을 크기로 묶어, 이름이 다르게 온 그림 가운데 크기가 맞는 수를 적는다 — 같은 크기 · 절반 · 두 배(`sizematch.ts` 와 같은 세 꼴) */
function sizeHints(items: GuideItem[], spare: Map<string, number>): void {
  const bySize = new Map<string, GuideItem[]>()
  for (const i of items) {
    if (i.state !== 'wait' || !i.w || !i.h) continue
    const k = `${i.w}x${i.h}`
    bySize.set(k, [...(bySize.get(k) ?? []), i])
  }
  for (const [size, group] of bySize) {
    const { w, h } = group[0] as { w: number; h: number }
    const keys = [size, w % 2 === 0 && h % 2 === 0 ? `${w / 2}x${h / 2}` : '', `${w * 2}x${h * 2}`].filter(Boolean)
    let got = 0
    for (const k of keys) {
      const take = Math.min(spare.get(k) ?? 0, group.length - got)
      got += take
      if (take) spare.set(k, (spare.get(k) ?? 0) - take)
    }
    if (!got) continue
    for (const i of group) {
      if (group.length > 1) i.group = { size: `${w}×${h}`, of: group.length, got }
      if (got === group.length) i.state = 'hint'
    }
  }
}

/**
 * 크기로 못 재는 것(소리 · 영상 · 로티) — 이름이 다른 파일이 **아직인 수만큼** 왔으면 실마리, 모자라면 몇 개 왔나만.
 * 9호 KOL1M08W1S3 은 소리가 새 이름으로 다 왔는데 원본 이름 다섯이 「남음」으로 떠 있었다.
 * **그림도 크기로 못 맞춘 나머지는 수로 센다** — 9호 KOL1M08W4S2 는 사진(1040×640)과 글자 그림이 원본(936×576 · 330×135)과
 * 다른 크기로 열 장 다 왔는데 「남은 항목 17」이었다. 크기 묶음(`group`)이 이미 붙은 그림은 그 말을 그대로 둔다
 */
function countHints(items: GuideItem[], spare: Map<string, number>): void {
  for (const [kind, all] of spare) {
    let got = all
    const waiting = items.filter((i) => i.kind === kind && i.state === 'wait' && !(kind === 'image' && i.group))
    // **이닝 낱말이 먼저** (2026-10-02) — 새로 온 소리는 대개 이닝 낱말이다. 대사는 앞 호 것을 돌려 쓰는 일이 많아(9호 K36 은 5개만 왔다)
    // 한데 세면 「7개 중 5개」로 어느 것이 빠졌는지 안 보였다. 대사는 받을 리소스 창의 「대사 성우」 칸에서 고른다
    for (const part of [waiting.filter((i) => !i.talk), waiting.filter((i) => i.talk)]) {
      if (!part.length || got <= 0) continue
      for (const i of part) {
        if (got >= part.length) i.state = 'hint'
        else if (part.length > 1) i.group = { size: '', of: part.length, got }
        if (kind === 'image') i.byCount = true
      }
      got -= part.length
    }
  }
}

export async function rscGuide(code: string): Promise<RscGuide> {
  const blank: RscGuide = { code, module: '', origin: '', items: [], mine: [], dir: '', exists: false }
  try {
    const forge = await loadForge()
    const side = originSide(forge, code)
    if (typeof side === 'string') return { ...blank, error: side }
    const listing = forge.files.listFiles(code)
    const files = listing?.files ?? []
    const dir = listing?.dir ?? ''
    // 이번 폴더 파일 하나씩 — 그림은 크기까지(머리만 읽어 싸다). 「넣은 리소스」와 아래 실마리가 같이 쓴다
    const placed: Placed[] = files.map((f) => {
      const rel = f.base === 'root' ? f.name : `${f.base}/${f.name}`
      const s = f.kind === 'image' && PICTURE.test(f.name) ? forge.png.pngSize(path.join(dir, rel)) : null
      return { rel, name: path.basename(f.name), kind: kindKey(f.name, f.kind), w: s?.w ?? null, h: s?.h ?? null }
    })
    const names = new Set(placed.map((f) => f.name.toLowerCase()))
    const pick = picked(forge.paths.REPO_ROOT, code, new Set(placed.map((f) => f.rel.toLowerCase())))
    const taken = new Set([...pick.values()].map((v) => v.toLowerCase()))
    const known = new Set(side.items.map((i) => i.name.toLowerCase()))
    // 이름이 다르게 온 그림의 크기 — 원본 이름과 같은 파일은 이미 제 짝이 있다
    const spare = new Map<string, number>()
    // 그림이 아닌 것은 갈래마다 수만
    const spareKind = new Map<string, number>()
    for (const f of placed) {
      if (known.has(f.name.toLowerCase())) continue
      if (taken.has(f.rel.toLowerCase())) continue // 정한 자리가 있는 파일은 실마리로 다시 세지 않는다
      spareKind.set(f.kind, (spareKind.get(f.kind) ?? 0) + 1)
      if (f.w && f.h) spare.set(`${f.w}x${f.h}`, (spare.get(`${f.w}x${f.h}`) ?? 0) + 1)
    }
    const items: GuideItem[] = side.items.map((i) => {
      if (names.has(i.name.toLowerCase())) return { ...i, state: 'name' }
      const chosen = (side.slots.get(i.rel) ?? []).map((s) => pick.get(s)).find(Boolean)
      if (chosen) return { ...i, state: 'set', pick: chosen }
      return { ...i, state: side.auto.has(i.rel) ? 'auto' : 'wait' }
    })
    sizeHints(items, spare)
    // 그림은 크기 실마리가 쓰고 남은 수만 — 크기로 짝지은 파일을 수로 또 세지 않는다
    spareKind.set('image', [...spare.values()].reduce((a, b) => a + b, 0))
    countHints(items, spareKind)
    return { code, module: side.module, origin: side.origin, originNote: side.note, items, mine: placedFiles(placed, items, side.slots, pick), dir, exists: listing?.exists ?? false }
  } catch (error) {
    return { ...blank, error: toMessage(error) }
  }
}

/** 썸네일을 그릴 원본 폴더 — 창이 먼저 `rscGuide` 를 불렀으면 재 둔 것을 쓴다 */
export async function guideOriginDir(code: string): Promise<string | null> {
  const side = originSide(await loadForge(), code)
  return typeof side === 'string' ? null : side.dir
}
