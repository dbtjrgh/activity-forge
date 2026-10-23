/**
 * **영어 — 공유 폴더에서 무엇을 가져올지 고르기** (2026-10-15, `sharefetch.ts` 가 부른다. 자리는 `shareruleen.ts`).
 *
 * 9호 영어는 소리를 하나도 못 찾았다 — 자리 규칙이 국어 · 수학만 알았고, 영어 기획서는 소리 이름을 가르지 못한다(`plansound.ts`).
 * 그래서 이름으로 찾지 않고 **그 학습코드의 자리에 있는 소리 파일 전부**를 고른다. 자리가 좁아서 된다 —
 * 학습코드 폴더와 활동 공통 폴더의 그 호 폴더, 배치표 모듈에 따라 낱말 · 동요 자리(`enSoundSpots`). 2026-10-15 에 잼 — 사람이 손으로 넣은 9호 열한 학습코드의 소리 · 영상
 * 45개가 이 자리에서 다 나왔고(빠진 것 · 남는 것 없음, 크기까지 같음), 5~8호(M05~M07) 108개로 되짚으니 찾은 708개 중 623개가 완성본과
 * 이름 · 크기까지 같았다. 다른 85개는 줄표 없는 옛 폴더(`ENL3M05W3S3`)의 다른 이름 35 · 폴더에 더 있던 내레이션 20 ·
 * 완성본이 이름을 바꾼 목소리 판(`_g` → 맨 이름) 14 · 다른 칸 파일이 든 활동 폴더(7호 Explore Make L3) 9 · 크기가 다른 판 7이다.
 * - 공용 소리(`SL_en_com_…`)는 고르지 않는다 — 국어 · 수학과 같이 대화를 시작할 때 원본에서 가져온다
 * - 목소리 판(`_b` · `_g`)은 맨 판이 있으면 뺀다(`voiceTwin`). 느린 판(`_slow`)은 짝으로 쓰여 남긴다
 * - 이름에 빈칸이 든 것은 고르지 않고 까닭을 남긴다(`hasGap`)
 * - 같은 이름이 두 자리에 있으면 하나만, 크기가 다르면 안 고른다(`oneOf`)
 * - 스토리 영상은 VideoPlayer 모듈일 때 그 호 것 하나를 `video.mp4` 로, 동요는 CreateSong 모듈일 때 그 호 반주 · 동요 영상 · MR 영상을 하나씩 `mr.mp3` · `video.mp4` · `mr.mp4` 로
 * - 말하기 AI 영상은 ShowcaseSpeakLv2 모듈일 때 그 학습코드 이름의 것 전부를 이름 그대로 `images/` 로
 * 리소스 폴더나 호 저장소에 같은 이름이 이미 있으면 안 가져온다(`sharepick.ts` 와 같다).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { ShareItem } from '../../../shared/forge'
import type { Hit } from './sharefind'
import { byKey, empty, listAll, oneOf, put, type Ctx, type Picked } from './sharepick'
import { AUDIO, cleanName, isCommonSound, keyOf } from './sharerule'
import { enSoundSpots, hasGap, isSongFilm, isSongMr, isSpeakVideo, isStoryFilm, MR_FILM, MR_NAME, songFilmSpot, songSpot, speakSpot, storySpot, voiceTwin } from './shareruleen'
import { VIDEO_NAME } from './sharevideo'

/** 영어 학습코드의 소리 — 그 자리의 소리 파일 전부(위 머리말). `module` 은 배치표 모듈(비면 모듈로 여는 자리는 안 본다). 영어가 아니면 빈 것 */
export async function pickEnSounds(c: Ctx, module: string): Promise<Picked> {
  const out = empty()
  const s = c.forge.spec.parseStudyCode(c.code)
  const spots = s ? enSoundSpots(c.root, s, module) : []
  if (!spots.length) return out
  const hits = (await listAll(c, spots, (h) => AUDIO.test(h.rel) && !isCommonSound(h.rel))).hits
  for (const h of hits.filter((x) => hasGap(x.rel))) out.miss.push({ name: h.rel.split('/').pop() ?? h.rel, why: '이름에 빈칸이 있어 가져오지 않았습니다.' })
  const groups = byKey(hits.filter((x) => !hasGap(x.rel)))
  const keys = new Set([...groups.keys(), ...c.have])
  for (const [key, cands] of groups) {
    if (voiceTwin(key, keys)) continue
    if (c.have.has(key)) {
      out.have += 1
      continue
    }
    const got = oneOf(cands, undefined)
    if (typeof got === 'string') out.miss.push({ name: cleanName(cands[0].rel), why: got })
    else put(c, out, 'sound', got, c.code, 'share')
  }
  return out
}

