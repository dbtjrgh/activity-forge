/**
 * **이름과 차례를 AI 가 정하게 한다** — 자리 세우기의 앞단 (자동양산 ㉥·㉢).
 *
 * `slots.ts` 가 「이 자리는 이 회차에 없어진다」까지 가려 놓으면, 남는 물음은
 * **폴더에 남은 파일을 어느 자리에 넣느냐**다. 파일 이름은 figma 에서 그대로
 * 받아 무작위(`Group 27.png`)일 수 있고, 이름이 멀쩡해도 **차례**는 이름에
 * 없다 — 8호는 fork·toothbrush·scissors·crayon·umbrella·wateringcan 이라
 * 알파벳순도 파일순도 아니다.
 *
 * **그림 한 장이 둘 다 들고 있다.** figma 화면을 같이 주고 물으니 이름도 차례도
 * 여섯 개 전부 맞았다 ($0.082 · 19초, 2026-09-15). 그래서 한 번에 묻는다.
 *
 * **스샷은 리소스 폴더의 `_figma` 에 둔다.** `_` 로 시작하는 폴더는 맞추기가
 * 리소스로 세지 않는다(`swapfolder.ts` 의 `readFolder`) — 안 그러면 스크린샷이
 * 「폴더에 남은 파일」로 자리 후보에 오른다.
 *
 * **믿지 않는다.** 이름은 폴더에 있는 파일인지, 차례는 1~N 이 빠짐없이 한
 * 번씩인지 `name.ts` 가 다시 본다. 차례 검산이 특히 세다 — 겹치거나 빠지면
 * **그림을 안 보고도** 틀린 것을 안다.
 *
 * **못 정한 자리는 그대로 둔다.** 자리 카드가 남아 사람이 고른다. 억지로
 * 채우면 조용히 틀린 액티비티가 나온다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer } from '../../../shared/forge'
import { askAi } from './ai'
import { nameBrief, readNames } from './name'
import { checkNames } from './namecheck'
import { inningOf, place, type Placed } from './seat'
import { figmaSpot } from './section'
import { shotNote, plansOf, shotsOf } from './shot'
import type { Forge } from './runtime'
import type { SlotJudge } from '@/gen/reslot'

export type OrderResult = {
  /** AI 를 실제로 불렀나 */
  ran: boolean
  /** 쓴 figma 화면. 없으면 빈 글 */
  shot: string
  brief: string
  took: number
  /** 검산을 통과해 자리에 얹은 것 */
  taken: Placed[]
  /** 물린 줄과 왜 물렸는지 */
  refused: { file: string; name: string; why: string }[]
  /** 차례 검산 한 줄. 온전하면 빈 글 */
  orderNote: string
  /** 사람이 읽을 한 줄 */
  note: string
  error: string
}

export function emptyOrder(): OrderResult {
  return { ran: false, shot: '', brief: '', took: 0, taken: [], refused: [], orderNote: '', note: '', error: '' }
}

/**
 * 낱말 자리에 넣을 파일을 AI 에게 묻고, **검산해서 답으로 돌려준다.**
 *
 * 돌려주는 답은 사람이 카드에서 고른 것과 **같은 꼴**(`#slot|…`)이다. 따로
 * 두면 「사람이 고친 것과 AI 가 넣은 것」이 두 벌이 되어 어느 쪽이 이기는지 흐려진다.
 */
