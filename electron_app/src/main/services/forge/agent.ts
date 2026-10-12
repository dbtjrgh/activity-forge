/**
 * **「AI 에게 맡기기」** — 막힌 카드를 채팅처럼 폴더를 뒤져 푸는 에이전트에게 넘긴다 (2026-09-30).
 *
 * 채팅으로 만들면 Claude 가 원본 호 폴더와 견주고, 그림을 열고, figma · 기획서를 읽어 막힌 것을 푼다. 앱의 AI 는
 * 일부러 좁게 불려(`--tools none` · 표 하나) 그걸 못 해서, 막히면 사람이 결국 채팅으로 갔다(`_document/차례표.md`).
 * 여기는 그 채팅의 눈을 준다 — 읽기 도구 셋(Read · Glob · Grep)과 원본 호 폴더 · 스펙. **쓰기 · Bash 는 안 준다.**
 *
 * - **답만 받는다.** 받은 답은 검산(`agentbrief.ts` `readAgent`)한 뒤 AI 답(`by: 'ai'`)으로 남기고 다시 본다 —
 *   사람 답과 같은 자리(`answer.json`)라 화면에서 보이고 고칠 수 있다. 다음 호로 물려주지 않는다(`carry` 없음)
 * - **쓰지 않는다.** 다시 보기(`runDry`)까지만 — 반영은 사람이 누른다
 * - **assemble 밖이다** (`rerun.ts` 처럼) — 걸음을 늘리지 않는다(동결)
 * - 사람이 누를 때만 돈다. 상한은 `ai.ts` 가 부르기 직전에 본다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { RunResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { askAi } from './ai'
import { solvable } from '../../../shared/forge'
import { agentBrief, readAgent } from './agentbrief'
import { readAnswers, saveAnswers } from './answer'
import { mark } from './measure'
import { originNow } from './originpick'
import { runDry } from './run'
import { loadForge } from './runtime'
import type { Emit } from './step'

/** 에이전트가 한 일은 `RunResult.agent` 에 담는다 */
export type HandOver = RunResult

export async function handOver(code: string, emit: Emit): Promise<HandOver> {
  const first = await runDry(code, emit)
  const asks = solvable(first.asks)
  if (!asks.length) return { ...first, error: first.error || 'AI 에게 맡길 질문이 없습니다. 남은 질문은 파일이 없는 항목이거나 이미 완료된 질문입니다.' }
  try {
    const forge = await loadForge()
    // **만들 때 쓴 원본으로** — 배치표 원본(`layout.originFor`)이 아니다. 그림 크기로 바꿔 뜬 원본일 수 있다 (2026-10-02,
    // KOL1M08W2S3 은 배치표 6호 · 실제 4호라 AI 가 엉뚱한 원본 폴더를 보고 썸네일도 6호 그림이었다)
    const pick = originNow(forge, code)
    if (typeof pick === 'string') return { ...first, error: pick }
    const dir = forge.files.rscDir(code)
    if (!dir) return { ...first, error: '리소스 폴더 위치를 정하지 못했습니다.' }
    const originDir = forge.common.rscOfDone(pick.origin)
    const specFile = forge.spec.specPath(code.slice(0, 2), pick.module)
    const person = readAnswers(forge.paths.REPO_ROOT, code).answers.filter((a) => a.by === 'person')
    mark(forge.paths.REPO_ROOT, code, '맡기기', `${asks.length}장`)
    const brief = agentBrief({ code, module: pick.module, origin: pick.origin, originDir, specFile, person }, asks)
    const reply = await askAi(brief, dir, { dirs: [originDir, specFile.replace(/[\\/][^\\/]+$/, '')] })
    if (!reply.ok) return { ...first, error: reply.error }
    const got = readAgent(reply.text, asks)
    if (got.answers.length) saveAnswers(forge.paths.REPO_ROOT, code, got.answers, 'ai')
    const again = got.answers.length ? await runDry(code, emit) : first
    // 무엇을 골랐나를 화면이 그림으로 보이게 — 자리(`assets.image.img_face`)마다 원본이 쓰던 파일을 곁들인다 (사용자 말 — 「결과를 모르는데」)
    const was = forge.common.fileOf(pick.origin)
    const picks = got.answers.map((a) => {
      const m = /^assets\.(\w+)\.(.+)$/.exec(a.path)
      return { path: a.path, value: String(a.value), was: m ? was.get(`${m[1]}|${m[2]}`) : undefined }
    })
    return {
      ...again,
      agent: {
        put: got.answers.length,
        refused: got.refused,
        cost: reply.cost,
        seconds: Math.round(reply.took / 1000),
        why: [...got.why].map(([path, why]) => ({ path, why })),
        picks
      }
    }
  } catch (error) {
    return { ...first, error: `AI 에게 맡기지 못했습니다: ${toMessage(error)}` }
  }
}
