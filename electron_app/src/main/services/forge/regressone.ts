/**
 * **회귀 검사의 완성본 하나** (2026-10-15) — 창을 불러 돌리고(`PageRunner`, `main/regress.ts`), 창 상한을 지키고, 결과 한 줄을 만든다.
 * 차례 · 전체 상한 · 기록은 `regress.ts`.
 *
 * - 자동 진행이 있는 모듈은 끝 화면까지(`full`), 없는 모듈은 첫 이닝까지만(`first`) 본다 — 줄에 `mode` 를 같이 적는다
 * - 창이 `PAGE_LIMIT` 을 넘겨도 안 돌아오면(`PAGE_GUARD`) 기다리지 않는다 — 한 창이 판 전체를 붙잡지 않게.
 *   창 쪽이 먼저 끊으므로(평가마다 상한 · 창 하나 상한) 여기까지 오는 것은 그것도 안 먹은 때다
 * - 페이지가 답하지 않아 끊은 것(`stalled`)은 「못 감」이다 — 못 띄운 것(모름)과 다르다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { RegressRow } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { driverOf, driverScript } from './regressdrivers'
import { earlyScript, harnessScript, type PageMode } from './regresspage'
import type { RegressTarget } from './regresspick'

/** 페이지 시계를 이만큼 빠르게 돌린다(`regresspage.ts` `earlyScript`) */
export const WARP = 8
/** 한 완성본 실제 시각 — 처음 여는 호는 의존성 묶기 · 리소스 받기로 20초쯤 더 든다 */
const PAGE_LIMIT: Record<PageMode, number> = { full: 150_000, first: 90_000 }
/** 창이 `PAGE_LIMIT` 을 이만큼 넘겨도 안 돌아오면 기다리지 않는다 — 창 쪽 마지막 상한(30초)보다 길게 */
const PAGE_GUARD = 60_000

/** 창 하나의 형편 — 페이지의 `window.__regress` 를 줄인 것(`regresspage.ts` `SNAPSHOT`) */
export type PageSnap = { done: boolean; reached: boolean | null; shown: number | null; complete: number | null; data: number | null; note: string; log: string[] }
/** `stalled` — 페이지가 답하지 않아 끊었다(동기 무한 반복 같은 것) */
export type PageRun = { snap: PageSnap | null; errors: string[]; missing: string[]; took: number; error?: string; stalled?: boolean }
/** 주소를 숨긴 창에 띄우고 글을 넣어 끝날 때까지(또는 상한까지) 지켜본다 — `main/regress.ts` */
export type PageRunner = (url: string, early: string, scripts: string[], limitMs: number) => Promise<PageRun>

/** 끝까지 몰고 갈 수 있나 — 칸의 모듈 가운데 자동 진행이 있는 것이 하나라도 있으면 */
export const modeOf = (t: RegressTarget): PageMode => (driverOf(t.module) ? 'full' : 'first')

export function rowOf(t: RegressTarget, mode: PageMode, run: PageRun | null, note?: string): RegressRow {
  const s = run?.snap ?? null
  return {
    code: t.code,
    month: t.month,
    module: t.module,
    mode,
    reached: run?.stalled ? false : run && !run.error ? (s?.done ? s.reached : false) : null,
    innings: { done: s?.complete ?? null, shown: s?.shown ?? null, data: s?.data ?? null },
    errors: run?.errors ?? [],
    missing: run?.missing ?? [],
    took: run?.took ?? 0,
    log: s?.log ?? [],
    ...(note ? { note } : {})
  }
}

/** 창이 `ms` 까지 안 돌아오면 기다리지 않는다. 창이 던져도 그 판은 계속 간다 */
function guarded(run: Promise<PageRun>, ms: number): Promise<PageRun> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<PageRun>((ok) => {
    timer = setTimeout(
      () => ok({ snap: null, errors: [], missing: [], took: ms, stalled: true, error: `${ms / 1000}초가 지나도 창이 돌아오지 않아 기다리지 않고 넘어갔습니다. 숨긴 창이 남아 있을 수 있습니다.` }),
      ms
    )
  })
  const safe = run.catch((error: unknown): PageRun => ({ snap: null, errors: [], missing: [], took: 0, error: toMessage(error) }))
  return Promise.race([safe, late]).finally(() => clearTimeout(timer))
}

/** 완성본 하나 — 서버를 못 띄웠으면 그 까닭을 그대로 적는다 */
export async function runOne(t: RegressTarget, server: { port: number } | { error: string }, runner: PageRunner): Promise<RegressRow> {
  const driver = driverOf(t.module)
  const mode = modeOf(t)
  if ('error' in server) return rowOf(t, mode, null, server.error)
  const scripts = [harnessScript(mode), ...(driver ? [driverScript(driver.body)] : [])]
  const run = await guarded(runner(`http://localhost:${server.port}/${t.code}/`, earlyScript(WARP), scripts, PAGE_LIMIT[mode]), PAGE_LIMIT[mode] + PAGE_GUARD)
  const note = run.stalled
    ? run.error
    : run.error
      ? `띄우지 못했습니다: ${run.error}`
      : !run.snap?.done
        ? `상한 ${PAGE_LIMIT[mode] / 1000}초 안에 끝나지 않았습니다.`
        : run.snap.note || (mode === 'first' ? '자동 진행이 없는 모듈이라 첫 이닝까지만 봤습니다.' : '')
  return rowOf(t, mode, run, note || undefined)
}
