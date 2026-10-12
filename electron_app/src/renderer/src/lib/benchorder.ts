/**
 * **작업대 순서 막대의 셈** (2026-10-01 사용자 요청 — 「필요한 것 · 순서 · 뭘 우선으로 할지 하이라이트로」).
 *
 * 지금 할 일은 **하나만** 고른다 — 여럿을 강조하면 아무것도 강조하지 않은 것과 같다.
 * 새로 재지 않는다: 작업대가 이미 읽은 값(부족한 리소스 · 화면 장수 · 대화 형편 · 호 저장소에 쓴 것 · 개발 완료)만 본다.
 * 진행판 칸의 「다음 할 일」(`shared/forge/status.ts`)과 같은 차례다 — 도는 중 → 대화가 기다림 → 개발 완료 → 리소스 → 화면 → 검수.
 * 둘이 어긋나면 칸은 「질문 2」인데 작업대는 「리소스가 부족합니다」를 강조한다(2026-10-08 리뷰).
 *
 * `target` 은 강조할 칸의 id — `Bench.tsx` 가 그 id 를 칸에 단다.
 */

import { chatWaiting, type ChatInfo, type Prepare } from '../../../shared/forge'

export type OrderState = 'done' | 'now' | 'todo' | 'run'

export interface OrderStep {
  key: string
  label: string
  state: OrderState
  target: string
}

export interface Order {
  steps: OrderStep[]
  /** 지금 할 일 한 문장. 다 끝났으면 완료 안내 */
  say: string
  /** 지금 할 일의 칸 id — 없으면 강조하지 않는다 */
  target: string
  /** 더 할 수 없는 칸(모듈 · 스펙이 없음) — 막대 대신 이 말만 */
  blocked: boolean
}

export const TARGET = {
  need: 'bench-need',
  shot: 'bench-shot',
  done: 'bench-done',
  layout: 'bench-layout',
  chat: 'bench-chat',
  answer: 'bench-answer'
} as const

interface Input {
  data: Prepare
  canRun: boolean
  busy: boolean
  /**
   * 대화로 만들기의 형편 — 생성 · 질문은 대화가 하고, 반영은 Claude 가 호 저장소에 직접 쓰므로 따로 없다 (2026-10-08).
   * 아직 못 읽었으면 null
   */
  chat: ChatInfo | null
}

