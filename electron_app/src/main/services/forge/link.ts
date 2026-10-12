/**
 * **미리보기 연결을 한 번 눌러 건다** (2026-09-29 사용자 말 — 「sparkon link 전환하는 것도 여기서 딸깍으로」).
 *
 * 전에는 앱이 걸지 않고 칠 명령만 보였다 — `sparkon_common/node_modules` 가 **호 하나만 가리키는 전역 상태**라
 * 다시 거는 순간 다른 호의 미리보기가 바뀌기 때문이다. 이제는 **사람이 단추를 누른 그때만** 건다.
 *
 * - 거는 일은 팀 CLI(`sparkon link MNN`)에 맡긴다. 정션 셈을 앱에 두 벌 두지 않는다
 *   (관리자 권한이 없으면 CLI 가 알아서 junction 으로 건다 — 2026-09-29 M07 로 돌려 봄, 묻는 것 없이 종료 코드 0)
 * - 앱이 띄운 미리보기 서버가 **다른 호에서** 돌고 있으면 먼저 끈다. 발밑의 node_modules 가 바뀌면 그 서버가 깨진다
 * - 끝나면 `viewCheck` 로 **다시 잰다.** CLI 가 「만들었습니다」라고 해도 믿지 않는다
 */

import { execFile } from 'node:child_process'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import type { LinkResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { serverState, stopServer } from './view'
import { viewCheck } from './viewcheck'

const run = promisify(execFile)

/** CLI 가 여러 줄을 낸다 — 정션 셋과 node_modules 까지 걸어도 몇 초. 넘으면 멈춘 것으로 본다 */
const LINK_TIMEOUT_MS = 60_000

export async function linkFor(code: string): Promise<LinkResult> {
  const before = await viewCheck(code)
  const m = /^sparkon link (M\d\d)$/.exec(before.command)
  if (!before.repo || !m) return { ok: false, out: '', check: before, error: before.blocked || '연결할 호를 읽지 못했습니다.' }

  const server = serverState()
  if (server.running && server.repo && server.repo !== before.repo) stopServer()

  try {
    // 인자는 위 정규식이 거른 `M\d\d` 하나뿐이라 셸에 사람이 준 글이 들어가지 않는다
    const { stdout, stderr } = await run('cmd.exe', ['/d', '/s', '/c', `sparkon.cmd link ${m[1]}`], {
      cwd: dirname(before.repo),
      timeout: LINK_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    })
    const check = await viewCheck(code)
    const ok = check.links.every((l) => l.ok) && check.sameMonth
    return { ok, out: (stdout + stderr).trim(), check, error: ok ? undefined : check.blocked || '연결했지만 연결 상태를 확인하지 못했습니다.' }
  } catch (error) {
    return { ok: false, out: '', check: await viewCheck(code), error: `연결하지 못했습니다: ${toMessage(error)}` }
  }
}
