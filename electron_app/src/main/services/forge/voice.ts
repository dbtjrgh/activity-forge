/**
 * **대사 성우의 성별** (2026-10-02 사용자 결정 — 「성우 성별 모듈에다가 넣어놓고 지정해서 쓰면」).
 *
 * K36 9호(KOL1M08W4S2)에서 드러났다 — 성우가 호마다 다를 수 있는데(1호 남 · 2 · 5 · 6 · 7 · 9호 여, 사람이 듣고 정함), 폴더에 든 1호 대사 7개는 7호도 돌려 쓴
 * **바이트까지 같은 파일**이었다. 「돌려 쓴 파일이면 가져온다」(`carryrsc.ts`)는 목소리 성별을 모른다.
 * 소리 파일만으로는 성별을 못 가린다(기획서가 말한다) — 그래서 학습코드마다 사람이 한 번 적는다. 정본은 스펙 `voices`.
 *
 * - **대사 자리**는 소리 별칭 가운데 이닝 칸(gameData 의 `[n]` 아래)에서 부르지 않고 배경음 폴더(`sounds/sfx`)도 아닌 것.
 *   이닝 낱말(`sound1~5`)은 호마다 새로 오는 것이라 고르지 않는다
 * - **가져오기 빗장** — 이 학습코드와 원본의 성별이 **둘 다 적혀 있고 같을 때만** 대사를 돌려 쓴다. 모르면 안 가져온다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { VoiceGender } from '../../../shared/forge'
import { stamped } from './carry'
import type { Forge } from './runtime'

type Recipe = { gameData?: unknown; assets?: { sound?: { alias: string }[] } }
type Voices = Record<string, { gender: VoiceGender; why: string }>

/** gameData 안에서 배열 칸 아래 놓인 글 값 — 이닝마다 바뀌는 별칭 */
function inningNames(gameData: unknown): Set<string> {
  const out = new Set<string>()
  const walk = (v: unknown, inArray: boolean): void => {
    if (typeof v === 'string') {
      if (inArray) out.add(v)
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, true))
    else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x, inArray)
  }
  walk(gameData, false)
  return out
}

/**
 * 원본 완성본의 `GameData.ts` 글 — 레시피에 값이 안 실리는 모듈이 있다(K36 은 `quizData` 가 레시피 밖, `gameData` 가 빈 객체).
 * 거기서 이름을 부르는 소리는 데이터가 고르는 것(이닝 낱말)이고, 안 부르는 소리는 모듈이 이름을 박아 부르는 대사다
 */
