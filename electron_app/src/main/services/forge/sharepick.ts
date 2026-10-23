/**
 * **공유 폴더에서 무엇을 가져올지 고르기** — 기획서 소리 이름 · 학습코드 자리의 애니메이션 · 영상(2026-10-14, `sharefetch.ts` 에서 부른다).
 *
 * 고르는 규칙은 좁다(저장소 CLAUDE.md 6번 — 짐작해서 넣지 않는다) —
 * - **소리**는 기획서에 낱개로 적힌 이름만(다시 쓰는 다른 학습코드 이름은 `planreuse.ts` 규칙으로 거른 것). 이름 주인의 공유 폴더 자리에서 찾고,
 *   없으면 그 주인 학습코드의 앞 호 완성본(호 저장소)에서 찾는다(사용자 말 — 「없으면 전 호에 있는걸로」). 앞 호 소리 이름이 양쪽에 다 있던
 *   1,566개(M05~M08 완성본)는 1,480개가 양쪽 다 완성본과 크기가 같았고 공유 폴더만 맞은 것 19개 · 앞 호만 맞은 것 17개 · 둘 다 다른 것 50개였다 —
 *   그래서 공유 폴더를 먼저 본다. 같은 이름이 공유 폴더에 크기가 다르게 여럿이면(이 학습코드 몫 3,945개 중 10개) 앞 호 완성본과 크기가 같은 것이
 *   있을 때만 고른다 — 모르면 안 고른다
 * - **애니메이션**은 학습코드 자리 아래 `.json` 전부 — 다른 학습코드 이름이 붙은 것은 `rscplace.ts` 가 막는다(놓은 파일과 같은 규칙).
 *   그 안 `sounds/` 소리는 인터북 소리라 `animatecc/sounds/` 로(2026-10-23, `sharerule.ts` `isMotionSound`).
 *   기획서가 이름을 적은 다른 학습코드 로티는 그 학습코드의 공유 폴더 자리 · 완성본에서 찾는다. **못 찾은 이름은 말없이 뺀다** —
 *   로티 이름과 그림 이름이 같은 꼴이라(`mal2m08w1s3_bg`) 「없음」으로 세면 그림 이름이 다 「없음」이 된다.
 *   **그 학습코드 완성본 판이 공유 폴더 판과 크기가 다르면 완성본 판을 고른다**(2026-10-23 검산) — 국어 · 수학 완성본 이름을 기획서 이름처럼 넣어 보니
 *   그런 로티 259개 가운데 그 이름을 다시 쓴 완성본과 같은 것이 이름 주인 완성본 판 246개, 공유 폴더 판 8개였다
 *   (`Kor_L01_M01_W01_S01_effect_correct` — 공유 폴더 13,541 B 는 옛 판이고 KOL1M01W1S1 완성본과 뒤 호들은 14,119 B 를 썼다)
 * - **영상**은 같은 모듈 개발 완료 완성본이 모두 영상을 쓸 때만, 안내 영상을 빼고 — 액티비티 영상(`<학습코드>_ani…`)은 가장 높은 판 하나를
 *   `video.mp4` 로, 그 꼴이 아니면 하나일 때만 이름 그대로
 * - 리소스 폴더나 호 저장소(이 학습코드)에 **같은 이름이 이미 있으면 안 가져온다** — 사람이 넣은 판을 덮지 않는다
 * 공용 소리(`SL_ko_com_…`)는 고르지 않는다 — 대화를 시작할 때 앱이 원본에서 가져온다(`commonrsc.ts`).
 * 영어 소리와 스토리 영상은 기획서 이름이 없어 고르는 법이 달라 `shareen.ts` 에 있다(아래 도우미를 같이 쓴다).
 * 기획서 이름 가운데 이름 주인 자리 밖, 이 학습코드 폴더에서 찾는 것(다른 번호 이름 · 수학 숫자 읽기 이름)은 `shareown.ts`.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { ShareItem, ShareMiss } from '../../../shared/forge'
import { doneOf } from './chatothers'
import { homeOf, lottieHome } from './planreuse'
import { destOf } from './rscplace'
import type { Forge } from './runtime'
import { filesAt, localFiles, type Budget, type Hit, type Listed } from './sharefind'
import { AUDIO, cleanName, isMotionSound, keyOf, motionSoundTo, motionSpots, shortOf, soundSpots, type Spot, type Study } from './sharerule'
import { aniVersion, isGuideVideo, versionCmp, VIDEO_NAME } from './sharevideo'

const JSON_FILE = /\.json$/i

/** 고른 것 — 화면에 보일 것과 실제 파일 자리 */
export type Pick = ShareItem & { abs: string }
export type Picked = { picks: Pick[]; miss: ShareMiss[]; have: number }
/** 한 번 찾는 동안 같이 넘기는 것 — `have` 이미 있는 이름, `b` 상한 */
export type Ctx = { forge: Forge; code: string; root: string; have: Set<string>; b: Budget }

