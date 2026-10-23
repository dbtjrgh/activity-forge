/**
 * **sparkon CLI 를 부르는 자리는 여기 하나** (2026-10-16, 처음 설정). CLI 는 팀 저장소(`sparkon_cli`)다 — 고치지 않는다.
 *
 * - `node <작업 폴더>/sparkon_cli/bin/index.js <명령>` 을 **작업 폴더에서** 부른다. CLI 는 cwd 나 그 부모에 sparkon_cli 가 없으면
 *   바로 끝난다(`resolve_work_root`). 전에는 `cmd.exe … sparkon.cmd link MNN` 이었다 — sparkon.cmd 는 `npm link` 한 PC 에만 있다.
 *   이 PC 의 sparkon.cmd 는 `%APPDATA%\npm\node_modules\sparkon-cli`(→ 작업 폴더의 sparkon_cli) 의 같은 bin 을 부른다
 * - 부르는 것은 `help` · `link` 뿐이다. `init` · `clone` 은 안 부른다(저장소는 사람이 git 으로 받는다 — 사용자 결정),
 *   `version` · `build` 는 git fetch 를 한다
 * - stdin 은 닫고 셸 없이, git 이 묻지 않게(GIT_TERMINAL_PROMPT=0 · GCM_INTERACTIVE=never) · 색 없이(FORCE_COLOR=0), 상한에 걸리면 나무째 내린다(`lib/proc.ts`)
 * - `bin/` 은 gitignore 라 갓 받은 sparkon_cli 에는 없다 — `prepareCli` 가 만든다(node_modules 가 없으면 yarn install, bin 이 없으면 yarn build).
 *   **있으면 낡았어도 그대로 쓴다**(다시 빌드하지 않는다 — 이 PC 의 bin 은 src 보다 이틀 옛것인데 link 는 같다)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { procWhy, runLine, runProc, type ProcResult } from '../../lib/proc'

export const CLI_DIR = 'sparkon_cli'
export const cliEntry = (work: string): string => join(work, CLI_DIR, 'bin', 'index.js')

/** 자식이 묻지 않고 · 색 글자 없이 */
const QUIET = { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', FORCE_COLOR: '0' }

/** link 는 정션 셋과 공통 node_modules 를 걸고 몇 초 — 넘으면 멈춘 것으로 본다(옛 link.ts 와 같은 값) */
const LINK_MS = 60_000
const HELP_MS = 30_000
/** sparkon_cli 의 패키지는 다섯 개 — 캐시가 비어도 몇 분이다 */
const CLI_INSTALL_MS = 10 * 60_000
const CLI_BUILD_MS = 3 * 60_000
/** 호 저장소의 패키지는 200MB 남짓(m09 node_modules) — 처음 받는 PC 를 생각해 넉넉히 */
const HALL_INSTALL_MS = 20 * 60_000

export type CliRun = ProcResult & { ok: boolean; why: string }

const finished = (r: ProcResult, limit: string): CliRun => ({ ...r, ok: r.code === 0, why: r.code === 0 ? '' : procWhy(r, limit) })

/** CLI 한 번. `link` 의 호는 `M\d\d` 만 받는다 */
export async function runCli(work: string, cmd: 'help' | 'link', month = '', onLine?: (l: string) => void): Promise<CliRun> {
  const blank: ProcResult = { code: null, timedOut: false, tail: [] }
  if (cmd === 'link' && !/^M\d\d$/.test(month)) return { ...blank, ok: false, why: `호 번호가 올바르지 않습니다: ${month}` }
  const entry = cliEntry(work)
  if (!existsSync(entry)) return { ...blank, ok: false, why: `${entry} 파일이 없으니 sparkon_cli 폴더에서 yarn install 과 yarn build 를 실행하세요.` }
  const args = cmd === 'link' ? [entry, cmd, month] : [entry, cmd]
  const limit = cmd === 'link' ? LINK_MS : HELP_MS
  const r = await runProc('node', args, { cwd: work, timeout: limit, env: QUIET, onLine })
  return finished(r, `sparkon ${cmd} 가 ${limit / 1000}초 안에 끝나지 않았습니다.`)
}

/** 호 저장소의 패키지 설치 — lock 을 바꾸지 않게 `--frozen-lockfile` */
export async function yarnInstall(dir: string, onLine?: (l: string) => void, timeout = HALL_INSTALL_MS): Promise<CliRun> {
  const r = await runLine('yarn install --frozen-lockfile --non-interactive', { cwd: dir, timeout, env: QUIET, onLine })
  return finished(r, `yarn install 이 ${timeout / 60_000}분 안에 끝나지 않았습니다.`)
}

/** 한 단계의 결과 — `shared/forge/setup.ts` 의 SetupStep 과 같은 꼴 */
export type CliStep = { state: 'done' | 'skip' | 'fail'; line: string; detail?: string }

/** sparkon_cli 를 부를 수 있게 — 없는 것만 만든다. 다 있으면 아무것도 안 한다 */
export async function prepareCli(work: string, onLine: (l: string) => void): Promise<CliStep[]> {
  const dir = join(work, CLI_DIR)
  const steps: CliStep[] = []
  // bin 은 있는데 node_modules 가 없으면 CLI 가 import 에서 죽는다 — 두 조건을 따로 본다
  if (existsSync(join(dir, 'node_modules'))) steps.push({ state: 'skip', line: '패키지가 이미 설치되어 있습니다.' })
  else {
    onLine('패키지를 설치합니다.')
    const r = await yarnInstall(dir, onLine, CLI_INSTALL_MS)
    if (!r.ok) return [...steps, { state: 'fail', line: '패키지를 설치하지 못했습니다.', detail: r.why }]
    steps.push({ state: 'done', line: '패키지를 설치했습니다.' })
  }
  if (existsSync(cliEntry(work))) steps.push({ state: 'skip', line: '실행 파일(bin)이 이미 있습니다.' })
  else {
    onLine('실행 파일(bin)을 만듭니다.')
    const r = finished(await runLine('yarn run build', { cwd: dir, timeout: CLI_BUILD_MS, env: QUIET, onLine }), '빌드가 3분 안에 끝나지 않았습니다.')
    if (!r.ok) return [...steps, { state: 'fail', line: '실행 파일(bin)을 만들지 못했습니다.', detail: r.why }]
    if (!existsSync(cliEntry(work))) return [...steps, { state: 'fail', line: '빌드는 끝났는데 bin/index.js 가 생기지 않았습니다.' }]
    steps.push({ state: 'done', line: '실행 파일(bin)을 만들었습니다.' })
  }
  const help = await runCli(work, 'help', '', onLine)
  if (!help.ok) return [...steps, { state: 'fail', line: 'sparkon 명령을 실행하지 못했습니다.', detail: help.why }]
  if (!help.tail.some((l) => l.includes('sparkon link'))) return [...steps, { state: 'fail', line: 'sparkon 도움말에 link 명령이 나오지 않았습니다.' }]
  return steps
}
