/**
 * 「양산」 한 단추 (3단계) — **흐름만.** 새 일은 하나도 하지 않는다.
 *
 *   양산 시작(`runDry`) → 남은 카드가 있나
 *     ├ **figma 화면이 없으면** 어디를 찍으라고 카드로 말하고 **멈춘다.**
 *     │  AI 를 한 번도 안 부른다 (`shotfirst.ts`)
 *     └ 화면이 있으면 `matchByAi`(곁걸음 둘을 안에서 같이 부른다) →
 *        다시 `runDry` → `reviseByAi` → 그래도 모르는 것만 카드로
 *
 * **화면이 먼저다** (2026-09-21 사용자 결정). 전에는 「AI 가 곤란해하면
 * 그때서야」 화면을 요구했는데, 사람이 손으로 만들 때는 늘 화면을 봤다.
 * 화면 없이 부르면 답이 안 나오는 것이 아니라 **짐작이 나오고**, 그것은
 * 에러도 카드도 안 난다. 까닭과 숫자는 `shotfirst.ts` 에 적어 두었다.
 *
 * 지금까지 사람이 눌러야 했던 다섯 번(양산 → AI 에게 맡기기 → 다시 양산 →
 * 실제로 쓰기 → 띄워 보기)을 **한 번으로** 묶는다. 앞의 셋이 3단계, 뒤의
 * 둘이 6단계(`finish.ts`)다 — 뒤의 둘은 남의 저장소에 쓰는 일이라
 * **새로 만드는 차시이고 저장소가 깨끗할 때만** 이어 간다.
 *
 * **`run.ts`·`match.ts` 는 안 고친다.** 저 둘은 화면이 따로 부르기도 하고
 * (답 넣고 다시 돌리기), 리허설 도구도 그대로 쓴다. 여기서 이어 붙이기만 한다.
 *
 * **AI 를 부를 값어치가 있을 때만 부른다.** 부를 때마다 껍데기만 14,830토큰이
 * 나가고 계정은 팀 공용이다 (CLAUDE.md). 가르는 자리가 **둘**이다 —
 * 화면이 있나(`shotfirst.ts`)와 남은 카드가 AI 가 풀 갈래인가(`worth.ts`).
 * 여기는 흐름뿐이다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { AutoTrace, RunResult, RunStep } from '../../../shared/forge'
import { aiTally, spentSince } from './ai'
import { addUnsure } from './autoasks'
import { markRun, wrapUp } from './autotail'
import { roughTokens } from './brief'
import type { OnLog } from './finish'
import { matchByAi } from './match'
import { reviseByAi } from './revise'
import { runDry } from './run'
import { shotGate } from './shotfirst'
import type { Emit } from './step'
import { left, notWorthCalling } from './worth'
import { wantsWhole, wholeRound } from './whole'

/**
 * 몇 바퀴까지 다시 돌릴까. 한 바퀴마다 AI 를 한 번 부른다.
 *
 * **셋에서 하나로 줄였다** (2026-09-21). 세 바퀴는 **화면 없이 부르던 때**의
 * 셈이었다 — 좁은 물음에 조금씩 답이 와서 한 바퀴로는 안 닫혔다. 이제
 * 화면이 있을 때만 부르므로(`shotfirst.ts`) 한 바퀴에 볼 것을 다 보고 답한다.
 * 그래도 안 풀린 것은 **다시 불러서 풀리는 것이 아니라** 사람이 다른 화면을
 * 줘야 하는 것이라, 두 번째 바퀴는 같은 값에 토큰만 더 쓰는 일이었다.
 */
const ROUND_MAX = 1

