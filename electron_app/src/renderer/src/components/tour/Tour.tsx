import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { TOUR_ANCHOR } from '../../lib/anchors'
import { spot } from '../../lib/spot'
import { BENCH_LOADED_MS, MISSING, waitOf } from '../../lib/tour'
import type { TourView } from './useTour'
import './tour.css'

/**
 * **둘러보기의 막과 안내 상자** (2026-10-16, 계획 P6). 켜진 동안만 그려진다 — 아래 빗장도 그동안만 걸린다.
 *
 * ① 화면 전체를 막이 덮는다. 짚는 칸 자리만 밝히고(구멍은 누름을 안 받아 막이 받는다), 안내 상자 단추만 눌린다
 * ② 창 capture 단계에서 키(Esc · ← · → 와 상자 안 Enter 만 둘러보기가 받는다) · 붙여넣기 · 끌어 놓기를 막는다.
 *    figma 화면 붙여넣기(`ShotPaste`)와 어디든 놓기(`DropAll`)가 창에서 듣기 때문이다
 * ③ 칸은 `spot(id, { focus: false })` 로 짚는다 — 미리보기 칸의 첫 단추에 커서가 가면 Enter 한 번에 정션이 바뀐다
 * ④ `window.api` 를 부르지 않는다 ⑤ `window.confirm` 을 쓰지 않는다(CDP 가 멈춘다)
 */

type Seek = 'seek' | 'found' | 'missing' | 'text'

const POLL_MS = 150
const PAD = 6
/** 상자와 창 가장자리 사이 — 상자 최대 너비(창 너비 - 양쪽)도 이것으로 */
const GAP = 12
/** 상자 너비 — 자리 계산과 그리기가 같이 쓴다(CSS 에 따로 적지 않는다) */
const BOX_W = 340

const stop = (e: Event): void => {
  e.preventDefault()
  e.stopPropagation()
}

