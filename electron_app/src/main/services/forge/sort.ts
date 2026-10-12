/**
 * **놓는 자리는 한 곳** — 통째로 놓으면 도구가 차시별로 가른다 (2026-09-16).
 *
 * 4단계의 인박스(`inbox.ts`)는 **차시 화면마다** 받는 자리가 있었습니다.
 * 그래서 사람이 먼저 「어느 차시인지」를 고르고 놓아야 했습니다. 디자이너가
 * 주는 것은 한 차시가 아니라 **한 묶음**이라, 그걸 차시 수만큼 나눠 놓는 일이
 * 사람 몫으로 남아 있었습니다.
 *
 * > *「사용자는 무조건 리소스 폴더에 놓는 건 한 곳에 정해져 있는 걸로 해야 해,
 * > 안 헷갈리게. 가져가는 건 도구가 알아서 가져가고.」* (2026-09-16)
 *
 * **가르는 단서는 둘이고, 둘 다 실제 배달에 있습니다.**
 *
 *   ① 폴더 이름이 학습코드     `KOL1M08W1S1/images/Item_0_0.png`  ← 9호 배달이 그렇다
 *   ② 파일 이름 앞머리         `enl1m07w1s1_crayon1.png`
 *
 * ①이 셉니다 — 폴더를 통째로 넘기면 `images/…` 같은 **안쪽 자리가 그대로**
 * 살아서, 갈래를 확장자로 다시 짐작하지 않아도 됩니다.
 *
 * **못 가린 것은 안 옮기고 묻습니다.** 짐작해서 남의 차시에 남의 파일을 넣는
 * 것이 제일 나쁜 실패입니다 (저장소 CLAUDE.md 6번). 원본은 그대로 있으므로
 * 사람이 차시를 정해 주면 그때 넣으면 됩니다.
 *
 * **넣는 일은 `inbox.ts` 가 그대로 합니다.** 여기서는 **가르기만** 합니다 —
 * 복사·크기 대조·덮어쓰기 규칙이 두 벌이 되면 한쪽만 고쳐집니다(CLAUDE.md 3번).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { basename } from 'node:path'
import type { InboxResult, SortedInbox } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { takeInbox } from './inbox'
import { loadForge, type Forge } from './runtime'
import { routePaper } from './sortpaper'
import { codeIn, split, type Split } from './sortwalk'

/** 한 번에 받을 묶음 수 상한 — 차시 수. */
const MAX_LESSONS = 200

/**
 * 통째로 놓은 것을 차시별로 갈라 넣는다.
 *
 * @param drops 앱에 끌어다 놓은 절대 경로들. 파일이든 폴더든 된다
 */
export async function sortInbox(drops: string[], overwrite: boolean): Promise<SortedInbox> {
  const out: SortedInbox = {
    found: 0,
    truncated: false,
    lessons: [],
    papers: [],
    ask: [],
    failed: [],
    note: ''
  }
  let forge: Forge
  try {
    forge = await loadForge()
  } catch (error) {
    return { ...out, error: toMessage(error) }
  }

  const bag: Split = { byCode: new Map(), loose: [], truncated: false }
  split(drops, bag, out.failed)
  out.truncated = bag.truncated

  // ─ figma 화면 · 기획서는 제 자리로 (M5, `sortpaper.ts`) — 이름 앞머리가 아니라 프레임 이름 · 1쪽 제목이 단서다 ─
  const loose: string[] = []
  for (const file of bag.loose) {
    const routed = await routePaper(forge, file, overwrite)
    if (!routed) loose.push(file)
    else if ('placed' in routed) out.papers.push(routed.placed)
    else out.ask.push(routed.hold)
  }

  // ─ 낱개 파일은 이름 앞머리로 가린다 ─
  for (const file of loose) {
    const code = codeIn(basename(file))
    if (!code) {
      out.ask.push({
        name: basename(file),
        from: file,
        why: '파일 이름에 학습코드가 없습니다. 해당 학습코드의 작업대에 넣으세요.'
      })
      continue
    }
    const list = bag.byCode.get(code) ?? []
    list.push(file)
    bag.byCode.set(code, list)
  }

  const codes = [...bag.byCode.keys()].sort()
  if (codes.length > MAX_LESSONS) {
    out.truncated = true
    codes.length = MAX_LESSONS
  }

  // ─ 차시마다 여태 쓰던 그 길로 넣는다 ─
  for (const code of codes) {
    const result: InboxResult = await takeInbox(code, bag.byCode.get(code) as string[], overwrite)
    out.lessons.push({ code, result })
    out.found += result.found
    out.ask.push(...result.ask)
    out.failed.push(...result.failed)
    if (result.truncated) out.truncated = true
  }

  out.note = summary(out)
  return out
}

/** 사람이 읽을 한 줄. **화면에 그대로 찍히므로 별표를 쓰지 않는다.** */
function summary(out: SortedInbox): string {
  if (out.error) return out.error
  const took = out.lessons.reduce((s, l) => s + l.result.took.length, 0)
  const clash = out.lessons.reduce((s, l) => s + l.result.clash.length, 0)
  const same = out.lessons.reduce((s, l) => s + l.result.same.length, 0)
  if (!out.lessons.length && !out.papers.length && !out.ask.length && !out.failed.length) {
    return '넣은 것에 파일이 없습니다.'
  }
  const put: string[] = []
  if (out.lessons.length) put.push(`학습코드 ${out.lessons.length}개에 ${took}개`)
  const shots = out.papers.filter((p) => p.kind === 'figma').length
  if (shots) put.push(`figma 화면 ${shots}장`)
  if (out.papers.length > shots) put.push(`기획서 ${out.papers.length - shots}개`)
  const bits: string[] = put.length ? [`넣은 파일: ${put.join(', ')}.`] : []
  if (same) bits.push(`이미 있는 파일 ${same}개는 건너뛰었습니다.`)
  if (clash) bits.push(`이름은 같고 내용이 다른 파일 ${clash}개는 「덮어쓰기」로 교체할 수 있습니다.`)
  if (out.ask.length) bits.push(`분류하지 못한 파일이 ${out.ask.length}개 있습니다.`)
  if (out.failed.length) bits.push(`${out.failed.length}개는 넣지 못했습니다.`)
  if (out.truncated) bits.push('상한에 도달해 일부만 확인했습니다.')
  return bits.join(' ') || '넣을 파일이 없습니다.'
}