/** 이미 있는 이름 — 리소스 폴더 아래 전부와 호 저장소의 이 학습코드(만든 뒤 · 폴더 정리 뒤에는 거기에만 있다) */
export function haveOf(forge: Forge, code: string, dir: string): Set<string> {
  return new Set([...localFiles(dir), ...localFiles(doneOf(forge, code).rsc)].map((h) => keyOf(h.rel)))
}

const study = (forge: Forge, code: string): Study | null => forge.spec.parseStudyCode(code)
export const empty = (): Picked => ({ picks: [], miss: [], have: 0 })

/** 같은 이름 여럿 가운데 하나 — 크기가 다 같으면 첫 것, 갈리면 앞 호 완성본과 크기가 같은 것 하나일 때만 */
export function oneOf(cands: Hit[], hall: Hit | undefined): Hit | string {
  const sizes = new Set(cands.map((c) => c.bytes))
  if (sizes.size === 1) return cands[0]
  const same = hall ? cands.filter((c) => c.bytes === hall.bytes) : []
  if (same.length) return same[0]
  return `공유 폴더에 이름이 같고 크기가 다른 파일이 ${sizes.size}개 있어 고르지 않았습니다.`
}

/** 다 못 읽은 공유 폴더 자리에서 못 찾은 소리의 까닭 */
const UNSEEN = '공유 폴더를 다 확인하지 못해 찾지 않았습니다.'

/** 자리 여럿을 훑어 합친다 — 하나라도 다 못 읽었으면 `complete` 가 거짓 */
export async function listAll(c: Ctx, spots: Spot[], keep: (h: Hit) => boolean): Promise<Listed> {
  const out: Listed = { hits: [], complete: true }
  for (const spot of spots) {
    const got = await filesAt(spot, c.b)
    out.hits.push(...got.hits.filter(keep))
    out.complete &&= got.complete
  }
  return out
}

/** 이름별로 모으기 */
export function byKey(hits: Hit[]): Map<string, Hit[]> {
  const out = new Map<string, Hit[]>()
  for (const h of hits) out.set(keyOf(h.rel), [...(out.get(keyOf(h.rel)) ?? []), h])
  return out
}

/** 고른 파일 하나를 담는다 — 자리는 놓은 파일과 같은 규칙(`rscplace.ts`). `to` 를 주면 그 자리(기획서가 이름을 적은 로티 · 영상 이름 바꾸기) */
export function put(c: Ctx, out: Picked, kind: ShareItem['kind'], got: Hit, home: string, where: ShareItem['where'], to?: string): void {
  const name = cleanName(got.rel)
  const at = to ? { to } : destOf(c.code, { from: got.abs, rel: kind === 'lottie' ? `animations/${name}` : name, bytes: got.bytes }, c.forge)
  if ('why' in at) out.miss.push({ name, why: at.why })
  else out.picks.push({ name, kind, where, from: where === 'share' ? shortOf(got.abs, c.root) : home, to: at.to, bytes: got.bytes, abs: got.abs })
}

/** 기획서 소리 이름마다 — 이름 주인의 공유 폴더 자리, 없으면 그 주인의 앞 호 완성본 */
export async function pickSounds(c: Ctx, names: string[]): Promise<Picked> {
  const out = empty()
  const byHome = new Map<string, string[]>()
  for (const n of names) {
    if (c.have.has(n.toLowerCase())) out.have += 1
    else {
      const home = homeOf(n)
      if (home) byHome.set(home, [...(byHome.get(home) ?? []), n])
    }
  }
  for (const [home, list] of byHome) {
    const s = study(c.forge, home)
    const seen = await listAll(c, s ? soundSpots(c.root, s) : [], (h) => AUDIO.test(h.rel))
    const share = byKey(seen.hits)
    const hall = new Map(localFiles(doneOf(c.forge, home).rsc).filter((h) => AUDIO.test(h.rel)).map((h) => [keyOf(h.rel), h]))
    for (const n of list) {
      const cands = share.get(n.toLowerCase()) ?? []
      // 다 못 읽은 자리에서 못 찾은 것은 「없음」도 앞 호 판도 아니다 — 모른다(2026-10-15 검토)
      if (!cands.length && !seen.complete) {
        out.miss.push({ name: n, why: UNSEEN })
        continue
      }
      const back = hall.get(n.toLowerCase())
      const got = cands.length ? oneOf(cands, back) : back
      if (!got) out.miss.push({ name: n, why: `공유 폴더와 앞 호 완성본(${home}) 어디에도 없습니다.`, none: true })
      else if (typeof got === 'string') out.miss.push({ name: n, why: got })
      else put(c, out, 'sound', got, home, cands.includes(got) ? 'share' : 'hall')
    }
  }
  return out
}

/** 완성 애니 예시(`(ex)mal1m07w2s1_rmon_full.mp4` · `.json`) — 애니메이션 폴더에 같이 있지만 액티비티가 쓰는 파일이 아니다 */
const EXAMPLE = /(^|\/)\(ex\)/i

