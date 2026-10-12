/**
 * **답을 남기고 그대로 다시 돌린다** — 카드에 답을 넣었을 때 도는 길.
 *
 * `run.ts` 가 261줄이 되어 갈랐다 (2026-09-18, 동작 변화 없음). 한 번 돌리는
 * 것(`runDry`)은 `run.ts`, 답을 남기고 다음 호로 물려준 뒤 그것을 부르는 것이
 * 여기다. `finish.ts` 가 이것을 불러 카드가 0 이면 쓰기까지 잇는다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer, RunResult } from '../../../shared/forge'
import { MODULE_PATH } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { saveAnswers } from './answer'
import { placeAnswers, placedElsewhere } from './answerplace'
import { carryAnswers } from './carry'
import { mark } from './measure'
import { runDry } from './run'
import { loadForge } from './runtime'
import type { Emit } from './step'

/**
 * 답을 남기고 그대로 다시 돌린다.
 *
 * **남기는 것과 돌리는 것을 한 번에 한다.** 둘로 나누면 화면이 「남겼는데
 * 안 돌린」 사이 상태를 갖게 되고, 그때 창을 닫으면 사람은 자기 답이
 * 반영됐는지 모른다. 답은 `_recipe/<코드>.answer.json` 에 남고 다음에 열 때도
 * 그대로 있다.
 *
 * **답이 틀렸어도 남긴다.** 되돌리려면 무엇을 넣었는지 보여야 하고, 검사에
 * 걸리는 답이야말로 사람이 다시 봐야 하는 것이다.
 */
export async function answerAndRun(
  code: string,
  answers: Answer[],
  emit: Emit
): Promise<RunResult> {
  let carried: Awaited<ReturnType<typeof carryAnswers>>
  try {
    const forge = await loadForge()
    // 카드에 답을 넣는 것도 사람이 시킨 일이다 (1단계 시험대). 몇 장을
    // 한꺼번에 보냈는지까지 적어 둔다 — 카드마다 따로 보내면 그만큼 는다.
    mark(forge.paths.REPO_ROOT, code, '답', `${answers.length}장`)
    // **다음 호까지 남기는 것을 먼저 한다** (5단계). 스펙에 기본값이 올라간
    // 뒤에 돌려야 이번 걸음에서도 그 값이 먹는다 — 올리고도 이번엔 또
    // 물어보면 「올라간 게 맞나」를 사람이 못 믿는다.
    carried = await carryAnswers(code, answers, forge)
    // 원본 · 대사 성우 성별도 레시피가 아니다 — 배치표 · 스펙에 적는다 (`answerplace.ts`)
    carried.push(...(await placeAnswers(forge, code, answers)))
    // **배치표 답은 레시피 값이 아니다.** 답 파일에 섞어 두면 다음 번에
    // 「자리를 못 찾아 못 넣었습니다」로 세어진다.
    saveAnswers(
      forge.paths.REPO_ROOT,
      code,
      answers.filter((a) => a.path !== MODULE_PATH && !placedElsewhere(a)),
      'person'
    )
  } catch (error) {
    return {
      code,
      ok: false,
      steps: [],
      issues: [],
      asks: [],
      preview: [],
      wrote: false,
      writeNote: '',
      error: `답변을 저장하지 못했습니다: ${toMessage(error)}`
    }
  }
  // 메모만 보냈어도 그대로 다시 돈다 — 메모가 붙은 카드는 이제 「정해진 것」이라,
  // 실제 쓰기 빗장이 풀렸는지를 화면이 바로 봐야 한다.
  const out = await runDry(code, emit)
  if (carried.length) out.carried = carried
  return out
}
