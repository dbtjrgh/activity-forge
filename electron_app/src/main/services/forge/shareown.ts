/**
 * **기획서 소리 이름을 이 학습코드의 공유 폴더 자리에서 찾기** (2026-10-23, 공유 폴더 전수 조사의 K1 · M4a · M2 — `sharefetch.ts` 가 부른다).
 *
 * `sharepick.ts` `pickSounds` 는 이름 주인 학습코드의 자리에서 찾는다. 그 밖에 완성본이 쓴 소리가 두 가지 있었다 —
 * - **다른 번호 이름**(`near`) — 기획서가 적은 다른 학습코드 번호 이름 가운데 `planreuse.ts` 규칙이 안 받은 것(대개 한 주 늦은 번호, 다른 레벨 번호).
 *   **이 학습코드 폴더(`sharerule.ts` `ownSoundDir`)에서** 찾는다 — 기획서 PDF 에 다른 시트 이름이 같이 실려 와서 이름 주인 자리에서 찾으면
 *   안 쓰는 소리가 들어온다(2026-11-04 부터 같은 호의 앞선 학습코드가 주인이면 그 폴더도 본다 — `pickNear`). 완성본으로 잼 — 국어 114개 / 16 학습코드, 수학 39개 / 6. 그 폴더들의 다른 번호 이름 가운데 완성본이 안 쓴 것은
 *   국어 342개 중 5, 수학 86개 중 25
 * - **수학 숫자 읽기 이름**(`shared`, `SL_ma_main_` · `inc_` · `sel_`) — 이름에 학습코드 번호가 없어 주인을 모른다. 이 학습코드 폴더, 없으면 숫자 읽기
 *   공통 폴더(`numberSpot`)에서 **이름으로만** 찾는다. 공통 폴더를 통째로 가져오면 학습코드마다 200개 가운데 대부분이 안 쓰는 것이다
 *   (완성본 1,521개 / 73 학습코드가 이 이름이고, 폴더째면 안 쓰는 것이 62,879개)
 * - **합본 이름**(`joined`, `nar10-11`) — 기획서가 낱개 둘을 줄표로 이어 적으면 낱개 둘과 함께 합본 이름도 이름 주인 폴더에서 찾는다.
 *   공유 폴더에는 수학 M01 일곱 개뿐이고 낱개 판은 없다. 완성본(MAL1M01W1S2 · MAL1M11W1S1)도 합본 이름을 썼다
 * 못 찾은 이름은 말없이 뺀다 — 다른 시트 이름일 수 있어 「없음」으로 세지 않는다. 다 못 읽었으면 찾기 전체의 `truncated` 가 알린다.
 * 리소스 폴더나 호 저장소에 같은 이름이 이미 있으면 안 가져온다(`sharepick.ts` 와 같다).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { homeOf } from './planreuse'
import type { Hit } from './sharefind'
import { byKey, empty, listAll, oneOf, put, type Ctx, type Picked } from './sharepick'
import { AUDIO, numberSpot, ownSoundDir, soundSpots } from './sharerule'

/** 이미 있는 이름은 세고, 찾을 이름만 돌려준다 */
function todoOf(c: Ctx, out: Picked, names: string[]): string[] {
  return names.filter((n) => {
    if (!c.have.has(n.toLowerCase())) return true
    out.have += 1
    return false
  })
}

/** 찾은 것 가운데 그 이름 하나를 담는다 — 그 이름이 있었으면 true */
function take(c: Ctx, out: Picked, name: string, found: Map<string, Hit[]>): boolean {
  const cands = found.get(name.toLowerCase()) ?? []
  if (!cands.length) return false
  const got = oneOf(cands, undefined)
  if (typeof got === 'string') out.miss.push({ name, why: got })
  else put(c, out, 'sound', got, c.code, 'share')
  return true
}