/** 이름마다 하나씩 담는다 — 이미 있으면 셈만, 같은 이름의 크기가 갈리면 까닭. `to` 를 주면 그 자리 */
export function putEach(c: Ctx, out: Picked, hits: Hit[], kind: ShareItem['kind'], to?: (rel: string) => string): void {
  for (const [key, cands] of byKey(hits)) {
    const got = c.have.has(key) ? null : oneOf(cands, undefined)
    if (!got) out.have += 1
    else if (typeof got === 'string') out.miss.push({ name: cleanName(cands[0].rel), why: got })
    else put(c, out, kind, got, c.code, 'share', to?.(got.rel))
  }
}

/** 학습코드 자리의 애니메이션(전부) · 그 안 인터북 소리 · 영상(`video` 일 때) — 로티 · 인터북 소리는 `04. 애니메이션`, 영상은 `06. 영상` 에서만 */
export async function pickMotion(c: Ctx, video: boolean): Promise<Picked> {
  const out = empty()
  const s = study(c.forge, c.code)
  const under = async (top: string): Promise<Hit[]> => (await listAll(c, s ? motionSpots(c.root, s, [top]) : [], (h) => !EXAMPLE.test(h.rel))).hits
  const motion = await under('04. 애니메이션')
  // 애니메이션 폴더 아래 `.json` 은 로티다 — 놓은 파일처럼 `animations/` 로 보내 다른 학습코드 이름만 막는다(안을 읽지 않는다)
  putEach(c, out, motion.filter((x) => JSON_FILE.test(x.rel)), 'lottie')
  putEach(c, out, motion.filter((x) => isMotionSound(x.rel)), 'sound', motionSoundTo)
  if (video) pickVideo(c, out, (await under('06. 영상')).filter((h) => /\.mp4$/i.test(h.rel) && !isGuideVideo(h.rel, c.code)))
  return out
}

/** 액티비티 영상 — `<학습코드>_ani…` 가 있으면 가장 높은 판을 `video.mp4` 로, 아니면 하나일 때만 이름 그대로 */
function pickVideo(c: Ctx, out: Picked, films: Hit[]): void {
  const ani = films
    .map((h) => ({ h, v: aniVersion(h.rel, c.code) }))
    .filter((x): x is { h: Hit; v: number[] } => x.v !== null)
    .sort((a, b) => versionCmp(b.v, a.v))
  if (ani.length) {
    // 사람이 공유 폴더 이름 그대로(`<학습코드>_ani….mp4`) 넣어 두었어도 이미 있는 것이다 — 수백 MB 를 한 번 더 넣지 않게(2026-10-15 검토)
    if (c.have.has(VIDEO_NAME) || ani.some((x) => c.have.has(keyOf(x.h.rel)))) out.have += 1
    else put(c, out, 'video', ani[0].h, c.code, 'share', VIDEO_NAME)
    return
  }
  const list = [...new Map(films.map((h) => [`${keyOf(h.rel)}|${h.bytes}`, h])).values()]
  if (list.some((h) => c.have.has(keyOf(h.rel)))) out.have += 1
  else if (list.length > 1) out.miss.push({ name: list.map((h) => cleanName(h.rel)).join(', '), why: `영상이 ${list.length}개라 고르지 않았습니다.` })
  else if (list.length === 1) put(c, out, 'video', list[0], c.code, 'share')
}

/** 기획서가 이름을 적은 다른 학습코드 로티 — 그 학습코드의 공유 폴더 애니메이션 자리, 없으면 그 완성본. 못 찾은 이름은 뺀다(그림 이름일 수 있다) */
export async function pickLotties(c: Ctx, names: string[]): Promise<Picked> {
  const out = empty()
  const byHome = new Map<string, string[]>()
  for (const n of names) {
    const home = lottieHome(n)
    if (c.have.has(`${n}.json`)) out.have += 1
    else if (home) byHome.set(home, [...(byHome.get(home) ?? []), n])
  }
  for (const [home, list] of byHome) {
    const s = study(c.forge, home)
    const seen = await listAll(c, s ? motionSpots(c.root, s, ['04. 애니메이션']) : [], (h) => JSON_FILE.test(h.rel))
    const share = byKey(seen.hits)
    const hall = byKey(localFiles(doneOf(c.forge, home).rsc).filter((h) => /^animations?\//i.test(h.rel) && JSON_FILE.test(h.rel)))
    for (const n of list) {
      const key = `${n}.json`
      const cands = share.get(key) ?? []
      if (!cands.length && !seen.complete) continue
      const back = hall.get(key)?.[0]
      // 이름 주인 완성본 판이 공유 폴더 판과 크기가 다르면 완성본 판 — 고친 판이 공유 폴더에 안 올라온 것이다(머리말)
      const fixed = back && !cands.some((x) => x.bytes === back.bytes)
      const got = fixed ? back : cands.length ? oneOf(cands, back) : back
      if (!got) continue
      if (typeof got === 'string') out.miss.push({ name: key, why: got })
      else put(c, out, 'lottie', got, home, cands.includes(got) ? 'share' : 'hall', `animations/${cleanName(got.rel)}`)
    }
  }
  return out
}