export function orderOf({ data, canRun, busy, chat }: Input): Order {
  // 「갈림」은 작업대에 고르는 칸이 없다 — 진행판의 「모듈 선택이 필요한 학습코드」 카드(`LayoutPicks.tsx`)가 같은 배치표에 적는다.
  // 글은 그 카드 제목 그대로 부른다. MA 는 그 학습코드에 놓인 기획서의 모듈넘버로 작업대를 읽을 때 먼저 채운다
  // (`prepare.ts` → `layoutfill.ts`) — 여기까지 왔으면 기획서가 없거나 모듈넘버를 못 읽은 것이라 고르라고만 한다
  if (!canRun && data.layout.verdict === '갈림') {
    return { steps: [], say: '진행판의 「모듈 선택이 필요한 학습코드」에서 모듈을 고르세요.', target: TARGET.layout, blocked: true }
  }
  // 새 모듈의 첫 학습코드 — 원본이 없어 대화로는 못 만든다. Claude Code 세션에서 만들어 호 저장소에 있으면 검수만 남는다
  if (!canRun && data.layout.first) {
    if (data.finished === true) return { steps: [], say: '모든 단계를 마쳤습니다.', target: '', blocked: false }
    if (data.written) return { steps: [], say: '미리보기로 확인한 뒤 검수 완료를 누르세요.', target: TARGET.done, blocked: false }
    return { steps: [], say: '첫 학습코드라 원본이 없어 대화로 생성할 수 없습니다.', target: TARGET.layout, blocked: true }
  }
  if (!canRun) return { steps: [], say: '모듈과 원본을 먼저 선택하세요.', target: TARGET.layout, blocked: true }
  if (!data.hasSpec) {
    return { steps: [], say: `${data.layout.module} 모듈의 스펙이 없어 생성할 수 없습니다.`, target: TARGET.layout, blocked: true }
  }

  const gap = data.need.reduce((n, r) => n + Math.max(0, r.origin - r.here), 0)
  const finished = data.finished === true
  const talk = chat?.state ?? 'idle'
  const halted = talk === 'stopped' || talk === 'error'
  // 이어 갈 대화가 사람을 기다린다 — 진행판처럼 리소스 · 화면 · 개발 완료보다 먼저다
  const waiting = chatWaiting(chat)
  // 호 저장소에 이미 있다 — 진행판의 「만들었음」이라 칸은 리소스 부족을 더 세지 않는다(`boardwork.ts` gap)
  const built = data.written || talk === 'done'
  // 그중 이어 갈 대화가 없는 것(이전 방식 · 손으로 만듦 · 대화 기록을 지움) — 생성 · 질문은 지난 일이다.
  // 안 보면 칸은 「검수 대기」인데 막대는 다 만든 것을 두고 「대화로 생성을 누르세요」라 한다
  const byHand = data.written && !chat?.sessionId

  const list: { key: string; label: string; done: boolean; target: string; say: string; skip?: boolean }[] = [
    {
      key: 'rsc',
      label: '리소스',
      done: finished || built || (data.rsc.files.length > 0 && gap === 0),
      target: TARGET.need,
      say: gap > 0 ? `리소스 ${gap}개가 부족합니다. 받을 리소스 보기로 확인하고 넣으세요.` : '리소스 파일을 넣으세요.'
    },
    {
      key: 'shot',
      label: 'figma 화면',
      // 대화로 다 만든 것은 화면을 다시 묻지 않는다 — 이미 그 입력으로 만들었다(진행판과 같다)
      done: finished || data.shots > 0 || talk === 'done',
      skip: !data.needsShot,
      target: TARGET.shot,
      say: 'figma 화면을 캡처해 붙여넣으세요.'
    },
    {
      key: 'make',
      label: '생성',
      done: finished || byHand || waiting || talk === 'checking' || talk === 'done',
      target: TARGET.chat,
      say: '대화로 생성을 누르세요.'
    },
    {
      key: 'asks',
      label: '질문 답변',
      done: finished || byHand || talk === 'done',
      target: TARGET.answer,
      say: halted ? '대화가 멈췄습니다. 오른쪽에 답을 적어 이어 가세요.' : '오른쪽에서 Claude 의 질문에 답하세요.'
    },
    {
      key: 'done',
      label: '검수 완료',
      done: finished,
      target: TARGET.done,
      say: '미리보기로 확인한 뒤 검수 완료를 누르세요.'
    }
  ]
  const shown = list.filter((s) => !s.skip)
  const step = (key: string) => shown.find((s) => s.key === key)
  // 도는 중이면 「생성」, 대화가 기다리면 「질문 답변」이 지금 할 일이다 — 앞 단계가 덜 끝났거나 개발 완료여도(진행판과 같은 차례).
  // 다 끝난 칸을 다시 생성하는 중에 막대가 「모든 단계를 마쳤습니다」라 하거나, 리소스 칸이 도는 중으로 보이지 않게
  const now = (busy ? step('make') : waiting ? step('asks') : undefined) ?? shown.find((s) => !s.done)
  const steps: OrderStep[] = shown.map((s) => ({
    key: s.key,
    label: s.label,
    target: s.target,
    state: s === now ? (busy ? 'run' : 'now') : s.done ? 'done' : 'todo'
  }))
  if (!now) return { steps, say: '모든 단계를 마쳤습니다.', target: '', blocked: false }
  return { steps, say: busy ? '실행 중입니다. 끝나면 다음 단계를 안내합니다.' : now.say, target: busy ? '' : now.target, blocked: false }
}
