/**
 * **끝까지 저절로** (6단계) — 카드가 0 이면 쓰기와 띄우기를 이어서 한다.
 *
 * 3단계에서 앞의 셋(양산 → AI → 다시 양산)을 한 번으로 묶었습니다. 그러고도
 * 1단계 시험대에서 잰 손길이 **셋**이었습니다 — 양산 · 쓰기 · 띄우기.
 * 남은 둘이 여기서 없어집니다.
 *
 * **안 이어 가는 자리를 먼저 정합니다.** 남의 저장소에 파일이 들어가는 일이라,
 * 「되겠지」로 넘어가지 않습니다 —
 *
 *   ① 만들어 보기가 막혔으면 안 간다
 *   ② 답도 확인도 없는 카드가 남았으면 안 간다 (`write.ts` 빗장 ⑤ 와 같은 줄)
 *   ③ **이미 있는 액티비티면 안 간다.** 덮어쓰기는 사람이 누르는 것이다
 *      (`write.ts` 빗장 ③). 저절로 덮어쓰면 남이 고쳐 둔 것이 말없이 사라진다
 *   ④ 저장소가 git 으로 깨끗하지 않으면 안 간다 (`write.ts` 빗장 ④)
 *   ⑤ 정션이 안 걸렸으면 **띄우기만** 안 한다. 쓴 것은 그대로 둔다
 *
 * ③ 이 이 파일의 핵심입니다. 그래서 저절로 가는 것은 **새로 만드는 차시뿐**이고,
 * 이미 있는 차시는 여태처럼 사람이 「덮어쓰기」를 누릅니다.
 *
 * **왜 멈췄는지를 늘 돌려줍니다.** 이어 갔든 안 갔든 한 줄이 옵니다 —
 * 「끝났습니다」만 보이거나 아무 말이 없으면 사람이 다음에 뭘 할지 모릅니다.
 *
 * **손길로 세지 않습니다.** `_run.json` 이 세는 것은 **사람이 시킨 일**이라,
 * 여기서 대신 누른 쓰기·띄우기는 안 셉니다 (`measure.ts`). 안 그러면 줄이려고
 * 만든 것이 숫자를 늘립니다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer, FinishTrace, RunResult, WriteResult } from '../../../shared/forge'
import { BUTTON, blocking } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { answerAndRun } from './rerun'
import type { Emit } from './step'
import { startServer } from './view'
import { viewCheck } from './viewcheck'
import { writeNow } from './write'
import { writeCheck } from './writecheck'

/** 서버가 뱉는 줄을 받을 자리. 화면이 없으면 버린다. */
export type OnLog = (line: string) => void

export interface Finished {
  /** 쓰기까지 갔으면 그 결과. 안 갔으면 받은 것을 그대로 돌려준다 */
  out: RunResult | WriteResult
  trace: FinishTrace
}

/**
 * 갈 수 있으면 가고, 못 가면 왜 못 가는지.
 *
 * @param out 방금 돌린 「양산」의 결과. 이것을 보고 갈지 말지 정한다.
 */
