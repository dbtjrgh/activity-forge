/**
 * **대사 성우를 생성 흐름 안에서 묻는다** (2026-10-02, 사용자 요청 — 「다시는 일어나지 않도록」).
 *
 * 9호 KOL1M08W4S2 는 폴더의 대사가 1호(남자 성우) 것이었는데 아무 카드도 안 떴다. 성별은 받을 리소스 창에서만 고를 수 있었고,
 * 그 창을 안 열면 앱은 성별을 모른 채 돌려 쓴 대사를 그대로 썼다(`voice.ts` 빗장은 성별이 적힌 모듈에만 걸린다).
 *
 * 두 장이다.
 * - **성별 모름** — 대사 자리가 있는 모듈인데 이 학습코드의 성별이 안 적혀 있고, 대사 파일이 **없거나 앞 학습코드 것 그대로**일 때.
 *   사람이 이번 회차 대사를 다 넣었으면 묻지 않는다(성별이 상관없다). 고르면 스펙 `voices` 에 적히고 그 모듈에 빗장이 걸린다
 * - **성별 다름** — 이 학습코드의 성별이 적혀 있는데, 대사 파일이 **성별이 다르게 적힌 학습코드 것과 바이트까지 같을 때**. 확인 카드다
 *
 * 앞 학습코드 것인지는 **같은 자리 이름의 파일을 바이트로** 견준다 — 「대사 성우」로 가져온 대사(`voiceset.ts`)는 그 학습코드의 이름 그대로 온다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Ask } from '../../../shared/forge'
import { HO_OF, voicePath } from '../../../shared/forge'
import { sameFile } from './rsccopy'
import type { Forge } from './runtime'
import { readVoices, talkSlots } from './voice'

const hoOf = (code: string): string => HO_OF[code.slice(5, 7)]?.name ?? code

type Recipe = Parameters<Forge['common']['relOf']>[0]

export function voiceAsks(forge: Forge, code: string, module: string, origin: string, cloned: unknown, recipe: unknown): Ask[] {
  const dir = forge.files.rscDir(code)
  const talk = talkSlots(forge, cloned, origin)
  if (!dir || !talk.size) return []
  const voices = readVoices(forge, code, module)
  const mine = voices[code]?.gender
  let others: string[] = []
  try {
    others = forge.layout.originChoices(code).choices.map((c) => c.code).filter((c) => c !== code)
  } catch {
    return []
  }
  // 대사 자리마다 이 레시피가 가리키는 파일 — 없거나, 어느 완성본 것과 같거나, 새것
  const rels = forge.common.relOf(recipe as Recipe)
  let missing = 0
  const from = new Map<string, number>()
  for (const alias of talk.keys()) {
    const rel = rels.get(`sound|${alias}`)
    const file = rel ? path.join(dir, rel) : ''
    if (!file || !fs.existsSync(file)) {
      missing += 1
      continue
    }
    const twin = others.find((c) => sameFile(file, path.join(forge.common.rscOfDone(c), rel as string)))
    if (twin) from.set(twin, (from.get(twin) ?? 0) + 1)
  }


  // 성별이 있어야 가를 수 있는 학습코드 — 이 학습코드 · 대사를 그대로 가져온 학습코드 · 빠진 대사를 가져올 원본
  if (!missing && !from.size) return []
  const need = [...new Set([code, ...from.keys(), ...(missing ? [origin] : [])])]
  const unknown = need.filter((c) => !voices[c])
  if (unknown.length) return unknown.map((t) => genderAsk(t, code, talk.size, missing, from, voices))

  return [...from.entries()]
    .filter(([c]) => voices[c]?.gender !== mine)
    .map(([c, n]) => ({
      id: `voice-mismatch|${c}`,
      want: '사람이 봐야' as const,
      where: voicePath(c),
      title: `대사 ${n}개가 ${hoOf(c)} 학습코드(${voices[c]?.gender}자 성우) 파일입니다. 이 학습코드는 ${mine}자 성우입니다.`,
      desc: `${c} 학습코드의 대사 파일과 바이트까지 같습니다.`,
      give: '받을 리소스 창의 「대사 성우」에서 같은 성별의 대사를 고르거나 이번 회차 대사를 넣으세요. 이대로 맞다면 확인을 누르세요.',
      options: [],
      shape: 'none' as const,
      count: 1,
      items: [],
      carry: false
    }))
}

/** 성별 한 장 — `target` 은 이 학습코드이거나 대사를 가져올 앞 학습코드. 한 번 적으면 스펙에 남아 다음 호도 안 묻는다 */
function genderAsk(
  target: string,
  code: string,
  talk: number,
  missing: number,
  from: Map<string, number>,
  voices: ReturnType<typeof readVoices>
): Ask {
  const mine = target === code
  const known = Object.entries(voices).map(([c, v]) => `${hoOf(c)} ${v.gender}`)
  const why = mine
    ? (missing ? `대사 ${talk}개 가운데 ${missing}개가 폴더에 없습니다. ` : '') +
      (from.size ? `대사 ${[...from.values()].reduce((a, b) => a + b, 0)}개가 앞 학습코드(${[...from.keys()].join(', ')}) 파일 그대로입니다. ` : '')
    : from.has(target)
      ? `이 학습코드 폴더의 대사 ${from.get(target)}개가 그 학습코드 파일 그대로입니다. `
      : `빠진 대사 ${missing}개를 그 학습코드에서 가져오려면 성별을 알아야 합니다. `
  return {
    id: `voice|${target}`,
    want: '성우',
    where: voicePath(target),
    title: mine ? '이 학습코드의 대사 성우 성별을 정하세요.' : `${hoOf(target)} 학습코드(${target})의 대사 성우 성별을 정하세요.`,
    desc: why + '앞 학습코드의 대사는 성우 성별이 같을 때만 씁니다.' + (known.length ? ` 지금까지 정한 성별: ${known.join(', ')}.` : ''),
    give: mine
      ? '기획서를 보고 성별을 고르세요. 받을 리소스 창의 「대사 성우」에서 대사를 들어 볼 수 있습니다.'
      : '받을 리소스 창의 「대사 성우」에서 그 학습코드의 대사를 들어 보고 성별을 고르세요.',
    options: [
      { value: '여', why: '여자 성우' },
      { value: '남', why: '남자 성우' }
    ],
    shape: 'pick',
    count: 1,
    items: [],
    carry: false,
    byHand: true
  }
}
