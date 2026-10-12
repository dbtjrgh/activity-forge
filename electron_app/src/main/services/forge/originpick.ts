/**
 * **원본 바꾸기** — 기계가 고른 앞 학습코드가 틀렸을 때 사람이 다른 것으로 정한다 (2026-09-30, 사용자 요청).
 *
 * 받을 리소스 창 · 만들기가 다 이 원본을 따른다 — 원본이 틀리면 figma 에서 엉뚱한 것을 내보내고, 만들기는 판이 다른 값을 뜬다.
 * - 후보는 forge `originChoices` 가 센다 — **그 모듈을 쓴 학습코드 전부**, 기계가 고르는 차례 그대로. 여기서 새로 찾지 않는다
 * - 적는 자리는 배치표(`_layout/<과목><M>.json`)의 그 칸 — **모듈 판정은 안 건드린다**(forge `writeLayoutOrigin`)
 * - 후보에 없는 것은 안 받는다 · 도는 중이면 안 바꾼다 · 적은 뒤 다시 읽어 그 원본이 잡히는지 본다
 * - 사람이 고르면 만들 때 크기로 바꾸는 걸음(`originfit.ts`)도 손대지 않는다
 * - 원본이 바뀌면 이어 가던 대화는 잇지 않는다(`chat.ts` `ctxFor`) — 「처음부터 다시 만들기」로 새 대화를 시작한다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { LeftoverTrash, OriginChoices } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { stamped } from './carry'
import { fitOrigin } from './originfit'
import { leftoverFiles, trashLeftovers } from './leftover'
import { chatBusy } from './chatstore'
import { savedScene } from './scene'
import { loadForge, type Forge } from './runtime'

const blank = (code: string, error: string): OriginChoices => ({
  code,
  module: '',
  now: '',
  first: '',
  pinned: '',
  changed: false,
  choices: [],
  running: false,
  scene: null,
  leftover: [],
  error
})

/**
 * 만들 때 쓸 원본 — 배치표 판정에 크기 맞추기를 얹은 것. `assemble.ts` ①과 같은 셈이다(그 걸음은 얼려 둬서 여기서 따로 부른다).
 * 받을 리소스 창 · 원본 바꾸기가 같이 본다 — 창에 적힌 원본과 만들 때 쓰는 원본이 달라지면 사람이 엉뚱한 것을 내보낸다
 */
export function originNow(forge: Forge, code: string): { origin: string; module: string; fitNote: string } | string {
  const p = forge.api.layoutFor(code)
  if (!p.ok) return p.error ?? '배치표를 읽지 못했습니다.'
  if (!p.origin) return '원본이 정해지지 않았습니다.'
  const fit = fitOrigin(forge, code, p.origin, p.alt)
  return { origin: fit?.origin ?? p.origin, module: p.module, fitNote: fit?.note ?? '' }
}

function choicesOf(forge: Forge, code: string): OriginChoices {
  let c: ReturnType<Forge['layout']['originChoices']>
  try {
    c = forge.layout.originChoices(code)
  } catch (error) {
    return blank(code, toMessage(error))
  }
  const now = originNow(forge, code)
  return {
    code,
    module: c.module,
    now: typeof now === 'string' ? '' : now.origin,
    first: c.first,
    pinned: c.pinned,
    changed: c.changed,
    choices: c.choices,
    // 도는 대화가 호 저장소에 쓰는 중이다 — 그동안 원본을 바꾸면 Claude 가 옛 원본으로 쓴 것과 섞인다 (2026-10-08, 전에는 이전 방식의 `runstate`)
    running: chatBusy(code),
    // 장면 비교는 남아 있는 것만 — 여기서 재면 창을 열 때 몇 초씩 멈춘다 (`scene.ts`). 재던 이전 방식의 생성은 2026-10-08 에 걷었다
    // 그래서 그 뒤로는 새로 안 생긴다 — 대화로 만들기에 붙이는 것은 다음 일이다
    scene: typeof now === 'string' ? null : savedScene(forge, code, now.origin),
    leftover: typeof now === 'string' ? [] : leftoverFiles(forge, code, now.origin),
    ...(typeof now === 'string' ? { error: now } : {})
  }
}

export async function originChoices(code: string): Promise<OriginChoices> {
  try {
    return choicesOf(await loadForge(), code)
  } catch (error) {
    return blank(code, toMessage(error))
  }
}

/** `origin` 이 null 이면 작업대에서 바꾼 것을 원래대로 — 기계 판정 또는 파일에 사람이 적어 둔 원본으로 */
export async function pickOrigin(code: string, origin: string | null): Promise<OriginChoices> {
  try {
    const forge = await loadForge()
    const before = choicesOf(forge, code)
    if (!before.module) return before
    if (before.running) return { ...before, error: '생성 중에는 원본을 변경할 수 없습니다. 생성이 끝난 뒤 다시 시도하세요.' }
    if (origin !== null && !before.choices.some((c) => c.code === origin)) {
      return { ...before, error: `선택한 학습코드(${origin})는 ${before.module} 모듈을 사용하지 않습니다.` }
    }
    const study = forge.spec.parseStudyCode(code)
    if (!study) return { ...before, error: '학습코드 형식이 올바르지 않습니다.' }
    const who = forge.user.loadUser().developer || '(이름 없음)'
    const r = forge.layout.writeLayoutOrigin(
      study.subject,
      String(study.month).padStart(2, '0'),
      `L${study.level}W${study.week}S${study.session}`,
      { origin, why: stamped('작업대에서 원본을 직접 선택했습니다', code, who) }
    )
    if (!r.ok) return { ...before, error: r.error ?? '배치표를 저장하지 못했습니다.' }
    const after = choicesOf(forge, code)
    // 적은 것이 실제로 잡히나 — 안 잡히면 조용히 넘기지 않는다
    if (origin !== null && after.now !== origin) {
      return { ...after, error: `배치표에 저장했지만 원본이 변경되지 않았습니다. 배치표 파일을 확인하세요: ${r.file}` }
    }
    return after
  } catch (error) {
    return blank(code, toMessage(error))
  }
}

/** 폴더에 남은 다른 호 원본 파일을 휴지통으로 — 지금 원본을 메인이 다시 정하고 목록도 다시 센다(`leftover.ts`) */
export async function trashOldOrigin(code: string): Promise<LeftoverTrash> {
  try {
    const forge = await loadForge()
    if (chatBusy(code)) return { moved: [], failed: [], error: '생성 중에는 파일을 옮길 수 없습니다. 생성이 끝난 뒤 다시 시도하세요.' }
    const now = originNow(forge, code)
    if (typeof now === 'string') return { moved: [], failed: [], error: now }
    return await trashLeftovers(code, now.origin)
  } catch (error) {
    return { moved: [], failed: [], error: toMessage(error) }
  }
}
