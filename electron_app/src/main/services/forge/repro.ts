/**
 * 만든 직후 그 한 칸에만 재현 검사를 돌린다 (4단계).
 *
 * `check:repro` 는 「스펙 + 원본의 값으로 다시 만들면 원본과 같은 글이 나오나」를
 * 봅니다. **전 모듈을 돌리면 9초쯤 걸리므로 그 모듈 하나만** 돌립니다 —
 * `checkRepro.ts` 가 `<과목>/<모듈>` 을 인자로 받습니다.
 *
 * **왜 앱 안에서 함수로 안 부르나.** 그 파일은 `src/tool/` 에 있고, 앱 쪽
 * tsconfig 는 `tool/` 을 통째로 뺍니다(앱이 부르지 않는 명령들이라). 하나
 * 때문에 넣으면 `main.ts`·`server.ts` 까지 딸려 옵니다. 그리고 그 파일은
 * 결과를 **`console.log` 로만** 내놓지 값으로 돌려주지 않습니다 — 부르려면
 * 그 파일을 고쳐야 하고, 그러면 명령 쪽 출력이 흔들립니다. 명령 그대로
 * 돌리고 낸 글을 보여 주는 편이 낫습니다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { ReproResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { loadForge } from './runtime'

const run = promisify(execFile)

/** 한 모듈이면 십수 초면 끝난다. 넘으면 뭔가 잘못된 것이다. */
const TIMEOUT = 120_000

/** 뒤에서 이만큼만 보여 준다. 앞쪽은 모듈 목록이라 볼 것이 없다. */
const TAIL = 40

const NAME = /^[A-Za-z0-9_]{1,64}$/


function tail(text: string): string[] {
  const lines = text
    // 색 코드를 뗀다 — 화면에 그대로 두면 글자가 깨져 보인다.
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
  return lines.slice(-TAIL)
}

export async function repro(subject: string, module: string): Promise<ReproResult> {
  const out: ReproResult = { subject, module, ok: false, out: [] }
  if (!/^(MA|KO|EN)$/.test(subject) || !NAME.test(module)) {
    return { ...out, error: '과목이나 모듈 이름이 이상합니다.' }
  }

  let root: string
  try {
    root = (await loadForge()).root
  } catch (error) {
    return { ...out, error: toMessage(error) }
  }

  // 명령을 셸로 넘기지 않는다 — 인자를 배열로 준다. 모듈 이름이 렌더러에서
  // 온 값이라, 셸을 거치면 그 글자가 명령으로 읽힐 자리가 생긴다.
  const bin = join(root, 'node_modules', 'ts-node', 'dist', 'bin.js')
  const args = [
    bin,
    '-r',
    'tsconfig-paths/register',
    join('src', 'tool', 'checkRepro.ts'),
    `${subject}/${module}`
  ]

  try {
    const got = await run(process.execPath, args, {
      cwd: root,
      timeout: TIMEOUT,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', FORCE_COLOR: '0' }
    })
    out.out = tail(got.stdout + got.stderr)
    out.ok = true
    return out
  } catch (error) {
    // **`exit 1` 도 결과다.** 검사가 걸린 것이지 실패한 것이 아니므로,
    // 낸 글을 그대로 보여 준다. 글이 아예 없을 때만 오류로 본다.
    const shell = error as { stdout?: string; stderr?: string; killed?: boolean }
    const text = (shell.stdout ?? '') + (shell.stderr ?? '')
    out.out = tail(text)
    if (!out.out.length) out.error = toMessage(error)
    else if (shell.killed) out.error = '시간이 너무 오래 걸려 중지했습니다.'
    return out
  }
}