export async function runAuto(
  code: string,
  emit: Emit,
  /** dev 서버가 뱉는 줄을 받을 자리 (6단계). 안 주면 버린다 */
  onLog: OnLog = () => {},
  /** 쓴 뒤 띄워 보기까지 — 차례 줄은 끈다 (M5, `queue.ts`) */
  view = true
): Promise<RunResult> {
  // 걸음은 두 길(`runDry`·`matchByAi`)에서 오고 **같은 이름이 바퀴마다 다시
  // 온다.** 화면은 이름으로 갈아끼우므로(`RunSteps.merge`) 여기서도 같은
  // 약속으로 모아 둔다 — 결과가 들고 가는 목록이 정본이다.
  const seen: RunStep[] = []
  const keep: Emit = (step) => {
    const at = seen.findIndex((s) => s.name === step.name)
    if (at < 0) seen.push(step)
    else seen[at] = step
    emit(step)
  }

  // **「양산」 한 번은 사람이 시킨 일 한 번이다** (1단계 시험대). 화면이
  // 열리자마자 도는 것도 진행판에서 「양산」을 누른 결과라 한 번으로 센다.
  await markRun(code, '양산')

  const trace: AutoTrace = { rounds: 1, calls: 0, tokens: 0, why: '' }
  // 이 판에서 **실제로** 부른 것은 앞뒤를 빼서 잰다 (`ai.ts` `aiTally`, M2)
  const meter = aiTally()
  let out = await runDry(code, keep)
  let was = left(out)

  // ─ 화면이 먼저다 (2026-09-21) ─
  //
  // **AI 를 부르기 전에 figma 화면이 있는지 본다.** 없으면 어디를 찍으라고
  // 카드로 말하고 **토큰을 한 톨도 안 쓰고** 멈춘다 (`shotfirst.ts` 에 까닭).
  // 사람이 Ctrl+V 하면 그 자리에서 다시 돈다(`ShotPaste.tsx`).
  //
  // **이미 다 된 것까지 막지는 않는다** — 남은 카드도 에러도 없으면 부를 일이
  // 없으므로 화면도 물을 일이 없다.
  // **화면이 없으면 AI 를 한 번도 안 부른다** — 맞추기도 B단계도 마찬가지다.
  // 여기서 안 막고 아래 바퀴만 막으면 `reviseByAi` 가 그대로 눈 감고 불린다.
  //
  // **「카드가 없으니 다 됐다」로 빠져나가지 않는다.** 처음엔 남은 카드도
  // 에러도 없으면 화면 없이 보내 줄까 했는데, **그것이 바로 제일 위험한
  // 자리**다 — 도구가 앞 회차를 베껴 이름까지 맞춰 놓으면 카드도 에러도 안
  // 나지만 값은 이 회차 것이 아니다. 8호 76개에서 완성본과 다른 줄의 62%가
  // 그랬다(`revise.ts`). 그 62%를 보는 것이 B단계이고, B단계는 화면이 있어야
  // 한다. 그러니 **카드가 없을수록 화면이 있어야 한다.**
  const gate = await shotGate(code)
  if ((!gate.shot && !gate.free) || out.whole) { // 통째로 만든 레시피를 쓰는 판이면 좁은 물음을 다시 안 돌린다 — 그 답이 레시피를 덮는다
    trace.why = out.whole ? 'AI 전체 생성 결과를 씁니다. 입력이 바뀌면 다시 만듭니다.' : gate.why
    if (!out.whole && gate.ask) out.asks = [...out.asks, gate.ask]
    trace.spent = spentSince(meter)
    return await wrapUp(code, out, seen, trace, keep, onLog, view)
  }

  // ─ 원본 · 모듈이 먼저다 (2026-10-02) ─
  // 원본이 틀렸다는 카드(`scene.ts`) · 모듈 카드가 열려 있으면 **AI 를 안 부른다.** 틀린 원본 위에서 맞춘 답은 다 옛 장면 것이고,
  // 원본을 바꾸면 처음부터 다시 돈다 — 9호 KOL1M08W4S2 가 7호 박사 장면 위에서 AI 를 부르고 끝까지 갔다
  if (out.asks.some((a) => !a.done && (a.want === '원본' || a.want === '모듈'))) {
    trace.why = '원본이나 모듈을 먼저 정해야 해서 AI를 호출하지 않았습니다.'
    trace.spent = spentSince(meter)
    return await wrapUp(code, out, seen, trace, keep, onLog, view)
  }

  for (let round = 1; round <= ROUND_MAX; round += 1) {
    const open = out.asks.filter((a) => !a.done)
    if (!out.error && open.length === 0) {
      trace.why = out.ok
        ? '남은 질문이 없습니다.'
        : '남은 질문은 없지만 진행할 수 없습니다. 아래 단계를 확인하세요.'
      break
    }
    // **값 칸이 없는 모듈(`gate.free`)은 AI 를 한 번도 안 부른다** (2026-09-29, M3). 폴더가 빈 영상 학습코드
    // (ENL1M07W1S2)에서 맞추기 안의 「짜임 견주기」가 한 번 불렸고 얹은 것은 0 이었다. 남은 것은 카드로 묻는다
    if (gate.free) {
      trace.why = '값 항목이 없는 모듈이라 AI 를 호출하지 않았습니다.'
      break
    }
    const why = notWorthCalling(open, out)
    if (why) {
      trace.why = why
      break
    }

    // ─ AI 에게 맡긴다 ─
    trace.calls += 1
    const got = await matchByAi(code, keep)
    trace.match = got
    // 이름·차례는 토큰을 따로 안 세어 오므로 여기서 글자 수로 어림한다 —
    // **그림은 뺀 값이다.** figma 화면 한 장이 그보다 훨씬 크다.
    trace.tokens +=
      got.tokens + (got.shape?.tokens ?? 0) + (got.order ? roughTokens(got.order.brief) : 0)
    const put = got.taken.length + (got.order?.taken.length ?? 0)
    if (got.error) {
      // **못 불렀으면 브리프가 남는다.** 화면이 그것을 그대로 보여 주므로
      // 사람이 Claude Code 에 붙여넣어 답을 받아 올 수 있다.
      trace.why = `AI 를 호출하지 못했습니다: ${got.error}`
      break
    }
    if (put === 0) {
      trace.why = got.note || 'AI 가 채운 항목이 없습니다.'
      break
    }

    // ─ 얹은 것을 태워 다시 돌린다 ─
    trace.rounds += 1
    out = await runDry(code, keep)
    const now = left(out)
    // **카드 수로 재지 않는다.** 리소스 요구는 이름 무리로 묶여서, 한 무리
    // 열두 자리 가운데 넷이 채워져도 카드는 그대로 한 장이다 — 나아갔는데
    // 「안 줄었다」로 읽고 멈추게 된다. 막힌 자리와 에러로 잰다.
    if (now.slots >= was.slots && now.errors >= was.errors) {
      trace.why = `진행할 수 없는 항목 ${was.slots}개가 줄지 않아 중단했습니다.`
      break
    }
    was = now
    if (round === ROUND_MAX) trace.why = `${ROUND_MAX}회 반복해 중단했습니다.`
  }

  // ─ 앞 회차 것이 그대로 남은 자리 고치기 (B단계) ─
  //
  // **바퀴 안이 아니라 끝나고 딱 한 번**이다. 맞추기는 「못 맞춘 자리」를 보고
  // 돌지만 이것은 **도구가 맞춰 버린 자리**를 보는 일이라, 카드가 줄었는지와
  // 상관이 없다. 바퀴마다 부르면 같은 물음에 토큰만 세 배로 나간다.
  //
  // **에러도 카드도 안 나는 자리다** — 8호 76개에서 도구가 완성본과 다른 줄의
  // 62%가 여기였다. 그래서 「값어치가 있을 때만」을 못 가린다. 한 번은 부른다.
  //
  // **값 칸이 없는 모듈(영상 따위, `gate.free`)은 부르지 않는다** (2026-09-29, M3). 고칠 값이 없다 —
  // MAL1M07W1S1 에서 11줄을 보내 $0.02 를 썼고 얹은 것은 0 이었다.
  const revised = gate.free ? null : await reviseByAi(code, keep)
  if (revised) {
    out.revise = revised
    if (revised.taken) {
      trace.rounds += 1
      out = await runDry(code, keep)
      out.revise = revised
    }
  } else if (!trace.why) {
    trace.why = '값 항목이 없는 모듈이라 값 고치기를 건너뛰었습니다.'
  }

  // ─ 그래도 남으면 통째로 맡긴다 (2026-10-02 사용자 결정, `whole.ts`) ─ 못 만들었으면 아래 카드로 묻는다
  const whole = gate.shot && !gate.free && wantsWhole(out) ? await wholeRound(code, out, keep) : null
  if (whole?.saved) out = await runDry(code, keep)
  else {
    if (whole?.note) trace.why = `${trace.why ? `${trace.why} ` : ''}통째로 맡기기: ${whole.note}`
    // **AI 도 곤란하면 그때서야 사람에게 묻는다** — 까닭은 `autoasks.ts`
    addUnsure(code, out, revised, trace.match, gate)
  }

  trace.spent = spentSince(meter)

  return await wrapUp(code, out, seen, trace, keep, onLog, view)
}
