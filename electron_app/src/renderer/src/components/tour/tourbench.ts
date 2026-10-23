import { useEffect, useRef, type MutableRefObject } from 'react'
import { hoLabel, shownModule, statusOf, type BoardResult, type BoardRow } from '../../../../shared/forge'
import { TARGET, TOUR_ANCHOR } from '../../lib/anchors'
import { NO_BENCH, NO_BENCH_MA, NO_BENCH_OPEN } from '../../lib/tour'

/**
 * **둘러보기가 작업대에 열 학습코드** (2026-10-16, `useTour.ts` 에서 뗐다).
 *
 * 진행판 결과만으로는 작업대가 대화 칸을 그릴지 다 알 수 없다. `prepare.ts` 는 배치표가 원본을 못 고르면(`layoutFor` 실패) 개발 완료 칸도
 * `made`(보기만)로 연다. 시험에서 9호 ENL1M08W1S1(PlaySparkLv2M2)이 그랬다 — 진행판은 모듈이 맞았는데 작업대는 대화 · 답 · 검수 · 커밋 ·
 * figma 칸을 안 그려 다섯 단계가 「이 화면에는 지금 없습니다」였다. 그래서 후보를 몇 개 두고, 작업대가 다 읽혔는데 대화 칸이 안 생기면 다음 후보로 바꾼다.
 * `window.api` 는 부르지 않는다 — 화면에 그려진 칸만 본다
 */

/** 바꿔 볼 후보 수 — 작업대를 열 때마다 메인이 학습코드를 읽으므로 많이 두지 않는다 */
export const BENCH_TRIES = 3
/** 작업대가 다 읽히기를(순서 막대) 이만큼 기다린다 — 열 때 `forgePrepare` 가 걸린다 */
const LOADED_WAIT_MS = 20_000
/** 다 읽힌 뒤 대화 칸을 이만큼 기다린다 — 대화 칸은 `forgeChatGet` 한 번만큼 늦게 그려진다(`ChatFlow.tsx`) */
const CHAT_WAIT_MS = 3_000

/** 진행판으로 보아 작업대가 다 그려질 듯한 개발 완료 칸 — 앞에 둘 후보. 이것만으로는 다 못 가린다(위 머리말) */
const fits = (row: BoardRow): boolean =>
  row.verdict !== '갈림' && row.verdict !== '없음' && row.hasSpec && row.module !== '' && shownModule(row) === row.module

export interface BenchPick {
  codes: string[]
  /** 지금 연 후보 차례 */
  at: number
  /** 열 학습코드가 없을 때 까닭 */
  why: string
}

export function benchPick(r: BoardResult): BenchPick {
  if (r.subject === 'MA') return { codes: [], at: 0, why: NO_BENCH_MA }
  const done = r.subject === 'EN' || r.subject === 'KO' ? r.rows.filter((row) => statusOf(row).status === '개발 완료') : []
  const codes = [...new Set([...done.filter(fits), ...done].map((row) => row.code))].slice(0, BENCH_TRIES)
  return { codes, at: 0, why: codes.length ? '' : NO_BENCH }
}

export const pickedCode = (p: BenchPick | null): string | null => p?.codes[p.at] ?? null

/** 학습코드의 호 이름 — 미리보기 칸의 「N호로 연결」과 같은 꼴 */
export const hoOf = (code: string): string | null => {
  const m = /M(\d\d)W/.exec(code)?.[1]
  return m ? hoLabel(m) : null
}

/**
 * 작업대 단계에서 연 후보가 대화 칸을 그리나 본다 — 안 그리면 다음 후보로 바꾸고 `bump` 로 다시 그린다.
 * 잰 결과는 앱을 켜 둔 동안 기억한다 — 다시 둘러볼 때 대화 칸이 없던 학습코드는 바로 건너뛰고, 있던 것은 다시 안 잰다
 */
export function useBenchCheck(pick: MutableRefObject<BenchPick | null>, code: string | null, onBench: boolean, bump: () => void): void {
  const seen = useRef(new Map<string, boolean>())
  useEffect(() => {
    if (!onBench || !code || seen.current.get(code) === true) return
    const next = (): void => {
      const p = pick.current
      if (!p || pickedCode(p) !== code) return
      p.at += 1
      if (p.at >= p.codes.length) p.why = NO_BENCH_OPEN
      bump()
    }
    if (seen.current.get(code) === false) return next()
    const began = Date.now()
    let loadedAt = 0
    let timer = 0
    const stop = (): void => window.clearInterval(timer)
    timer = window.setInterval(() => {
      const now = Date.now()
      if (document.getElementById(TARGET.chat)) {
        seen.current.set(code, true)
        return stop()
      }
      if (!loadedAt && document.getElementById(TOUR_ANCHOR.benchOrder)) loadedAt = now
      if (loadedAt ? now - loadedAt < CHAT_WAIT_MS : now - began < LOADED_WAIT_MS) return
      seen.current.set(code, false)
      stop()
      next()
    }, 300)
    return stop
  }, [onBench, code, pick, bump])
}
