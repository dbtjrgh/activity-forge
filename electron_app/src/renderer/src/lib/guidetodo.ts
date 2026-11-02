import type { GuideItem, RscGuide } from '../../../shared/forge'
import { kindName } from './format'

/**
 * **받을 리소스 창의 할 일** (2026-10-28, 사용자 요청) — 「무엇을 직접 넣고 무엇은 앱이 하나」 · 「다 넣었나」를 맨 위 몇 줄로.
 *
 * 전에는 원본 목록 전부를 한 진행 막대로 셌다. 원본 소리 이름(`SL_ko_321_s1_nar06`)은 이 학습코드 이름이 될 수 없어
 * 끝까지 「아직」이었고, 막대가 차지 않으니 끝났는지 몰랐다. 그래서 할 일마다 근거를 따로 둔다.
 * - **그림** — figma 에서 내보내는 것은 그림뿐이다. 원본 기준 수라 새 디자인과 다를 수 있다
 * - **소리** — 기획서에 적힌 이 학습코드 이름이 있으면 그것만(`plan`), 없으면 원본 이름 수로
 * - **대사** — 성우 성별을 고르면 앱이 앞 호 대사를 가져온다(`talk` 이 `auto` 로 바뀐다)
 * - 크기 · 수로만 맞춘 것(`hint`)은 확실하지 않다 — 다 했다고 할 때도 그렇다고 같이 말한다(저장소 CLAUDE.md 6번)
 * `window.api` 를 모른다 — 받은 값만 본다.
 */

/** left 아직 할 것 · guess 왔지만 짝은 확인 못 함 · done 다 됨 · none 할 일 없음 */
export type TodoState = 'left' | 'guess' | 'done' | 'none'
export interface TodoRow {
  key: string
  title: string
  state: TodoState
  text: string
  /** 펼쳐 보일 이름 — 기획서에 적혔는데 없는 소리 */
  names?: string[]
}

const isSure = (i: GuideItem): boolean => i.state === 'name' || i.state === 'set'
const isWait = (i: GuideItem): boolean => i.state === 'wait'

/** 기획서로 소리를 셀 수 있었나 — 셌으면 원본 소리(대사 말고)는 할 일에서 뺀다 */
export const planCounts = (g: RscGuide): boolean => !g.plan.note && g.plan.names > 0

/** 할 일로 셀 원본 항목 — 앱이 가져오는 것, 기획서로 센 소리의 원본 이름은 뺀다 */
export function wantOf(g: RscGuide): GuideItem[] {
  const byPlan = planCounts(g)
  return g.items.filter((i) => i.state !== 'auto' && !(byPlan && i.kind === 'sound' && !i.talk))
}

/**
 * 아직 안 온 수 — 같은 크기 묶음이 덜 찼으면 그 묶음은 모두 「아직」이라, 묶음에 들어온 수를 뺀다.
 * 안 뺐더니 같은 크기 다섯 장 가운데 세 장을 넣어도 「5장이 아직 없습니다」였다
 */
function waitCount(items: GuideItem[]): number {
  const wait = items.filter(isWait)
  const groups = new Map(wait.flatMap((i) => (i.group ? [[`${i.group.size}|${i.group.of}`, i.group.got] as const] : [])))
  return wait.length - [...groups.values()].reduce((a, b) => a + b, 0)
}

function pictureRow(items: GuideItem[]): TodoRow | null {
  if (!items.length) return null
  const title = 'figma에서 내보낼 그림'
  const wait = waitCount(items)
  if (wait) return { key: 'image', title, state: 'left', text: `원본 기준으로 ${wait}장이 아직 없습니다. 아래 그림을 보고 figma에서 내보내세요.` }
  const unsure = items.filter((i) => !isSure(i)).length
  if (unsure) return { key: 'image', title, state: 'guess', text: `${items.length}장이 들어왔습니다. ${unsure}장은 이름이 달라 대화에서 짝을 맞춥니다.` }
  return { key: 'image', title, state: 'done', text: `${items.length}장을 다 넣었습니다.` }
}

