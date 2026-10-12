/**
 * **도는 판의 상태를 메인이 든다** (2026-09-29, M4).
 *
 * 전에는 도는 상태를 화면(작업대)만 들고 있었다. 만드는 동안(MAL2 9분) 진행판으로 나갔다 돌아오면
 * 걸음이 빈 채로 다시 열렸고, 「만들기」를 또 누르면 **같은 판이 둘 돌아 돈이 두 번 나갔다.**
 *
 * - 같은 학습코드가 이미 돌고 있으면 **새로 안 돌리고** 도는 판의 약속을 그대로 돌려준다
 * - 돌아온 화면은 `stateOf` 로 지금까지의 걸음을 받아 이어 그린다
 * - 진행판 칸은 `runningSince` 로 「만드는 중 · m분」을 보인다
 *
 * 앱을 내리면 사라진다 — 그때는 도는 판도 같이 끝났으므로 맞다. Electron 을 import 하지 않는다(services 규칙).
 */

import type { RunResult, RunStep } from '../../../shared/forge'
import type { Emit } from './step'

type Live = { startedAt: number; steps: RunStep[]; done: Promise<RunResult> }

const live = new Map<string, Live>()

/** 돌고 있으면 그 판의 약속을, 아니면 새로 돌린 판의 약속을. 걸음은 여기서도 모아 둔다. */
export function track(code: string, emit: Emit, body: (emit: Emit) => Promise<RunResult>): Promise<RunResult> {
  const now = live.get(code)
  if (now) return now.done
  const steps: RunStep[] = []
  const keep: Emit = (step) => {
    const at = steps.findIndex((s) => s.name === step.name)
    if (at < 0) steps.push(step)
    else steps[at] = step
    emit(step)
  }
  const done = body(keep).finally(() => live.delete(code))
  live.set(code, { startedAt: Date.now(), steps, done })
  return done
}

/** 지금 돌고 있는 판 — 시작 시각과 지금까지의 걸음. 안 돌면 null. */
export function stateOf(code: string): { startedAt: number; steps: RunStep[] } | null {
  const now = live.get(code)
  return now ? { startedAt: now.startedAt, steps: [...now.steps] } : null
}

/** 그 학습코드가 돈 지 몇 ms 인가. 안 돌면 null — 진행판 칸이 읽는다. */
export function runningFor(code: string): number | null {
  const now = live.get(code)
  return now ? Date.now() - now.startedAt : null
}