function gameDataText(forge: Forge, origin: string): string {
  const at = forge.spec.parseStudyCode(origin)
  if (!at) return ''
  const file = path.join(forge.paths.workRoot(), `sparkon_m${String(at.month).padStart(2, '0')}`, 'src', 'activity', origin, 'GameData.ts')
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/** 대사 자리 → 그 레시피의 파일 자리(`sounds/x.mp3`). `origin` 은 레시피를 떠 온 완성본 */
export function talkSlots(forge: Forge, recipe: unknown, origin: string): Map<string, string> {
  const inning = inningNames((recipe as Recipe).gameData)
  const text = gameDataText(forge, origin)
  const named = (alias: string): boolean => text.includes(`"${alias}"`) || text.includes(`'${alias}'`) || text.includes(`\`${alias}\``)
  const out = new Map<string, string>()
  for (const [slot, rel] of forge.common.relOf(recipe as Parameters<Forge['common']['relOf']>[0])) {
    const [kind, alias = ''] = slot.split('|')
    if (kind !== 'sound' || inning.has(alias) || named(alias) || notTalk(alias, rel)) continue
    out.set(alias, rel)
  }
  return out
}

/**
 * 목소리가 아닌 소리 · 모든 호가 같이 쓰는 나레이션 — 배경음 · 효과음(이름이나 `sounds/sfx`), `SL_ko_com_nar01` 같은 공용(`_com_`).
 * 9호 학습코드 열 개에 재 보니 이것들까지 대사로 잡혀, 9-29 에 고친 「돌려 쓴 효과음 가져오기」(KOL1M08W1S3)가 다시 막힐 뻔했다
 */
const notTalk = (alias: string, rel: string): boolean =>
  /^sounds\/sfx\//i.test(rel) || /bgm|sfx|effect/i.test(`${alias} ${path.posix.basename(rel)}`) || /_com_/i.test(path.posix.basename(rel))

/** 그 학습코드가 쓰는 모듈의 스펙 파일 — 못 정하면 null */
function specFile(forge: Forge, code: string, module?: string): { file: string; subject: string; module: string } | null {
  const subject = code.slice(0, 2)
  const pick = module ? null : forge.api.layoutFor(code)
  const m = module || (pick?.ok ? pick.module : '')
  if (!m) return null
  try {
    const file = forge.spec.specPath(subject, forge.spec.resolveModule(subject, m))
    return fs.existsSync(file) ? { file, subject, module: m } : null
  } catch {
    return null
  }
}

export function readVoices(forge: Forge, code: string, module?: string): Voices {
  const at = specFile(forge, code, module)
  if (!at) return {}
  try {
    return (JSON.parse(fs.readFileSync(at.file, 'utf8')) as { voices?: Voices }).voices ?? {}
  } catch {
    return {}
  }
}

/** `target` 의 성별을 스펙에 적는다(null 이면 지운다). `code` 는 지금 작업대 학습코드 — 까닭에 남긴다 */
export function writeVoice(
  forge: Forge,
  code: string,
  target: string,
  gender: VoiceGender | null,
  module?: string,
  where = '받을 리소스 창에서 대사 성우를 정했습니다'
): string {
  const at = specFile(forge, code, module)
  if (!at) return '이 학습코드의 모듈 스펙을 찾지 못했습니다.'
  const spec = JSON.parse(fs.readFileSync(at.file, 'utf8')) as { voices?: Voices }
  const voices = { ...(spec.voices ?? {}) }
  if (gender) {
    const who = forge.user.loadUser().developer || '(이름 없음)'
    voices[target] = { gender, why: stamped(where, code, who) }
  } else delete voices[target]
  spec.voices = Object.fromEntries(Object.entries(voices).sort(([a], [b]) => a.localeCompare(b)))
  fs.writeFileSync(at.file, JSON.stringify(spec, null, 2) + '\n', 'utf8')
  return ''
}

/**
 * **돌려 쓰면 안 되는 대사 파일 자리** — 원본 레시피의 대사 자리. 이 학습코드와 원본의 성별이 둘 다 적혀 있고 같으면 빈 표.
 * `carryrsc.ts` · `commonrsc.ts` · 받을 리소스 창(`rscguide.ts`)이 같이 쓴다 — 셋이 따로 가리면 창은 「가져옵니다」, 걸음은 안 가져온다
 */
export function talkBlocked(forge: Forge, code: string, origin: string, recipe: unknown): Set<string> {
  if (!voiceGated(forge, code)) return new Set()
  const talk = talkSlots(forge, recipe, origin)
  if (!talk.size || sameVoice(forge, code, origin)) return new Set()
  return new Set([...talk.values()].map((r) => r.toLowerCase()))
}

/**
 * **빗장은 성우를 한 번이라도 적은 모듈에만** — 아무도 안 적은 모듈은 여태처럼 돌려 쓴다. 모든 모듈에 걸면 성별을 다 적기 전까지
 * 대사 · 나레이션을 하나도 안 가져와 「조용히 0개」가 된다(함정). 성우가 갈리는 모듈(K36)은 사람이 한 번 적는 순간부터 막힌다
 */
export const voiceGated = (forge: Forge, code: string, module?: string): boolean => Object.keys(readVoices(forge, code, module)).length > 0

/** 두 학습코드의 대사 성우 성별이 **둘 다 적혀 있고 같은가** — 모르면 false */
export function sameVoice(forge: Forge, code: string, other: string, module?: string): boolean {
  const voices = readVoices(forge, code, module)
  const mine = voices[code]?.gender
  return Boolean(mine) && mine === voices[other]?.gender
}

/** 공용 가져오기 한 줄이 대사 소리인가 — 배경음 폴더 밖의 소리. 이닝 낱말은 완성본마다 달라 공용이 될 수 없다 */
export const isTalkCopy = (slot: string, rel: string): boolean => slot.startsWith('sound|') && !notTalk(slot.slice('sound|'.length), rel)