function soundRow(g: RscGuide, items: GuideItem[]): TodoRow | null {
  const title = '소리'
  const unsure = g.plan.unsure.length ? ` 범위로만 적힌 이름 ${g.plan.unsure.length}개는 확인하지 못했습니다.` : ''
  if (planCounts(g)) {
    const miss = g.plan.missing
    if (!miss.length) return { key: 'sound', title, state: 'done', text: `기획서에 적힌 소리 ${g.plan.names}개가 다 있습니다.${unsure}` }
    return {
      key: 'sound',
      title,
      state: 'left',
      text: `기획서에 적힌 소리 ${g.plan.names}개 중 ${miss.length}개가 없습니다. 위 「공유 폴더」에서 가져오고, 거기에도 없으면 디자인 쪽에 요청하세요.${unsure}`,
      names: miss
    }
  }
  if (!items.length) return null
  // 기획서는 있는데 이 학습코드 이름을 하나도 못 읽은 때도 말한다 — 9호 기획서가 오류 없이 빈 글로 읽힌 적이 있다(함정 문서)
  const why = g.plan.note ? `${g.plan.note} ` : '기획서에서 이 학습코드 소리 이름을 읽지 못했습니다. '
  const wait = waitCount(items)
  if (wait) return { key: 'sound', title, state: 'left', text: `${why}원본 기준으로 ${wait}개가 아직 없습니다. 위 「공유 폴더」에서 가져오세요.` }
  return { key: 'sound', title, state: 'guess', text: `${why}원본과 같은 수가 들어왔습니다.` }
}

function voiceRow(talk: GuideItem[]): TodoRow | null {
  if (!talk.length) return null
  const title = '대사 성우'
  if (talk.some(isWait)) return { key: 'voice', title, state: 'left', text: '아래 「대사 성우」에서 성별을 고르면 앱이 같은 성우의 대사를 가져옵니다.' }
  return { key: 'voice', title, state: talk.every(isSure) ? 'done' : 'guess', text: '대사가 들어왔습니다.' }
}

/** 영상 · 로티 · 글꼴 — 종류마다 한 줄 */
function otherRows(items: GuideItem[]): TodoRow[] {
  const kinds = [...new Set(items.map((i) => kindName(i.kind, i.name)))]
  return kinds.map((k) => {
    const of = items.filter((i) => kindName(i.kind, i.name) === k)
    const wait = waitCount(of)
    if (wait) return { key: `other-${k}`, title: k, state: 'left', text: `${wait}개가 아직 없습니다. 위 「공유 폴더」에서 가져오거나 따로 받으세요.` }
    return { key: `other-${k}`, title: k, state: of.every(isSure) ? 'done' : 'guess', text: `${of.length}개가 들어왔습니다.` }
  })
}

export function guideTodo(g: RscGuide): TodoRow[] {
  const want = wantOf(g)
  const auto = g.items.filter((i) => i.state === 'auto').length
  const rows = [
    pictureRow(want.filter((i) => i.kind === 'image')),
    soundRow(g, want.filter((i) => i.kind === 'sound' && !i.talk)),
    voiceRow(want.filter((i) => i.talk)),
    ...otherRows(want.filter((i) => i.kind !== 'image' && i.kind !== 'sound')),
    auto ? { key: 'auto', title: '앱이 가져오는 리소스', state: 'none' as const, text: `원본에서 ${auto}개를 가져옵니다. 넣지 않아도 됩니다.` } : null
  ]
  return rows.filter((r): r is TodoRow => r !== null)
}

/** 맨 위 한 문장 — 남은 할 일 수. 다음 단계는 안 적는다(이 창은 대화가 도는지 · 끝났는지 모른다) */
export function todoVerdict(rows: TodoRow[]): { done: boolean; text: string } {
  const left = rows.filter((r) => r.state === 'left').length
  if (left) return { done: false, text: `남은 할 일이 ${left}가지입니다.` }
  const guess = rows.some((r) => r.state === 'guess')
  return { done: true, text: `할 일을 다 했습니다.${guess ? ' 이름이 다른 파일은 대화에서 짝을 맞춥니다.' : ''}` }
}
