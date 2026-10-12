/**
 * **대화로 만들기의 차례 돌리기** (2026-10-08, `chat.ts` 에서 뗐다) — Claude 차례를 돌리고, 다 했다면 검사하고, 막히면 다시 맡긴다.
 * 사람에게 넘어갈 때(질문 · 완료 · 멈춤 · 오류)까지 돈다.
 *
 * - **멈추기는 차례 사이에서도 먹는다** — 검사 중에는 도는 claude 가 없어 나무째 내릴 것이 없다. 요청을 들고 있다가(`askStop`)
 *   다음 차례 앞 · 검사 뒤에 본다. 처음에는 검사 중에 누르면 아무 일 없이 다음 고치기(유료)가 돌았다
 * - **검사를 못 돌렸으면 AI 에게 안 맡긴다** — 프로그램이 없거나 시간이 넘은 것은 AI 가 고칠 수 없다. 까닭을 남기고 사람에게
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { toMessage } from '../../lib/errors'
import { sessionTurn } from './aisession'
import { fixBrief, readReply } from './chatbrief'
import { blocked, finishChat } from './chatfinish'
import { readDirsOf, type ChatCtx } from './chatprep'
import { addProgress, endLive, readChat, saveChat, stopWanted, turnOf, type ChatSaved } from './chatstore'
import type { Forge } from './runtime'

/** 검사에 막혔을 때 다시 맡기는 횟수 — 사람이 답할 때마다 새로 센다 */
const FIX_MAX = 3

/** 남긴 형편에 몇 칸만 바꿔 다시 남긴다 — 앱의 한 줄을 붙일 수 있다 */
function push(root: string, code: string, patch: Partial<ChatSaved>, line?: string): void {
  const s = readChat(root, code)
  saveChat(root, { ...s, ...patch, turns: line ? [...s.turns, turnOf('app', line)] : s.turns })
}

export async function runTurns(forge: Forge, ctx: ChatCtx, first: string, resume: string | null): Promise<void> {
  const root = forge.paths.REPO_ROOT
  const code = ctx.code
  const halt = (s: ChatSaved): void => {
    saveChat(root, { ...s, state: 'stopped', error: undefined, turns: [...s.turns, turnOf('app', '멈췄습니다.')] })
  }
  let prompt = first
  let session = resume
  try {
    for (;;) {
      if (stopWanted(code)) return halt(readChat(root, code))
      push(root, code, { state: 'running', questions: [], error: undefined })
      const turn = await sessionTurn(code, {
        prompt,
        cwd: ctx.act,
        readDirs: readDirsOf(ctx),
        resume: session,
        onLine: (l) => addProgress(root, code, l),
        // 첫 차례 도중에 앱을 껐다 켜도 이을 수 있게 받자마자 남긴다
        onSession: (id) => {
          session = id
          push(root, code, { sessionId: id })
        }
      })
      let s = readChat(root, code)
      s = { ...s, cost: s.cost + (turn.cost ?? 0), sessionId: turn.sessionId ?? s.sessionId }
      session = s.sessionId
      if (turn.denied.length) s.turns.push(turnOf('app', `작업 폴더 밖이라 거부한 것이 있습니다: ${turn.denied.join(', ')}`))
      if (!turn.ok) {
        if (stopWanted(code)) return halt(s)
        saveChat(root, { ...s, state: 'error', error: turn.error, turns: [...s.turns, turnOf('app', turn.error)] })
        return
      }
      const r = readReply(turn.text)
      if (r.say) s.turns.push(turnOf('ai', r.say))
      if (r.kind === 'ask') {
        const lost = r.unread ? [turnOf('app', 'Claude 의 답에서 끝맺음을 읽지 못했습니다. 글로 답하면 이어서 진행합니다.')] : []
        saveChat(root, { ...s, state: 'asking', questions: r.questions, turns: [...s.turns, ...lost] })
        return
      }
      saveChat(root, { ...s, state: 'checking' })
      addProgress(root, code, '리소스를 복사하고 타입 검사를 하는 중입니다.')
      const checks = await finishChat(forge, ctx, r.files)
      s = { ...readChat(root, code), checks }
      if (stopWanted(code)) return halt(s)
      if (checks.tsc?.ran === false) {
        const why = `${checks.tsc.why ?? '타입 검사를 실행하지 못했습니다.'} 고친 뒤 답을 보내면 다시 검사합니다.`
        saveChat(root, { ...s, state: 'asking', questions: [], turns: [...s.turns, turnOf('app', why)] })
        return
      }
      const spec = checks.spec?.length ? ` 스펙 검사에서 참고할 것이 ${checks.spec.length}개 있습니다.` : ''
      if (!blocked(checks)) {
        // 한 줄에 「/」로 이으면 묻혔다(2026-10-08 — 기획서 오기를 여기 적었는데 사용자가 못 봤다). 굵은 제목 아래 한 줄씩
        const look = r.check.length ? `\n\n**미리보기에서 확인할 것**\n${r.check.map((c) => `- ${c}`).join('\n')}` : ''
        const said = `리소스 ${checks.files?.copied ?? 0}개를 호 저장소로 복사했고 타입 검사를 통과했습니다.${spec}${look}`
        saveChat(root, { ...s, state: 'done', fixRounds: 0, turns: [...s.turns, turnOf('app', said)] })
        return
      }
      if (s.fixRounds >= FIX_MAX) {
        const said = `${FIX_MAX}번 고쳐도 검사를 통과하지 못했습니다. 남은 것을 보고 어떻게 할지 적어 주세요.`
        saveChat(root, { ...s, state: 'asking', questions: [], turns: [...s.turns, turnOf('app', said)] })
        return
      }
      saveChat(root, { ...s, fixRounds: s.fixRounds + 1, turns: [...s.turns, turnOf('app', `검사에서 고칠 것이 나와 다시 맡깁니다(${s.fixRounds + 1}번째).`)] })
      // 스펙 참고는 첫 고치기에만 — 매번 실으면 막는 것(타입 오류)보다 길어져 묻힌다
      prompt = fixBrief(checks, { spec: s.fixRounds === 0 })
    }
  } catch (error) {
    push(root, code, { state: 'error', error: toMessage(error) }, toMessage(error))
  } finally {
    endLive(code)
    saveChat(root, readChat(root, code))
  }
}