/** 칸이 화면에 있고 크기가 0 이 아닌가 — 접힌 옆줄(display none)은 0 이다 */
function shown(id: string): HTMLElement | null {
  const el = document.getElementById(id)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

/** 구멍 자리 — 창 밖으로 나간 부분은 자른다 */
function holeOf(el: HTMLElement): DOMRect | null {
  const r = el.getBoundingClientRect()
  const left = Math.max(r.left - PAD, 0)
  const top = Math.max(r.top - PAD, 0)
  const right = Math.min(r.right + PAD, window.innerWidth)
  const bottom = Math.min(r.bottom + PAD, window.innerHeight)
  return right > left && bottom > top ? new DOMRect(left, top, right - left, bottom - top) : null
}

/** 상자 자리 — 칸 아래, 모자라면 위, 둘 다 안 되면 오른쪽 아래 구석 */
function placeOf(hole: DOMRect | null, boxH: number): CSSProperties {
  if (!hole) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.min(Math.max(hole.left, GAP), Math.max(GAP, vw - BOX_W - GAP))
  if (hole.bottom + GAP + boxH <= vh - GAP) return { left, top: hole.bottom + GAP }
  if (hole.top - GAP - boxH >= GAP) return { left, top: hole.top - GAP - boxH }
  return { left: Math.max(GAP, vw - BOX_W - GAP), top: Math.max(GAP, vh - boxH - GAP) }
}

const same = (a: DOMRect | null, b: DOMRect | null): boolean =>
  a === b || Boolean(a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height)

export default function Tour({ view }: { view: TourView }) {
  const { step, index, total, noBench } = view
  const box = useRef<HTMLDivElement>(null)
  const latest = useRef(view)
  latest.current = view
  // 부르는 쪽이 단계마다 새로 그린다(`key`) — 앞 단계의 「찾음」 · 구멍 자리가 다음 단계로 넘어오지 않게
  const [seek, setSeek] = useState<Seek>(step.anchor && !noBench ? 'seek' : 'text')
  const [hole, setHole] = useState<DOMRect | null>(null)
  const [boxH, setBoxH] = useState(160)
  // 작업대가 다 읽혔나(순서 막대가 보임) — 그 뒤로는 「불러오는 중」을 안 보인다
  const [loaded, setLoaded] = useState(false)
  const titleId = useId()

  // ② 막는 빗장 — 그려져 있는 동안 건다. 단계를 넘기는 함수는 `latest` 로 지금 것을 본다
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const v = latest.current
      const inBox = Boolean(box.current && e.target instanceof Node && box.current.contains(e.target))
      // 상자 안 단추는 Enter 로 누른다 — 그 밖의 키는 모두 막는다
      if (e.key === 'Enter' && inBox && e.target !== box.current) return
      stop(e)
      if (e.key === 'Escape') v.end()
      else if (e.key === 'ArrowRight' || (e.key === 'Enter' && inBox)) v.next()
      else if (e.key === 'ArrowLeft') v.prev()
    }
    // 커서가 상자 밖으로 나가면 되돌린다 — 아래 단추가 커서를 들고 있으면 막을 지나 Enter 가 갈 길이 생긴다
    const onFocus = (e: FocusEvent): void => {
      if (box.current && e.target instanceof Node && !box.current.contains(e.target)) box.current.focus({ preventScroll: true })
    }
    const blocked = ['paste', 'dragenter', 'dragover', 'drop'] as const
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('focusin', onFocus, true)
    for (const t of blocked) window.addEventListener(t, stop, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('focusin', onFocus, true)
      for (const t of blocked) window.removeEventListener(t, stop, true)
    }
  }, [])

  // 단계마다 칸을 기다린다 — 생기면 짚고, 시간 안에 안 생기면 「없습니다」(건너뛰는 단계는 바로 넘긴다)
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement && !box.current?.contains(document.activeElement)) document.activeElement.blur()
    box.current?.focus({ preventScroll: true })
    if (!step.anchor || noBench) return
    const id = step.anchor
    let until = Date.now() + waitOf(step)
    let ready = false
    const t = window.setInterval(() => {
      if (shown(id)) {
        window.clearInterval(t)
        spot(id, { focus: false })
        setSeek('found')
        return
      }
      // 작업대가 다 읽혔는데 칸이 없으면 그때부터 조금만 더 기다린다 — 지난 호 완성본은 대화 칸 · 검수 칸이 끝내 안 그려진다.
      // 15초와 견주어 짧은 쪽을 고르지 않는다 — 대화 칸 둘은 chat.info 가 와야 그려지므로(ChatFlow · ChatSide) 늦게 읽힌 작업대에서 굶는다
      if (!ready && step.screen === 'bench' && shown(TOUR_ANCHOR.benchOrder)) {
        ready = true
        until = Date.now() + BENCH_LOADED_MS
        setLoaded(true)
      }
      if (Date.now() > until) {
        window.clearInterval(t)
        if (step.optional) latest.current.skip()
        else setSeek('missing')
      }
    }, POLL_MS)
    return () => window.clearInterval(t)
  }, [step, noBench])

  // 짚은 칸을 따라간다 — 부드럽게 스크롤하는 동안 · 창 크기가 바뀔 때 자리가 움직인다
  useEffect(() => {
    if (seek !== 'found' || !step.anchor) return
    const id = step.anchor
    let raf = 0
    const tick = (): void => {
      const el = document.getElementById(id)
      const next = el ? holeOf(el) : null
      setHole((prev) => (same(prev, next) ? prev : next))
      const h = box.current?.offsetHeight ?? 0
      if (h) setBoxH((prev) => (prev === h ? prev : h))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seek, step.anchor])

  const lit = seek === 'found' && hole
  const last = index === total - 1
  return createPortal(
    <>
      <div className={`tour-catch${lit ? '' : ' tour-dim'}`} onMouseDown={(e) => e.preventDefault()} />
      {lit && <div className="tour-hole" style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }} />}
      <div
        ref={box}
        className="tour-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ ...placeOf(lit ? hole : null, boxH), width: BOX_W, maxWidth: `calc(100vw - ${GAP * 2}px)` }}
      >
        <div className="tour-head">
          <b id={titleId} className="tour-title">
            {step.title}
          </b>
          <span className="tour-count">
            {index + 1} / {total}
          </span>
        </div>
        <p className="tour-text">{view.text}</p>
        {noBench && <p className="tour-note">{noBench}</p>}
        {seek === 'seek' && step.screen === 'bench' && !loaded && <p className="tour-wait">화면을 불러오는 중입니다.</p>}
        {seek === 'missing' && <p className="tour-note">{MISSING}</p>}
        <div className="tour-foot">
          <button className="ghost" onClick={view.end}>
            그만 보기
          </button>
          <button className="ghost" onClick={view.prev} disabled={index === 0}>
            이전
          </button>
          <button className="go" onClick={last ? view.end : view.next}>
            {last ? '마치기' : '다음'}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