/**
 * 한 개만 쓰는 파일을 `as` 이름으로(스토리 영상 · 동요 반주) — 이미 있으면 셈만, 여럿이면 고르지 않는다. 하나도 없으면 false(「없음」인지는 부르는 쪽이 정한다).
 * 사람이 공유 폴더 이름 그대로 넣어 두었어도 이미 있는 것이다(액티비티 영상과 같다)
 */
function pickOne(c: Ctx, out: Picked, hits: Hit[], kind: ShareItem['kind'], as: string, label: string): boolean {
  const list = [...new Map(hits.map((h) => [`${keyOf(h.rel)}|${h.bytes}`, h])).values()]
  if (c.have.has(keyOf(as)) || list.some((h) => c.have.has(keyOf(h.rel)))) out.have += 1
  else if (list.length > 1) out.miss.push({ name: list.map((h) => cleanName(h.rel)).join(', '), why: `${label}이 ${list.length}개라 고르지 않았습니다.` })
  else if (list.length === 1) put(c, out, kind, list[0], c.code, 'share', as)
  else return false
  return true
}

/** 영어 스토리 영상 — VideoPlayer 모듈일 때 그 호 것 하나를 `video.mp4` 로. `module` 이 비면(영상을 안 찾는 학습코드) 빈 것 */
export async function pickStory(c: Ctx, module: string): Promise<Picked> {
  const out = empty()
  const s = c.forge.spec.parseStudyCode(c.code)
  const spot = s && module ? storySpot(c.root, s, module) : null
  if (!s || !spot) return out
  const seen = await listAll(c, [spot], (h) => isStoryFilm(h.rel, s))
  if (!pickOne(c, out, seen.hits, 'video', VIDEO_NAME, '스토리 영상') && seen.complete) out.miss.push({ name: VIDEO_NAME, why: '공유 폴더에 이 호 스토리 영상이 없습니다.', none: true })
  return out
}

/**
 * 영어 동요 — CreateSong 모듈일 때 그 호 반주 · 동요 영상 · MR 영상을 하나씩 리소스 폴더 맨 위 `mr.mp3`(2026-10-19) · `video.mp4` · `mr.mp4`(2026-10-23) 로.
 * 영상을 찾나와 상관없다(모듈로 가른다). 못 찾으면 조용히 빈 것 — Level.1 · 3 은 반주 폴더가 없고, 방학호(M11)는 앞 호 것을 다시 써 그 번호 파일이 없다
 */
export async function pickSong(c: Ctx, module: string): Promise<Picked> {
  const out = empty()
  const s = c.forge.spec.parseStudyCode(c.code)
  const spot = s && module ? songSpot(c.root, s, module) : null
  const film = s && module ? songFilmSpot(c.root, s, module) : null
  if (!s || !spot || !film) return out
  pickOne(c, out, (await listAll(c, [spot], (h) => isSongMr(h.rel, s))).hits, 'sound', MR_NAME, '반주 음원')
  const films = (await listAll(c, [film], (h) => /\.mp4$/i.test(h.rel))).hits
  pickOne(c, out, films.filter((h) => isSongFilm(h.rel, s, false)), 'video', VIDEO_NAME, '동요 영상')
  pickOne(c, out, films.filter((h) => isSongFilm(h.rel, s, true)), 'video', MR_FILM, 'MR 영상')
  return out
}

/**
 * 영어 말하기 AI 영상 — ShowcaseSpeakLv2 모듈일 때 그 학습코드 이름의 영상 전부를 이름 그대로 `images/` 로(2026-10-19).
 * mp4 는 놓으면 리소스 폴더 맨 위로 가는데(`rscplace.ts`) 완성본은 `images/` 에서 부른다 — 그래서 자리를 준다
 */
export async function pickSpeak(c: Ctx, module: string): Promise<Picked> {
  const out = empty()
  const s = c.forge.spec.parseStudyCode(c.code)
  const spot = s && module ? speakSpot(c.root, s, module) : null
  if (!s || !spot) return out
  const seen = await listAll(c, [spot], (h) => isSpeakVideo(h.rel, c.code))
  for (const [key, cands] of byKey(seen.hits)) {
    const got = oneOf(cands, undefined)
    if (c.have.has(key)) out.have += 1
    else if (typeof got === 'string') out.miss.push({ name: cleanName(cands[0].rel), why: got })
    else put(c, out, 'video', got, c.code, 'share', `images/${cleanName(got.rel)}`)
  }
  if (!seen.hits.length && seen.complete) out.miss.push({ name: `${c.code.replace(/^EN/, '')}_video_NN.mp4`, why: '공유 폴더에 이 학습코드 AI 영상이 없습니다.', none: true })
  return out
}
