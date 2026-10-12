/**
 * 맞추기에서 AI 가 낸 글을 **짝으로 읽고 검산하는 자리** (6단계).
 *
 * `brief.ts` 가 214줄이 되어 주는 글과 받는 글을 갈랐다 (2026-09-18, 동작 변화
 * 없음). 무엇을 믿지 않고 어떻게 다시 보는지(①~④)는 `brief.ts` 머리말에 있다 —
 * 여기는 그 네 가지를 실제로 보는 곳이다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { readRows } from '../../lib/table'
import type { Checked, Pair, Slot } from './brief'
import { kindOf } from './briefslots'

/**
 * AI 가 낸 글에서 짝을 읽는다. **줄 단위로 읽고 못 읽는 줄은 버린다** —
 * 앞뒤에 설명을 붙여 보내도 표만 건져낸다.
 *
 * **탭과 파이프를 둘 다 읽는다 (2026-09-15).** 브리프는 탭으로 답하라고 시키는데
 * **AI 는 마크다운 표로 답하는 일이 잦다.** 전에는 탭만 읽어서 그런 답이 통째로
 * 0쌍이 됐다 — 게다가 `refused` 에도 안 남아 **조용히 사라졌다.** 실제로 재 보니
 * 「파일 여섯 장의 이름을 정하라」에 표로 답했고, 그 답은 다 맞았는데 한 줄도
 * 못 건졌다. 꼴이 어긋났다고 맞는 답을 버릴 까닭이 없다.
 */
export function readPairs(text: string): Pair[] {
  const out: Pair[] = []
  for (const [alias, file, ...rest] of readRows(text)) {
    if (!alias || !file || alias === '별칭') continue
    out.push({ alias, file, why: rest.join(' ').trim() })
  }
  return out
}

/**
 * 받은 짝을 검산한다. **하나라도 이상하면 그 줄만 물리고 나머지는 받는다** —
 * 한 줄 때문에 쉰 줄을 버리면 사람이 다시 손으로 하게 된다.
 */
export function checkPairs(pairs: Pair[], slots: Slot[], spare: string[]): Checked {
  const want = new Map(slots.map((s) => [s.alias, s]))
  const left = new Set(spare)
  const used = new Map<string, string>() // 파일 → 이미 가져간 별칭
  const taken: Pair[] = []
  const refused: Checked['refused'] = []
  const unsure: Checked['unsure'] = []
  const refuse = (p: Pair, why: string): void => {
    refused.push({ alias: p.alias, file: p.file, why })
  }

  for (const p of pairs) {
    const slot = want.get(p.alias)
    // ④ 없는 별칭을 지어냈다
    if (!slot) {
      refuse(p, '이 액티비티에 없는 별칭입니다.')
      continue
    }
    // **「모르겠다」를 먼저 걷는다** (2026-09-21). 파일 자리에 `?` 를 쓴 줄이다.
    // 아래 검산에 넣으면 「폴더에 없는 파일」로 물려 **까닭이 바뀐 채** 버려진다 —
    // 물린 것과 모르는 것은 사람이 할 일이 아주 다르다.
    if (p.file === '?' || p.file === '？') {
      unsure.push({
        kind: slot.kind,
        alias: p.alias,
        why: p.why || '무엇이 필요한지 말하지 않았습니다.'
      })
      continue
    }
    if (taken.some((t) => t.alias === p.alias)) {
      refuse(p, '같은 별칭에 두 번 답했습니다.')
      continue
    }
    // ① 폴더에 없는 파일을 지어냈다
    if (!left.has(p.file)) {
      refuse(p, '폴더에 남아 있는 파일이 아닙니다.')
      continue
    }
    // ② 한 파일을 두 자리에
    const already = used.get(p.file)
    if (already) {
      refuse(p, `${already} 항목에 이미 쓴 파일입니다.`)
      continue
    }
    // ③ 갈래 어긋남
    const k = kindOf(p.file)
    if (k && k !== slot.kind) {
      refuse(p, `${slot.kind} 항목인데 ${k} 파일입니다.`)
      continue
    }
    used.set(p.file, p.alias)
    taken.push(p)
  }
  // **답한 자리는 「모르겠다」에서 뺀다.** 브리프에 「한 자리는 한 꼴로만」이라
  // 적었지만 말로 시킨 것은 검산하지 않으면 지켜지는지 모른다(저장소 규칙) —
  // 이미 푼 자리를 사람에게 또 물으면 헛일이다. `revisebrief.ts` 와 같은 약속이다.
  const answered = new Set(taken.map((t) => t.alias))
  // **한 자리는 한 번만 센다.** 두 번 묻는 길(`matchcalls.ts` — 막힌 자리만 그림과
  // 함께 다시 묻는다)에서는 같은 별칭이 두 답에 다 나온다. 그대로 세면
  // 「43자리 가운데 29자리를 맞추고 26자리는 모르겠다」처럼 **물은 자리보다 큰
  // 수**가 나와, 사람이 셈을 못 믿게 된다. 앞의 것을 남긴다 — 이어 붙일 때
  // 그림을 본 두 번째 답이 앞에 온다.
  const once = new Map<string, Checked['unsure'][number]>()
  for (const u of unsure) {
    if (answered.has(u.alias) || once.has(u.alias)) continue
    once.set(u.alias, u)
  }
  return { taken, refused, unsure: [...once.values()] }
}

/** 검산을 통과한 짝을 「사람이 정한 값」과 같은 길로 보낸다. */
export function pairPath(slots: Slot[], alias: string): string {
  const kind = slots.find((s) => s.alias === alias)?.kind ?? 'image'
  return `assets.${kind}.${alias}`
}

/** 맞춘 자리가 몇인지 한 줄로. 화면과 걸음이 같은 말을 쓰게 한다. */
export function matchNote(checked: Checked, slots: Slot[]): string {
  return (
    `${slots.length}개 항목 가운데 ${checked.taken.length}개를 AI 가 맞췄습니다.` +
    (checked.refused.length ? ` 검산을 통과하지 못한 ${checked.refused.length}줄은 버렸습니다.` : '') +
    // **모르겠다는 따로 센다.** 「남은 자리」에 섞으면 AI 가 말을 한 것과
    // 아무 말도 없이 빠진 것이 같아 보인다.
    (checked.unsure.length ? ` ${checked.unsure.length}개는 AI 가 모르겠다고 답했습니다.` : '') +
    (slots.length - checked.taken.length - checked.unsure.length > 0
      ? ` 남은 ${slots.length - checked.taken.length - checked.unsure.length}개는 AI 가 답하지 않았습니다.`
      : '')
  )
}
