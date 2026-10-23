import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardResult } from '../../../../shared/forge'
import { TOUR_ANCHOR } from '../../lib/anchors'
import { markTourSeen, NO_BOARD, takeTourPending, textOf, TOUR_STEPS, type TourStep } from '../../lib/tour'
import type { View } from '../SidebarHead'
import { benchPick, hoOf, pickedCode, useBenchCheck, type BenchPick } from './tourbench'

/**
 * **둘러보기의 차례와 화면 바꾸기** (2026-10-16, 계획 P6). 단계 표는 `lib/tour.ts`, 막 · 안내 상자는 `Tour.tsx`.
 *
 * - 작업대에 열 학습코드는 **지금 보이는 호의 진행판 결과**에서 개발 완료인 영어 · 국어 학습코드다(`tourbench.ts`).
 *   개발 완료면 공유 폴더 저절로 가져오기가 돌지 않는다(`shareauto.ts`). 대화 칸이 안 그려지면 다음 후보로, 없으면 작업대 단계는 글로만 보인다
 * - 그 학습코드는 **첫 작업대 단계에 들어갈 때** 고른다 — 시작할 때 고르면 처음 설정 뒤 4초 타이머로 시작했거나
 *   호를 막 바꿔 진행판 결과가 비어 있던 때 끝까지 글로만 보였다. 진행판을 아직 못 읽었으면 다음 작업대 단계에서 다시 고른다
 * - 고른 호(`setSelected`)는 바꾸지 않는다 — 바꾸면 `useBoard` 가 「마지막에 보던 호」를 고쳐 적는다
 * - 시작할 때 화면 · 열어 둔 학습코드 · 옆줄 접힘을 기억하고 끝나면 그대로 돌린다.
 *   설정 서랍은 **설정 단계에 들어가기 바로 전** 상태를 남겨, 둘러보기가 편 경우에만 접는다(알림 때문에 펴진 서랍은 그대로)
 * - `window.api` 를 부르지 않는다 — 읽는 것은 App 이 이미 가진 진행판 결과뿐이다
 */

export interface TourView {
  step: TourStep
  /** 이 단계의 글 — 함수 글은 연 학습코드의 호로 채웠다 */
  text: string
  index: number
  total: number
  /** 작업대에 연 학습코드 — 후보를 바꾸면 `Tour` 를 새로 그려 칸을 다시 찾게 한다(App 의 key) */
  code: string | null
  /** 작업대 단계인데 열 학습코드가 없을 때 그 까닭 한 줄 — 열었으면 빈 글 */
  noBench: string
  next: () => void
  prev: () => void
  /** 칸이 없는 단계를 건너뛴다 — 마지막으로 움직인 쪽으로 */
  skip: () => void
  end: () => void
}

/** 처음 설정 뒤 진행판 결과가 이만큼 안 오면 그냥 시작한다 — 작업대에 열 학습코드는 작업대 단계에서 고르므로 늦게 와도 된다 */
const AUTO_WAIT_MS = 4_000

const drawerEl = (): HTMLDetailsElement | null => {
  const el = document.getElementById(TOUR_ANCHOR.sideSettings)
  return el instanceof HTMLDetailsElement ? el : null
}

