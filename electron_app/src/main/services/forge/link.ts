/**
 * **미리보기 연결을 한 번 눌러 건다** (2026-09-29 사용자 말 — 「sparkon link 전환하는 것도 여기서 딸깍으로」).
 *
 * 전에는 앱이 걸지 않고 칠 명령만 보였다 — `sparkon_common/node_modules` 가 **호 하나만 가리키는 전역 상태**라
 * 다시 거는 순간 다른 호의 미리보기가 바뀌기 때문이다. 이제는 **사람이 단추를 누른 그때만** 건다.
 *
 * - 거는 일은 팀 CLI(`sparkon link MNN`)에 맡긴다. 정션 셈을 앱에 두 벌 두지 않는다
 *   (관리자 권한이 없으면 CLI 가 알아서 junction 으로 건다 — 2026-09-29 M07 로 돌려 봄, 묻는 것 없이 종료 코드 0).
 *   CLI 를 부르는 자리는 `sparkoncli.ts` 하나다(2026-10-16) — 전에 여기서 부르던 `sparkon.cmd` 는 npm link 한 PC 에만 있다
 * - 앱이 띄운 미리보기 서버가 **다른 호에서** 돌고 있으면 먼저 끈다. 발밑의 node_modules 가 바뀌면 그 서버가 깨진다
 * - 끝나면 `viewCheck` 로 **다시 잰다.** CLI 가 「만들었습니다」라고 해도 믿지 않는다
 * - 공용 폴더를 작업 폴더 밖으로 정했고 작업 폴더 안 sparkon_common 자리가 비었으면, CLI 앞에 그 자리에서 공용 폴더로 가는 정션을 건다(`commonlink.ts`, 2026-10-23).
 *   못 걸면 손으로 칠 명령을 내놓지 않는다 — 그 명령도 같은 자리에서 멈춘다
 */

import { dirname } from 'node:path'
import type { LinkResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { commonLink, realModules } from './commonlink'
import { loadForge } from './runtime'
import { runCli } from './sparkoncli'
import { serverState, stopServer } from './view'
import { viewCheck } from './viewcheck'

export async function linkFor(code: string): Promise<LinkResult> {
  const before = await viewCheck(code)
  const m = /^sparkon link (M\d\d)$/.exec(before.command)
  if (!before.repo || !m) return { ok: false, out: '', check: before, error: before.blocked || '연결할 호를 읽지 못했습니다.' }

  const server = serverState()
  if (server.running && server.repo && server.repo !== before.repo) stopServer()

  try {
    // CLI 는 작업 폴더 안 sparkon_common 만 본다 — 공용 폴더가 밖이면 그 자리를 먼저 잇는다. 이어져 있으면 아무것도 안 한다
    const common = (await loadForge()).commonroot.commonPick()
    // CLI 는 걸기 전에 그 자리를 `rm -rf` 한다 — 밖에 둔 공용 폴더의 진짜 node_modules 는 휴지통 없이 사라진다(`commonlink.ts`)
    if (common.saved && realModules(common.dir)) {
      const why = '연결하면 공용 폴더 안의 node_modules 폴더가 지워져서 연결하지 않았습니다.'
      return { ok: false, out: '', check: { ...(await viewCheck(code)), command: '', blocked: why }, error: why }
    }
    if (!common.beside) {
      const j = commonLink(common.home, common.dir)
      // 손으로 칠 명령은 내놓지 않는다 — 그 자리가 이어지지 않으면 `sparkon link` 도 「먼저 clone부터」로 멈춘다. 까닭은 막힌 줄에(「다시 확인」이면 단추가 돌아온다)
      if (!j.ok) return { ok: false, out: '', check: { ...(await viewCheck(code)), command: '', blocked: j.why }, error: j.why }
    }
    // 인자는 위 정규식이 거른 `M\d\d` 하나뿐이다. 작업 폴더(호 폴더의 부모)에서 부른다
    const r = await runCli(dirname(before.repo), 'link', m[1])
    const out = r.tail.join('\n')
    if (!r.ok) return { ok: false, out, check: await viewCheck(code), error: `연결하지 못했습니다: ${r.why}` }
    const check = await viewCheck(code)
    const ok = check.links.every((l) => l.ok) && check.sameMonth
    return { ok, out, check, error: ok ? undefined : check.blocked || '연결했지만 연결 상태를 확인하지 못했습니다.' }
  } catch (error) {
    return { ok: false, out: '', check: await viewCheck(code), error: `연결하지 못했습니다: ${toMessage(error)}` }
  }
}
