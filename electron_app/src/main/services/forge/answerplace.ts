/**
 * **레시피가 아닌 답을 제자리에** — 원본은 배치표, 대사 성우 성별은 스펙 `voices` (2026-10-02).
 *
 * 「figma 화면의 장면이 원본과 다릅니다」(`scene.ts`) · 「대사 성우 성별을 정하세요」(`voiceask.ts`) 카드가 받는 답이다.
 * 답 파일(`_recipe/<코드>.answer.json`)에 남기면 다음 생성 때 「자리를 못 찾았다」로 세어진다 — 배치표 답(`#module`)과 같은 까닭이라
 * `rerun.ts` 가 이 둘을 답 파일에서 뺀다. 결과는 「다음 호에도 같습니다」와 같은 꼴(`Carried`)로 화면에 한 줄씩 보인다.
 *
 * - 원본: 지금 원본을 고르면 그 카드를 **확인한 것**으로 닫는다(`#seen`). 다른 것을 고르면 「원본 변경」과 같은 길(`pickOrigin`)
 * - 성우: `#voice|<학습코드>` — 이 학습코드이거나 **같은 모듈을 쓴 학습코드**만 받는다. 값은 `여` · `남` 만
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer, Carried, VoiceGender } from '../../../shared/forge'
import { ORIGIN_PATH, VOICE_PREFIX, seenPath } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { saveAnswers } from './answer'
import { originNow, pickOrigin } from './originpick'
import type { Forge } from './runtime'
import { writeVoice } from './voice'

const VOICE = `${VOICE_PREFIX}|`

/** 이 파일이 맡는 답인가 — 답 파일에서 뺄 것 */
export const placedElsewhere = (a: Answer): boolean => a.path === ORIGIN_PATH || a.path.startsWith(VOICE)

export async function placeAnswers(forge: Forge, code: string, answers: Answer[]): Promise<Carried[]> {
  const out: Carried[] = []
  for (const a of answers) {
    if (a.path === ORIGIN_PATH) out.push(await toOrigin(forge, code, String(a.value ?? '')))
    else if (a.path.startsWith(VOICE)) out.push(toVoice(forge, code, a.path, String(a.value ?? '')))
  }
  return out
}

async function toOrigin(forge: Forge, code: string, to: string): Promise<Carried> {
  const now = originNow(forge, code)
  if (typeof now === 'string') return { path: ORIGIN_PATH, ok: false, file: '', note: now }
  if (to === now.origin) {
    // 카드 id 는 `scene.ts` 의 `origin-scene|<원본>` — 지금 원본이 맞다고 했으니 그 카드를 닫는다
    saveAnswers(forge.paths.REPO_ROOT, code, [{ path: seenPath(`origin-scene|${to}`), value: true }], 'person')
    return { path: ORIGIN_PATH, ok: true, file: '', note: `원본 ${to} 학습코드를 그대로 씁니다.` }
  }
  const r = await pickOrigin(code, to)
  return r.error
    ? { path: ORIGIN_PATH, ok: false, file: '', note: r.error }
    : { path: ORIGIN_PATH, ok: true, file: '', note: `원본을 ${to} 학습코드로 변경했습니다. 처음부터 다시 생성합니다.` }
}

function toVoice(forge: Forge, code: string, at: string, value: string): Carried {
  const target = at.slice(VOICE.length)
  const fail = (note: string): Carried => ({ path: at, ok: false, file: '', note })
  if (value !== '여' && value !== '남') return fail('대사 성우 성별은 여 또는 남으로 고르세요.')
  let users: string[] = []
  try {
    users = forge.layout.originChoices(code).choices.map((c) => c.code)
  } catch (error) {
    return fail(toMessage(error))
  }
  if (target !== code && !users.includes(target)) return fail(`${target} 학습코드는 이 학습코드와 같은 모듈을 쓰지 않습니다.`)
  const error = writeVoice(forge, code, target, value as VoiceGender, undefined, '작업대 질문에서 대사 성우를 정했습니다')
  return error ? fail(error) : { path: at, ok: true, file: '', note: `${target} 학습코드의 대사 성우를 ${value}자로 저장했습니다.` }
}