export function useTour({
  result,
  view: screen,
  forgeCode,
  setView,
  setForgeCode,
  setFolded
}: {
  result: BoardResult | null
  view: View
  forgeCode: string | null
  setView: (v: View) => void
  setForgeCode: (code: string | null) => void
  setFolded: (f: boolean | ((prev: boolean) => boolean)) => void
}): { view: TourView | null; start: () => void } {
  const [index, setIndex] = useState<number | null>(null)
  /** 고른 학습코드 — null 은 아직 안 고름 */
  const picked = useRef<BenchPick | null>(null)
  // 후보를 바꿨을 때 다시 그리기만 — 고른 것은 `picked` 가 든다
  const [, setTick] = useState(0)
  const bump = useCallback(() => setTick((n) => n + 1), [])
  // 시작이 지금 화면을 보게 — start 를 화면마다 새로 만들지 않는다(저절로 시작 효과가 start 를 deps 로 든다)
  const now = useRef({ screen, forgeCode })
  now.current = { screen, forgeCode }
  const was = useRef<{ folded: boolean; screen: View; code: string | null }>({ folded: false, screen: '진행판', code: null })
  /** 설정 단계 바로 전의 서랍 — null 은 아직 그 단계에 안 감 */
  const drawerBefore = useRef<boolean | null>(null)
  const dir = useRef<1 | -1>(1)

  const start = useCallback(() => {
    picked.current = null
    drawerBefore.current = null
    was.current.screen = now.current.screen
    was.current.code = now.current.forgeCode
    setFolded((f) => {
      was.current.folded = f
      return false
    })
    dir.current = 1
    setIndex(0)
  }, [setFolded])

  const end = useCallback(() => {
    setIndex(null)
    setView(was.current.screen)
    setForgeCode(was.current.code)
    setFolded(was.current.folded)
    // 서랍은 상태를 밖에서 못 바꾼다 — `open` 을 바꾸면 toggle 이 떠서 SettingsDrawer 가 따라온다
    const d = drawerEl()
    if (drawerBefore.current === false && d?.open) d.open = false
    markTourSeen()
  }, [setFolded, setForgeCode, setView])

  const go = useCallback((step: 1 | -1) => {
    dir.current = step
    setIndex((i) => {
      if (i === null) return i
      const to = i + step
      return to < 0 ? 0 : to
    })
  }, [])

  // 끝을 넘어가면 마친다
  useEffect(() => {
    if (index !== null && index >= TOUR_STEPS.length) end()
  }, [index, end])

  // 첫 작업대 단계에서 고른다 — 그리는 중에 골라야 그 단계의 첫 그림부터 「글로만」이 맞다(`Tour` 는 첫 그림으로 칸을 찾을지 정한다).
  // 같은 진행판 결과면 같은 답이라 두 번 그려도 같다. 진행판을 아직 못 읽었으면 결과가 오는 대로 다시 그려 고른다
  const step = index !== null && index < TOUR_STEPS.length ? TOUR_STEPS[index] : null
  if (step?.screen === 'bench' && !picked.current && result) picked.current = benchPick(result)
  const code = pickedCode(picked.current)
  useBenchCheck(picked, code, step?.screen === 'bench', bump)

  // 단계의 화면으로 — 작업대 단계는 고른 학습코드를 열고, 나머지는 진행판으로
  useEffect(() => {
    if (index === null || index >= TOUR_STEPS.length) return
    const at = TOUR_STEPS[index]
    setView('진행판')
    // `Tour` 는 칸을 150ms 뒤부터 찾아 짚으므로(spot 이 서랍을 편다) 여기서 재면 펴기 전이다
    if (at.anchor === TOUR_ANCHOR.sideSettings && drawerBefore.current === null) drawerBefore.current = drawerEl()?.open ?? null
    setForgeCode(at.screen === 'bench' ? code : null)
  }, [index, code, setView, setForgeCode])

  // 처음 설정 「마치기」 뒤 한 번만 저절로 — 진행판 결과가 오면 바로, 안 오면 조금 기다렸다가
  const pending = useRef<boolean | null>(null)
  useEffect(() => {
    if (pending.current === null) pending.current = takeTourPending()
  }, [])
  useEffect(() => {
    if (!pending.current) return
    if (result) {
      pending.current = false
      start()
      return
    }
    const t = window.setTimeout(() => {
      if (!pending.current) return
      pending.current = false
      start()
    }, AUTO_WAIT_MS)
    return () => window.clearTimeout(t)
  }, [result, start])

  if (index === null || !step) return { view: null, start }
  return {
    start,
    view: {
      step,
      text: textOf(step, code ? hoOf(code) : null),
      index,
      total: TOUR_STEPS.length,
      code,
      noBench: step.screen === 'bench' && !code ? (picked.current?.why ?? NO_BOARD) : '',
      next: () => go(1),
      prev: () => go(-1),
      skip: () => (index === 0 && dir.current === -1 ? go(1) : go(dir.current)),
      end
    }
  }
}