/**
 * 기획서가 적은 다른 번호 이름 — 이 학습코드 폴더, 없으면 **같은 호에서 앞선 학습코드**인 이름 주인 폴더(국어 · 수학).
 * 2026-11-04 — KOL2M09W2S2 기획서의 정답 소리 `SL_ko_133_s1_nar02 · 03`(9호 Lv1 1주)은 「기존」 표시가 표 칸에서 떨어져 `near` 로만 남았고,
 * 이 학습코드 폴더(Lv2 2주 말하기)에는 없어 Claude 가 사람에게 넣어 달라고 했다. 이름 주인 폴더에는 있었다.
 * 다른 시트 이름이 섞이는 것은 대개 뒤 시트라, 주인이 같은 호 · 같은 과목이고 주 · 세션이 이 학습코드보다 앞설 때만 주인 폴더를 본다 —
 * 기획서 이름이 있는 38개로 재 보니 새로 가져올 이름 2개, 둘 다 완성본이 쓴 소리였다
 */
export async function pickNear(c: Ctx, names: string[]): Promise<Picked> {
  const out = empty()
  const s = c.forge.spec.parseStudyCode(c.code)
  if (!s || (s.subject !== 'KO' && s.subject !== 'MA')) return out
  let todo = todoOf(c, out, names)
  if (!todo.length) return out
  const found = byKey((await listAll(c, soundSpots(c.root, s), (h) => AUDIO.test(h.rel) && ownSoundDir(h.rel, s))).hits)
  todo = todo.filter((n) => !take(c, out, n, found))

  const byHome = new Map<string, string[]>()
  for (const n of todo) {
    const home = homeOf(n)
    const h = home ? c.forge.spec.parseStudyCode(home) : null
    const earlier = h && (h.week < s.week || (h.week === s.week && h.session < s.session))
    if (home && h && h.subject === s.subject && h.month === s.month && earlier) byHome.set(home, [...(byHome.get(home) ?? []), n])
  }
  for (const [home, list] of byHome) {
    const h = c.forge.spec.parseStudyCode(home)
    if (!h) continue
    const there = byKey((await listAll(c, soundSpots(c.root, h), (x) => AUDIO.test(x.rel) && ownSoundDir(x.rel, h))).hits)
    for (const n of list) {
      const before = out.picks.length
      take(c, out, n, there)
      // 이 자리에서 찾은 것은 표시한다 — 화면 · 가져온 기록이 「들어 보세요」로 알린다
      for (const p of out.picks.slice(before)) p.near = true
    }
  }
  return out
}

/**
 * 기획서가 낱개 둘을 줄표로 이어 적은 합본 이름(`nar10-11`, `plannames.ts` `joinedParts`) — 이름 주인 학습코드 폴더에 있을 때만.
 * 낱개 둘은 `pickSounds` 가 따로 찾는다. 합본을 고르면 낱개 둘의 「없음」은 `sharefetch.ts` 가 뺀다
 */
export async function pickJoined(c: Ctx, names: string[]): Promise<Picked> {
  const out = empty()
  const byHome = new Map<string, string[]>()
  for (const n of todoOf(c, out, names)) {
    const home = homeOf(n)
    if (home) byHome.set(home, [...(byHome.get(home) ?? []), n])
  }
  for (const [home, list] of byHome) {
    const s = c.forge.spec.parseStudyCode(home)
    if (!s) continue
    const found = byKey((await listAll(c, soundSpots(c.root, s), (h) => AUDIO.test(h.rel))).hits)
    for (const n of list) take(c, out, n, found)
  }
  return out
}

/** 수학 숫자 읽기 이름 — 이 학습코드 폴더, 없으면 숫자 읽기 공통 폴더에서 이름으로만 */
export async function pickShared(c: Ctx, names: string[]): Promise<Picked> {
  const out = empty()
  const s = c.forge.spec.parseStudyCode(c.code)
  if (!s || s.subject !== 'MA') return out
  let todo = todoOf(c, out, names)
  for (const spots of [soundSpots(c.root, s), [numberSpot(c.root)]]) {
    if (!todo.length) break
    const found = byKey((await listAll(c, spots, (h) => AUDIO.test(h.rel))).hits)
    todo = todo.filter((n) => !take(c, out, n, found))
  }
  return out
}
