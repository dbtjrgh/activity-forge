/**
 * **Claude Code 로그인을 앱에서** (2026-11-03) — 로그인이 풀리면 대화로 만들기가 「로그인되어 있지 않습니다」로 멈춘다.
 * 그 전에는 「터미널에서 claude를 실행해 로그인」하라고만 했다 — 사용자가 「양산기 창에서 해결」을 바랐다.
 *
 * - `claude auth login` 은 브라우저를 열고 터미널에서 기다리는 **대화형 명령**이다(코드를 붙여 넣으라 할 수도 있다).
 *   앱의 다른 자식 프로세스처럼 숨기고 입력을 닫아 부르면(`lib/proc.ts`) 끝나지 않는다.
 *   그래서 **사람이 볼 수 있는 콘솔 창**을 따로 띄운다 — `proc.ts` 의 「숨김 · 셸 없음」을 여기만 벗어나는 까닭이다
 * - 끝나면 창이 닫히고, 실패하면 글을 읽을 수 있게 멈춰 둔다(`|| pause`)
 * - 로그인이 됐는지는 앱이 `claude auth status` 로 다시 잰다(`setupchecks.ts` `claudeLoggedIn`) — 창의 결과를 믿지 않는다
 * - `claude` 는 `toolpath.ts` 가 넓힌 PATH 로 찾는다(초기 설정 확인과 같다)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { spawn } from 'node:child_process'
import type { ClaudeLoginOpen } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { refreshToolPath } from './toolpath'

/** 콘솔 창 제목 — `start` 의 첫 따옴표 인자다 */
const TITLE = 'Claude Code 로그인'
/** 창에 먼저 찍는 글. cmd 가 특별히 읽는 글자(& | < > ^ %)를 넣지 않는다 */
const KEEP_OPEN = '브라우저에서 로그인을 마칠 때까지 이 창을 닫지 마세요. 로그인이 끝나면 저절로 닫힙니다.'

export function openClaudeLogin(): ClaudeLoginOpen {
  if (process.platform !== 'win32') return { ok: false, error: '이 컴퓨터에서는 터미널에서 claude auth login 을 실행하세요.' }
  refreshToolPath()
  try {
    // `start` 는 따옴표를 Node 가 씌우는 꼴로 읽지 않는다 — 한 줄을 그대로 넘긴다(함정: shell 인자 따옴표)
    // 창 맨 위에 닫지 말라는 글 — 이 창이 브라우저의 로그인 결과(localhost 콜백)를 받는다. 먼저 닫으면 브라우저가
    // 「localhost에서 연결을 거부했습니다」로 끝난다(2026-11-03 첫 시도에서 그랬다)
    const line = `start "${TITLE}" cmd /c "echo ${KEEP_OPEN}& echo.& claude auth login || pause"`
    const child = spawn(process.env['ComSpec'] || 'cmd.exe', ['/d', '/c', line], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      windowsVerbatimArguments: true
    })
    child.on('error', () => undefined)
    child.unref()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: `로그인 창을 열지 못했습니다: ${toMessage(error)}` }
  }
}