export async function nameAndOrder(
  forge: Forge,
  code: string,
  judged: SlotJudge[],
  gameData: unknown,
  spare: string[]
): Promise<{ result: OrderResult; answers: Answer[] }> {
  const out = emptyOrder()
  const words = judged.filter((j) => j.verdict === '낱말')
  if (!words.length) {
    out.note = '새로 만들 항목이 없습니다.'
    return { result: out, answers: [] }
  }

  const dir = forge.files.rscDir(code)
  if (!dir) {
    out.error = '리소스 폴더 위치를 정하지 못했습니다.'
    return { result: out, answers: [] }
  }
  const shots = shotsOf(dir)
  const plans = plansOf(dir)
  out.shot = shotNote(shots)

  // **화면이 없으면 부르지 않고 달라고 한다.** 이름은 그림 없이도 고칠 수
  // 있지만 **차례는 이름에 없다** — 8호의 차례(fork·toothbrush·scissors·
  // crayon·umbrella·wateringcan)는 알파벳순도 파일순도 아니었다. 차례를 못
  // 정하면 자리에 얹을 것이 없으므로, 부르면 토큰만 나가고 답은 안 나온다.
  // **도구가 무엇을 달라고 할지 스스로 정하는 자리다.**
  if (!out.shot) {
    const spot = figmaSpot(forge.spec.parseStudyCode(code))
    out.note =
      'figma 화면이 없어 순서를 정할 수 없습니다. 화면을 캡처해 이 화면에서 ' +
      'Ctrl+V 로 붙여넣으세요. 이름과 순서를 한 번에 정합니다.' +
      (spot ? ` ${spot}` : '')
    return { result: out, answers: [] }
  }

  // 원본에서 그 자리가 몇 번째였나. 이것이 있어야 AI 의 「3번째」와 이어진다.
  const seat = new Map<string, number>()
  for (const j of words) {
    const n = inningOf(gameData, j.alias)
    if (n !== null) seat.set(`${j.kind}|${j.alias}`, n)
  }
  const innings = seat.size ? Math.max(...seat.values()) : null

  // **갈래마다 따로 묻는다.** 그림 여섯 장과 소리 여섯 개를 한꺼번에 주면
  // AI 가 한 차례에 둘씩 얹어 차례 검산이 통째로 걸린다. 갈래가 갈리면
  // 물음도 갈린다.
  const kinds = [...new Set(words.map((j) => j.kind))]
  const briefs: string[] = []
  const answers: Answer[] = []
  let ran = false

  for (const kind of kinds) {
    const mine = words.filter((j) => j.kind === kind)
    const files = spare.filter((f) => forge.files.kindOfRel(f) === kind).map((f) => f.split('/').pop() ?? f)
    if (!files.length) continue

    const brief = nameBrief(files, shots, innings, plans, dir)
    briefs.push(`# ${kind}\n\n${brief}`)

    // **울타리는 `cwd` 다.** 브리프에는 파일 이름만 적고 경로를 적지 않는다.
    const reply = await askAi(brief, dir)
    out.took += reply.took
    if (!reply.ok) {
      out.error = reply.error
      continue
    }
    ran = true

    const checked = checkNames(readNames(reply.text), files, innings)
    out.refused.push(...checked.refused)
    if (checked.orderNote) {
      // **차례가 안 맞으면 그 갈래는 통째로 물린다.** 한 자리만 틀려도 나머지가
      // 다 한 칸씩 밀리는 갈래라, 절반만 받는 것이 제일 나쁘다.
      out.orderNote = [out.orderNote, `${kind}: ${checked.orderNote}`].filter(Boolean).join(' ')
      continue
    }
    out.taken.push(...place(mine, checked.taken, seat, spare, answers))
  }

  out.ran = ran
  out.brief = briefs.join('\n\n---\n\n')
  out.note = note(out, words.length)
  return { result: out, answers }
}

function note(out: OrderResult, want: number): string {
  if (out.error && !out.taken.length) return out.error
  if (out.orderNote) return `순서가 맞지 않아 적용하지 않았습니다. ${out.orderNote}`
  if (!out.taken.length) return '항목을 하나도 정하지 못했습니다.'
  const left = want - out.taken.length
  return (
    `${want}개 항목 가운데 ${out.taken.length}개를 ${out.shot} 화면을 보고 정했습니다.` +
    (left ? ` 남은 ${left}개는 카드에서 고르세요.` : '')
  )
}
