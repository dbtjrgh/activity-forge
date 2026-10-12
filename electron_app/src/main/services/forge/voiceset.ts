/**
 * **「박사 목소리」 고르기** — 같은 모듈 완성본마다 대사 묶음을 보여 주고, 고른 완성본의 대사를 **한 묶음째** 가져온다 (2026-10-02).
 *
 * 자리마다 따로 고르지 않는다 — 5호 정답 대사에 6호 오답 대사를 섞으면 목소리가 둘이 된다.
 * - 가져오는 파일은 **그 완성본의 이름 그대로** `sounds/` 에 둔다. 같은 이름이 이미 있으면 바이트가 같을 때만 그대로 쓰고, 다르면 덮지 않는다
 * - 대사 자리마다 사람 답(`assets.sound.<별칭>`)을 남긴다 — 이름이 달라도 만들기가 그 파일을 쓴다
 * - 고를 수 있는 것은 그 모듈을 쓴 학습코드(forge `originChoices`)뿐 — 렌더러는 학습코드만 보낸다
 * - 폴더에 원래 있던 다른 목소리 파일은 **지우지 않는다**(사람이 넣은 것일 수 있다). 답이 생기면 만들기가 안 쓴다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { VoiceDone, VoiceGender, VoiceInfo, VoiceSet } from '../../../shared/forge'
import { seenPath } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { readAnswers, saveAnswers } from './answer'
import { seenIds } from './ask'
import { sameFile } from './rsccopy'
import { originNow } from './originpick'
import { loadForge, type Forge } from './runtime'
import { readVoices, talkSlots, writeVoice } from './voice'

const blank = (code: string, error: string): VoiceInfo => ({ code, module: '', talk: [], gender: null, why: '', sets: [], have: 0, kept: false, error })

export type Ctx = { forge: Forge; module: string; talk: Map<string, string>; choices: string[]; dir: string }

function context(forge: Forge, code: string): Ctx | string {
  const now = originNow(forge, code)
  if (typeof now === 'string') return now
  const cloned = forge.api.clone(now.origin, code)
  if (!cloned.ok) return cloned.error ?? '원본을 불러오지 못했습니다.'
  const choices = forge.layout.originChoices(code).choices.map((c) => c.code).filter((c) => c !== code)
  return { forge, module: now.module, talk: talkSlots(forge, cloned.recipe, now.origin), choices, dir: forge.files.rscDir(code) ?? '' }
}

/** 그 완성본의 대사 자리 → 파일 경로(있는 것만). 자리 이름은 원본 레시피의 것 — 완성본에 그 별칭이 없으면 빠진다 */
export function filesOf(ctx: Ctx, done: string): Map<string, string> {
  const map = ctx.forge.common.fileOf(done)
  const root = ctx.forge.common.rscOfDone(done)
  const out = new Map<string, string>()
  for (const alias of ctx.talk.keys()) {
    const rel = map.get(`sound|${alias}`)
    if (rel && fs.existsSync(path.join(root, rel))) out.set(alias, path.join(root, rel))
  }
  return out
}

/** 이 폴더에서 대사 자리마다 쓰일 파일 — 답으로 정한 것, 없으면 원본 이름 그대로 온 것 */
function mineOf(ctx: Ctx, code: string): Map<string, string> {
  const out = new Map<string, string>()
  if (!ctx.dir) return out
  const answers = new Map(readAnswers(ctx.forge.paths.REPO_ROOT, code).answers.map((a) => [a.path, a.value]))
  for (const [alias, rel] of ctx.talk) {
    const set = answers.get(`assets.sound.${alias}`)
    const pick = typeof set === 'string' ? path.join(ctx.dir, set) : path.join(ctx.dir, rel)
    if (fs.existsSync(pick)) out.set(alias, pick)
  }
  return out
}

/**
 * 완성본마다 대사 묶음 — **바이트까지 같은 묶음은 한 줄로** 묶는다(`twins`). K33 은 2 · 4 · 6호가 2호 대사를 그대로 써서
 * 같은 줄이 아홉 번 나왔고 어느 「이 대사 쓰기」를 눌러도 같았다(2026-10-06). 줄의 대표는 성별이 적힌 학습코드부터
 */
function setsOf(ctx: Ctx, code: string, mine: Map<string, string>): VoiceSet[] {
  const voices = readVoices(ctx.forge, code, ctx.module)
  const groups = new Map<string, { code: string; files: Map<string, string> }[]>()
  for (const c of ctx.choices) {
    const files = filesOf(ctx, c)
    if (!files.size) continue
    const key = [...files].map(([alias, f]) => `${alias}=${ctx.forge.common.printOf(f)}`).sort().join('|')
    groups.set(key, [...(groups.get(key) ?? []), { code: c, files }])
  }
  return [...groups.values()].map((g) => {
    const head = g.find((x) => voices[x.code]) ?? (g[0] as (typeof g)[number])
    const same = [...head.files].filter(([alias, f]) => mine.has(alias) && sameFile(f, mine.get(alias) as string)).length
    const twins = g.filter((x) => x !== head).map((x) => x.code)
    return { code: head.code, gender: voices[head.code]?.gender ?? null, why: voices[head.code]?.why ?? '', files: head.files.size, same, twins }
  })
}

/** 성별이 달라도 지금 대사를 그대로 쓰기로 한 표시 — 생성의 확인 카드(`voiceask.ts` `voice-mismatch|<코드>`)를 닫은 답과 같다 */
const keptIds = (sets: VoiceSet[]): string[] =>
  sets.filter((s) => s.same > 0).flatMap((s) => [s.code, ...s.twins].map((c) => `voice-mismatch|${c}`))

