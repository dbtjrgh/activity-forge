/**
 * 걸음 하나를 진행하고 **끝날 때마다 알린다.**
 *
 * 클론과 맞추기는 원본의 파일을 통째로 읽어 몇 초가 걸린다. 그동안 아무 말이
 * 없으면 「눌렀는데 아무 일도 안 일어난다」로 보인다. 그래서 걸음마다 두 번
 * 알린다 — 시작할 때 한 번(`run`), 끝나고 한 번.
 *
 * **「양산 시작」과 「실제로 쓰기」가 같은 것을 쓴다.** 두 벌로 두면 걸음
 * 이름이나 알리는 때가 갈라지고, 화면은 이름으로 걸음을 갈아끼우므로
 * 그 순간 줄이 두 개로 늘어난다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { RunStep } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'

export type Emit = (step: RunStep) => void

/**
 * 걸음을 하나 진행한다. 시작할 때 한 번, 끝나고 한 번 — 두 번 알린다.
 *
 * **`tick` 을 주면 도는 동안에도 계속 알린다** (2026-09-21 사용자 말 —
 * 「도는중 너무 오래 걸리는거 아니냐.. 최소한 뭐 하고 있는지라도 알려주던가」).
 * AI 를 부르는 걸음은 몇 분이 걸리는데 그동안 걸음 줄이 **글자 하나 없이**
 * 멈춰 있었다. 그러면 도는 중인지 멈춘 것인지 사람이 알 길이 없다 —
 * 저장소 규칙 6번(모른다를 숨기지 않는다)에 걸리는 자리다.
 *
 * 화면은 걸음을 **이름으로 갈아끼우므로**(`RunSteps.merge`) 같은 이름으로
 * 다시 보내면 줄이 늘지 않고 그 자리에서 글자만 바뀐다.
 */
export function stepper(out: RunStep[], emit: Emit) {
  return async function step<T>(
    name: string,
    body: () => T | Promise<T>,
    done: (v: T) => RunStep,
    /** 몇 초째인지 받아 「지금 무엇을 하고 있나」를 적는다. 없으면 안 알린다 */
    tick?: (seconds: number) => string
  ): Promise<T> {
    emit({ name, state: 'run', note: tick ? tick(0) : '' })
    const at = Date.now()
    const timer = tick
      ? setInterval(
          () => emit({ name, state: 'run', note: tick(Math.round((Date.now() - at) / 1000)) }),
          1000
        )
      : null
    let value: T
    try {
      value = await body()
    } catch (error) {
      const failed: RunStep = { name, state: 'fail', note: toMessage(error) }
      out.push(failed)
      emit(failed)
      throw error
    } finally {
      // **반드시 끈다.** 안 끄면 끝난 걸음을 계속 `run` 으로 덮어써서
      // 결과가 나와도 화면이 도는 것처럼 보인다.
      if (timer) clearInterval(timer)
    }
    const finished = done(value)
    out.push(finished)
    emit(finished)
    return value
  }
}

/** 여기서 멈춘다는 뜻. 걸음은 이미 `fail` 로 알렸으므로 말을 더 얹지 않는다. */
export class Stop extends Error {}

export type Step = ReturnType<typeof stepper>
