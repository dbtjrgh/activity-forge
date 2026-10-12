/**
 * **배치표가 갈렸을 때의 카드** — 어느 모듈로 만들지 사람이 고른다 (5단계).
 *
 * 2026-09-18 에 모았다 (동작 변화 없음). 카드 모양(`moduleAsk`)은 `ask.ts` 에,
 * 그 카드를 낼지 가리는 것(`moduleCard`)은 `run.ts` 에 있었는데 **같은 물음의
 * 두 쪽**이라 한 자리에 둔다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Ask, AskOption } from '../../../shared/forge'
import { MODULE_PATH } from '../../../shared/forge'
import type { PlacementView } from '@/gen/layout'
import type { Forge } from './runtime'

/**
 * 배치표가 갈렸을 때의 **질문 카드** (5단계).
 *
 * 지금까지는 걸음이 넘어지며 「`_layout` 을 손으로 고치세요」라고만 했다.
 * 그런데 이것이 못 정한 것 가운데 **제일 큰 것**이다 — 모듈이 틀리면 값도
 * 리소스도 다 틀린다. 물어야 할 것을 물어야 할 자리에서 묻는다.
 *
 * **후보는 앞선 호가 실제로 쓴 것뿐이다.** 근거는 「몇 호가 이것을 썼다」이고,
 * 그 밖의 후보는 내놓지 않는다. 답에는 **왜 그것인지를 반드시 받는다** —
 * 배치표 파일 자신이 그렇게 하라고 적어 두었다.
 */
export function moduleAsk(at: PlacementView, why: string): Ask {
  const used = new Map<string, string[]>()
  for (const b of at.before) used.set(b.module, [...(used.get(b.module) ?? []), b.issue])

  // **호 번호에 셈을 하지 않는다.** 저장소 안에 「M05 를 5호」로 적은 글과
  // 「6호」로 적은 글이 같이 있다. 어느 쪽으로 적어도 절반은 틀리므로 학습코드에
  // 그대로 박혀 있는 `M05` 를 쓴다 — 사람이 보는 코드와 같은 글자다.
  const options: AskOption[] = [...used]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([module, issues]) => ({
      value: module,
      why: `${issues.map((i) => `M${i}`).join(', ')} 호에서 사용`
    }))

  return {
    id: `module|${at.slot}`,
    want: '모듈',
    where: MODULE_PATH,
    title: `${at.slot} 위치에 쓸 모듈을 고르세요.`,
    desc:
      at.before.map((b) => `M${b.issue} ${b.module}`).join(', ') ||
      (why || '앞선 호에 근거가 없습니다.'),
    // 화면은 이 글을 그대로 글자로 찍는다 — 별표를 넣으면 별표가 보인다.
    give: '모듈을 고르고 이유를 입력하세요. 배치표에 저장됩니다.',
    options,
    shape: options.length ? 'pick' : 'none',
    count: 1,
    items: at.before.map((b) => `M${b.issue} ${b.module}`),
    // 배치표에 남기는 것이 곧 답이다 — 「다음에도 같습니다」를 따로 안 묻는다.
    carry: true,
    ...(at.wbs ? { now: at.wbs.title } : {})
  }
}

/**
 * 배치표가 갈렸으면 그 물음을 카드 한 장으로. 그 밖의 실패는 null 이다.
 *
 * **아무 실패나 카드로 바꾸지 않는다.** 「호 폴더가 없다」·「스펙이 깨졌다」는
 * 사람이 고를 것이 없는 진짜 오류라, 카드로 바꾸면 답할 수 없는 카드가 뜬다.
 */
export function moduleCard(forge: Forge, code: string, why: string): Ask | null {
  try {
    const at = forge.layout.placementFor(code)
    if (!at || at.verdict !== '갈림') return null
    return moduleAsk(at, why)
  } catch {
    // 배치표를 읽다 또 넘어지면 원래 오류를 그대로 보인다.
    return null
  }
}