function infoOf(ctx: Ctx, code: string): VoiceInfo {
  const voices = readVoices(ctx.forge, code, ctx.module)
  const mine = mineOf(ctx, code)
  const sets = setsOf(ctx, code, mine)
  const seen = seenIds(readAnswers(ctx.forge.paths.REPO_ROOT, code).answers)
  return {
    code,
    module: ctx.module,
    talk: [...ctx.talk.keys()],
    gender: voices[code]?.gender ?? null,
    why: voices[code]?.why ?? '',
    sets,
    have: mine.size,
    kept: keptIds(sets).some((id) => seen.has(id))
  }
}

export async function withCtx<T>(code: string, fail: (e: string) => T, run: (ctx: Ctx) => T): Promise<T> {
  try {
    const forge = await loadForge()
    const ctx = context(forge, code)
    return typeof ctx === 'string' ? fail(ctx) : run(ctx)
  } catch (error) {
    return fail(toMessage(error))
  }
}

export const voiceInfo = (code: string): Promise<VoiceInfo> => withCtx(code, (e) => blank(code, e), (ctx) => infoOf(ctx, code))

/** 성별 적기 — `target` 은 이 학습코드이거나 그 모듈 완성본 */
export function voiceSet(code: string, target: string, gender: VoiceGender | null): Promise<VoiceDone> {
  return withCtx(
    code,
    (e) => ({ ok: false, note: '', info: blank(code, e), error: e }),
    (ctx) => {
      if (target !== code && !ctx.choices.includes(target)) return { ok: false, note: '', info: infoOf(ctx, code), error: `${target} 학습코드는 ${ctx.module} 모듈을 쓰지 않습니다.` }
      // 한 줄로 묶인 학습코드는 같은 파일이라 성별도 같다 — 같이 저장한다
      const twins = target === code ? [] : (infoOf(ctx, code).sets.find((s) => s.code === target)?.twins ?? [])
      const err = [target, ...twins].map((t) => writeVoice(ctx.forge, code, t, gender, ctx.module)).find(Boolean)
      const who = twins.length ? `${target} 외 ${twins.length}개` : target
      return { ok: !err, note: err ? '' : `${who} 학습코드의 대사 성우를 ${gender ?? '모름'}(으)로 저장했습니다.`, info: infoOf(ctx, code), ...(err ? { error: err } : {}) }
    }
  )
}

/** 고른 완성본의 대사를 한 묶음째 이 폴더에 · 답으로 */
export function voiceUse(code: string, from: string): Promise<VoiceDone> {
  return withCtx(
    code,
    (e) => ({ ok: false, note: '', info: blank(code, e), error: e }),
    (ctx) => {
      if (!ctx.choices.includes(from)) return { ok: false, note: '', info: infoOf(ctx, code), error: `${from} 학습코드는 ${ctx.module} 모듈을 쓰지 않습니다.` }
      if (!ctx.dir || !fs.existsSync(ctx.dir)) return { ok: false, note: '', info: infoOf(ctx, code), error: '리소스 폴더가 아직 없습니다. 파일을 먼저 넣으세요.' }
      const root = ctx.forge.common.rscOfDone(from)
      const answers: { path: string; value: string }[] = []
      const clash: string[] = []
      for (const [alias, src] of filesOf(ctx, from)) {
        const rel = path.relative(root, src).split(path.sep).join('/')
        const to = path.join(ctx.dir, rel)
        if (fs.existsSync(to) && !sameFile(to, src)) {
          clash.push(rel)
          continue
        }
        if (!fs.existsSync(to)) {
          fs.mkdirSync(path.dirname(to), { recursive: true })
          fs.copyFileSync(src, to)
          if (fs.statSync(to).size !== fs.statSync(src).size) throw new Error(`${rel} 파일을 복사한 크기가 원본과 다릅니다.`)
        }
        answers.push({ path: `assets.sound.${alias}`, value: rel })
      }
      if (answers.length) saveAnswers(ctx.forge.paths.REPO_ROOT, code, answers, 'person')
      const note =
        `${from} 학습코드의 대사 ${answers.length}개를 가져와 대사 항목에 지정했습니다.` +
        (clash.length ? ` 같은 이름의 다른 파일이 있어 ${clash.length}개는 가져오지 않았습니다 (${clash[0]}).` : '')
      return { ok: answers.length > 0, note, info: infoOf(ctx, code) }
    }
  )
}

/**
 * **성별이 달라도 지금 대사를 그대로 쓴다** — 같은 성별의 대사가 어느 호에도 없을 때(K33 9호는 남자 성우인데 정답 · 오답 대사는 2호 여자 것뿐).
 * 생성의 확인 카드를 닫는 답(`#seen|voice-mismatch|<코드>`)을 남긴다. 파일은 안 건드린다
 */
export function voiceKeep(code: string): Promise<VoiceDone> {
  return withCtx(
    code,
    (e) => ({ ok: false, note: '', info: blank(code, e), error: e }),
    (ctx) => {
      const ids = keptIds(setsOf(ctx, code, mineOf(ctx, code)))
      if (!ids.length) return { ok: false, note: '', info: infoOf(ctx, code), error: '폴더에 앞 학습코드의 대사가 없습니다.' }
      saveAnswers(ctx.forge.paths.REPO_ROOT, code, ids.map((id) => ({ path: seenPath(id), value: true })), 'person')
      return { ok: true, note: '지금 폴더의 대사를 그대로 쓰기로 저장했습니다.', info: infoOf(ctx, code) }
    }
  )
}

