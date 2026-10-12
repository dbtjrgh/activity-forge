/**
 * 못 맞춘 자리를 **요구 카드로** — 낱말 자리는 무엇으로 바꿀지, 개수·모름은
 * 그대로 둘지 (`slots.ts` 에서 떼어 냄). 가리는 일과 세우는 일은 `slots.ts` 에 있다.
 */

import type { Answer, Ask, AskOption } from '../../../shared/forge'
import { parseSlotPath, slotPath } from '../../../shared/forge'
import type { Forge } from './runtime'
import type { SlotJudge } from '@/gen/reslot'
import type { AssetKind } from '@/gen/types'
import type { Swap } from '@/gen/swap'

/**
 * 아직 안 세워진 자리를 **요구 카드**로. 「고정」은 여기서 안 낸다 — 그것은
 * 진짜 리소스가 없는 것이라 `ask.ts` 의 리소스 요구가 맡는다.
 *
 * **자리마다 한 장이다.** 리소스 요구는 이름 무리로 묶지만 이쪽은 묶으면 안
 * 된다 — 자리마다 **다른 파일**이 들어가는 것이 이 물음의 전부다.
 */
export function slotAsks(
  forge: Forge,
  judged: SlotJudge[],
  swap: Swap,
  answers: Answer[],
  /**
   * 리소스 폴더에 든 figma 화면. **없으면 그것부터 달라고 한다** — 차례는
   * 이름에 없어서, 화면이 없으면 AI 도 사람도 자리마다 하나씩 골라야 한다.
   */
  shot: string | null = null,
  /**
   * figma 에서 찍을 자리를 알려 주는 한 줄 (`section.ts`). **화면이 없을 때만
   * 쓴다** — 한 호가 36차시면 이것이 없으면 36번 섹션을 찾아 헤맨다.
   * 못 그렸으면 빈 글이고, 그때는 아예 안 붙인다.
   */
  spot: string = ''
): Ask[] {
  const done = new Set<string>()
  for (const a of answers) {
    const at = parseSlotPath(a.path)
    if (at && typeof a.value === 'string' && a.value.trim()) done.add(`${at.kind}|${at.alias}`)
  }

  // 폴더에 남은 파일을 갈래로 나눠 둔다. 그림 자리에 소리를 후보로 내놓으면
  // 고를 것이 스무 개로 늘어나 고를 수가 없다.
  const left = new Map<AssetKind, string[]>()
  for (const f of swap.spare) {
    const kind = forge.files.kindOfRel(f)
    if (!kind) continue
    left.set(kind, [...(left.get(kind) ?? []), f])
  }

  const out: Ask[] = []
  for (const j of judged) {
    if (j.verdict === '고정') continue
    if (done.has(`${j.kind}|${j.alias}`)) continue
    const options: AskOption[] = (left.get(j.kind) ?? []).map((value) => ({ value, why: '' }))
    out.push(
      j.verdict === '낱말'
        ? {
            id: `slot|${j.kind}|${j.alias}`,
            want: '자리세우기',
            where: slotPath(j.kind, j.alias),
            title: `${j.alias} 항목에 넣을 파일을 고르세요.`,
            desc: j.why,
            // 화면은 이 글을 그대로 글자로 찍는다 — 별표를 넣으면 별표가 보인다.
            give:
              options.length === 0
                ? `${j.kind} 폴더에 남은 파일이 없습니다. 리소스를 넣고 「다시 생성」을 누르세요.`
                : shot
                  ? '남은 파일 중에서 이 항목에 맞는 파일을 고르세요.'
                  : // **차례는 파일 이름에 없다.** 화면 한 장이면 자리 전부가 한 번에
                    // 정해지므로, 열두 번 고르게 하기 전에 그것부터 말한다.
                    'figma 화면을 Ctrl+V 로 붙여넣으면 한 번에 정해집니다. 직접 골라도 됩니다.' +
                    // **어디를 찍는지까지 말한다.** 「캡처해 주세요」만 하면
                    // 한 호에 36번 섹션을 찾아 헤맨다 (2026-09-16).
                    (spot ? ` ${spot}` : ''),
            options,
            shape: options.length ? 'pick' : 'none',
            count: 1,
            items: [j.was],
            now: j.was,
            // **낱말은 다음 호에 안 물려준다.** 호마다 바뀌는 것이 낱말이다.
            carry: false
          }
        : {
            id: `slot|${j.kind}|${j.alias}`,
            want: '자리세우기',
            where: slotPath(j.kind, j.alias),
            title:
              j.verdict === '개수'
                ? `${j.alias} 항목이 이번에도 쓰이는지 알 수 없습니다.`
                : `${j.alias} 항목을 정할 근거가 부족합니다.`,
            desc: j.why,
            give: '그대로 두려면 같은 이름의 파일을 폴더에 넣으세요. 아니면 아래에서 대신할 파일을 고르세요.',
            options,
            shape: options.length ? 'pick' : 'none',
            count: 1,
            items: [j.was],
            now: j.was,
            carry: false
          }
    )
  }
  return out
}

/** 낱말로 가려 요구를 대신 낸 자리들. 리소스 요구가 같은 자리를 또 묻지 않게. */
export function wordAliases(judged: SlotJudge[]): Set<string> {
  return new Set(judged.filter((j) => j.verdict !== '고정').map((j) => j.alias))
}
