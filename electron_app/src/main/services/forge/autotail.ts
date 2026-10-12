/**
 * 「양산」 한 단추의 **끝 걸음** — 걸음 챙기기 · 끝까지 저절로 · 잰 값 적기.
 *
 * `auto.ts` 가 200줄을 넘어 갈랐다 (2026-09-21, 동작 변화 없음).
 * 흐름(돌리기 → 화면 보기 → 맡기기 → 다시 돌리기)은 `auto.ts` 에 있고,
 * 여기는 **어느 길로 끝나든 똑같이 해야 하는 것**만 있다.
 *
 * 갈라 둔 까닭이 하나 더 있다 — 화면이 없어 AI 를 안 부르고 멈추는 길
 * (`shotfirst.ts`)이 생기면서 **끝 걸음이 두 군데에서 불린다.** 복붙해 두면
 * 한쪽만 고쳐져서 「그 길로 끝나면 잰 값이 안 남는다」가 된다 (저장소 규칙 3).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { AutoTrace, RunResult, RunStep } from '../../../shared/forge'
import { finishUp, type OnLog } from './finish'
import { addSpent, mark, record } from './measure'
import { loadForge } from './runtime'
import type { Emit } from './step'

/**
 * 결과를 마무리한다 — 걸음을 정본으로 바꾸고, 갈 수 있으면 쓰기·띄우기까지,
 * 그 판의 형편을 적는다.
 */
export async function wrapUp(
  code: string,
  out: RunResult,
  seen: RunStep[],
  trace: AutoTrace,
  emit: Emit,
  onLog: OnLog,
  view = true
): Promise<RunResult> {
  // **걸음은 모아 둔 것이 정본이다.** 마지막 `runDry` 것만 담으면 AI 걸음이
  // 통째로 사라진다 — 무엇을 하느라 오래 걸렸는지가 안 보인다.
  out.steps = seen
  out.auto = trace

  // ─ 끝까지 저절로 (6단계) ─
  // **카드가 0 이면 쓰기와 띄우기를 이어서 한다.** 갈 수 있는지는 `finish.ts`
  // 가 다섯 가지를 그대로 보고 정한다 — 여기서는 잇기만 한다.
  const done = await finishUp(code, out, emit, onLog, view)
  const final = done.out
  final.steps = seen
  final.auto = trace
  final.finish = done.trace

  // 그 판의 형편을 적어 둔다 — 남은 카드와 AI 값. 3·5단계의 끝 기준이
  // 이 숫자다 (`measure.ts`).
  await recordRun(code, {
    cards: final.asks.filter((a) => !a.done).length,
    calls: trace.calls,
    tokens: trace.tokens,
    ...(final.wrote ? { wrote: true } : {})
  })
  if (trace.spent) await spendRun(code, trace.spent)
  return final
}

/** 실제로 부른 몫을 그 판에 더한다. **재다가 양산을 넘어뜨리지 않는다.** */
async function spendRun(code: string, s: NonNullable<AutoTrace['spent']>): Promise<void> {
  try {
    addSpent((await loadForge()).paths.REPO_ROOT, code, s)
  } catch {
    // 못 적으면 안 적는다.
  }
}

/**
 * 잰 것에 한 줄 적는다. **재다가 양산을 넘어뜨리지 않는다** — forge 를 못
 * 불러도 그냥 안 적고 지나간다.
 */
export async function markRun(code: string, what: string, note?: string): Promise<void> {
  try {
    const forge = await loadForge()
    mark(forge.paths.REPO_ROOT, code, what, note)
  } catch {
    // 못 적으면 안 적는다.
  }
}

async function recordRun(code: string, patch: Parameters<typeof record>[2]): Promise<void> {
  try {
    const forge = await loadForge()
    record(forge.paths.REPO_ROOT, code, patch)
  } catch {
    // 위와 같다.
  }
}