export async function finishUp(
  code: string,
  out: RunResult,
  emit: Emit,
  onLog: OnLog,
  /** 쓴 뒤 띄워 보기까지 갈지 — 차례 줄은 쓰기까지만 간다 (M5) */
  view = true
): Promise<Finished> {
  const trace: FinishTrace = { went: false, why: '', url: '' }

  // ─ ① 만들어 보기가 막혔으면 ─
  if (!out.ok) {
    trace.why = '진행할 수 없는 단계가 있어 저장소에 반영하지 않았습니다.'
    return { out, trace }
  }

  // ─ ② 남은 카드 ─
  // 검수 카드(AI 의 짐작 — `isReview`)는 반영을 안 막는다. 미리보기를 봐야 맞는지 알기 때문이다
  const open = blocking(out.asks)
  if (open.length) {
    trace.why = `남은 질문 ${open.length}개가 있어 저장소에 반영하지 않았습니다.`
    return { out, trace }
  }

  // ─ ③④ 쓸 수 있나 ─
  let check: Awaited<ReturnType<typeof writeCheck>>
  try {
    check = await writeCheck(code)
  } catch (error) {
    trace.why = `반영할 수 있는지 확인하지 못했습니다: ${toMessage(error)}`
    return { out, trace }
  }
  if (check.blocked) {
    trace.why = check.blocked
    return { out, trace }
  }
  if (check.exists && !check.dummy) {
    // **덮어쓰기는 사람이 누른다.** 저절로 덮으면 남이 고쳐 둔 것이 사라진다.
    // 9호 빈 뼈대(더미)만은 저절로 채운다 — 덮이는 것이 ffad230 원형뿐이다 (M7 · 여쭐 것 5 허락)
    trace.why = `이미 있는 액티비티입니다. 「${BUTTON.rewrite}」을 누르세요.`
    return { out, trace }
  }

  // ─ 쓴다 ─
  const wrote = await writeNow(code, false, emit, false)
  if (!wrote.wrote) {
    trace.why = wrote.writeNote || '저장소에 반영하지 못했습니다.'
    return { out: wrote, trace }
  }
  trace.went = true
  trace.why = `파일 ${wrote.written.length}개를 반영했습니다.`

  // 차례 줄로 돈 판은 쓰기까지만 — 한 판마다 서버를 올리면 줄 끝에서 창이 여럿 뜬다 (M5)
  if (!view) {
    trace.why += ' 미리보기는 작업대에서 「미리보기」를 누르세요.'
    return { out: wrote, trace }
  }

  // ─ ⑤ 띄운다 ─
  // **못 띄워도 쓴 것은 그대로다.** 정션은 전역
  // 상태라 앱이 걸지 않는다 (`view.ts`) — 칠 명령만 알려 준다.
  try {
    const look = await viewCheck(code)
    if (look.blocked) {
      trace.why += ` 미리보기를 열지 못했습니다: ${look.blocked}`
      return { out: wrote, trace }
    }
    const server = await startServer(code, onLog, false)
    if (server.error || !server.url) {
      trace.why += ` 미리보기를 열지 못했습니다: ${server.error || '주소를 읽지 못했습니다.'}`
      return { out: wrote, trace }
    }
    trace.url = server.url
    trace.why += ' 브라우저에서 확인하세요.'
  } catch (error) {
    trace.why += ` 미리보기를 열지 못했습니다: ${toMessage(error)}`
  }
  return { out: wrote, trace }
}

/**
 * **답을 넣고 그대로 이어 간다** (6단계의 「답하면 이어서 간다」).
 *
 * 카드 화면에서 멈춘 판을 사람이 답 하나로 풀면, 그것으로 카드가 0 이
 * 될 수 있습니다. 그때 또 「양산」을 누르게 하면 손길이 하나 늡니다.
 *
 * **`run.ts` 를 안 고칩니다.** 저쪽은 리허설 도구도 그대로 쓰는 자리라,
 * 거기서 쓰기로 이어지면 도구가 남의 저장소에 파일을 쓰게 됩니다.
 * 잇는 일은 이 파일의 몫입니다.
 */
export async function answerAndFinish(
  code: string,
  answers: Answer[],
  emit: Emit,
  onLog: OnLog
): Promise<RunResult | WriteResult> {
  const out = await answerAndRun(code, answers, emit)
  const steps = out.steps
  const done = await finishUp(code, out, emit, onLog)
  const final = done.out
  // 걸음은 답을 넣고 돈 것이 정본이다 — 쓰기가 다시 돌린 것으로 갈아끼우면
  // 「답을 넣어 무엇이 달라졌나」가 안 보인다.
  final.steps = steps
  final.finish = done.trace
  return final
}
