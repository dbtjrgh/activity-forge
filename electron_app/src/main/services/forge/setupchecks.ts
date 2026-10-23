/**
 * **초기 설정의 「필요한 프로그램」** (2026-10-01, `setup.ts` 에서 뗌 — 200줄을 넘었다).
 * git · git 사용자 · Node.js · yarn · Claude Code · poppler 가 있나, Claude Code 에 로그인돼 있나, 없으면 어디서 받나 · 이름 칸 제안(git 이름).
 * 2026-10-16 — 사람이 받은 호 저장소에 처음 설정이 yarn · `sparkon link` 를 해 주려면 Node.js · yarn 이 있어야 하고(설계 plan2.md),
 * 대화로 만들기가 앱의 유일한 길이라 Claude Code 로그인도 필수로 올렸다(사용자 결정). git 이름 · 메일이 없으면 첫 「양산 완료 커밋」이 멈춘다.
 * Electron 을 import 하지 않는다.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SetupCheck } from '../../../shared/forge'
import { git } from '../../lib/git'
import { poppler } from './poppler'
import { refreshToolPath } from './toolpath'

const run = promisify(execFile)

/** 따로 설치해야 하는 프로그램의 설치 페이지 — poppler 는 실행 파일에 들어 있어 없다(`scripts/vendor-poppler.mjs`) */
const INSTALL: Record<string, string> = {
  git: 'https://git-scm.com/downloads/win',
  'Node.js': 'https://nodejs.org/en/download',
  yarn: 'https://classic.yarnpkg.com/en/docs/install',
  'Claude Code': 'https://code.claude.com/docs/en/setup'
}

export function installPage(name: string): string | null {
  return INSTALL[name] ?? null
}

/** git 전역 설정 한 줄 — 없으면 빈 글 */
async function gitConfig(key: string): Promise<string> {
  try {
    return (await git(process.cwd(), ['config', '--global', key], 5000)).trim()
  } catch {
    return ''
  }
}

/** 이름 칸 제안 — 그 PC 의 git 사용자 이름. 없으면 빈 글 */
export async function gitName(): Promise<string> {
  return gitConfig('user.name')
}

/** git 사용자 이름 · 메일을 전역으로 적는다 — 사람이 「저장」을 누를 때만(값은 `ipc/setup.ts` 가 거른다) */
export async function saveGitIdentity(name: string, email: string): Promise<string> {
  try {
    await git(process.cwd(), ['config', '--global', 'user.name', name], 5000)
    await git(process.cwd(), ['config', '--global', 'user.email', email], 5000)
    return ''
  } catch (error) {
    return `git 사용자 정보를 저장하지 못했습니다. ${String((error as Error).message ?? error).slice(0, 200)}`
  }
}

/** 프로그램의 버전 글 — 없으면 null. 셸로 불러야 claude.cmd · yarn.cmd 도 잡힌다 */
async function version(cmd: string, args: string[], shell = false): Promise<string | null> {
  try {
    return (await run(cmd, args, { timeout: 15_000, windowsHide: true, shell })).stdout.trim()
  } catch {
    return null
  }
}

/** 호 저장소의 vite 7 과 sparkon CLI 의 inquirer 13 이 같이 도는 Node.js — `^20.19 || ^22.13 || >=23.5`(두 패키지의 engines) */
export function nodeFits(v: string): boolean {
  const m = /^v?(\d+)\.(\d+)/.exec(v)
  if (!m) return false
  const [major, minor] = [Number(m[1]), Number(m[2])]
  return (major === 20 && minor >= 19) || (major === 22 && minor >= 13) || (major === 23 && minor >= 5) || major >= 24
}

/**
 * Claude Code 에 로그인돼 있나 — `claude auth status` 가 JSON 으로 답한다(`loggedIn`).
 * 로그인이 안 됐으면 종료 코드가 0 이 아닐 수 있어 오류 쪽 stdout 도 본다. 못 읽으면 null(모름) — 모르는 것을 「안 됨」으로 막지 않는다
 */
async function claudeLoggedIn(): Promise<boolean | null> {
  let out = ''
  try {
    out = (await run('claude', ['auth', 'status'], { timeout: 15_000, windowsHide: true, shell: process.platform === 'win32' })).stdout
  } catch (error) {
    out = String((error as { stdout?: string }).stdout ?? '')
  }
  const at = out.indexOf('{')
  if (at < 0) return null
  try {
    const j = JSON.parse(out.slice(at)) as { loggedIn?: unknown }
    return typeof j.loggedIn === 'boolean' ? j.loggedIn : null
  } catch {
    return null
  }
}

const win = process.platform === 'win32'

export async function programChecks(): Promise<SetupCheck[]> {
  // 앱을 켜 둔 채 설치했어도 「다시 확인」으로 잡히게 — 레지스트리 PATH 와 기본 자리를 다시 본다
  refreshToolPath()
  const [gitV, nodeV, yarnV, claudeV] = await Promise.all([
    version('git', ['--version']),
    version('node', ['--version']),
    version('yarn', ['--version'], win),
    version('claude', ['--version'], win)
  ])
  const [userName, userEmail] = gitV ? await Promise.all([gitConfig('user.name'), gitConfig('user.email')]) : ['', '']
  const claudeIn = claudeV ? await claudeLoggedIn() : null
  const nodeOk = nodeV !== null && nodeFits(nodeV)
  const yarnOk = yarnV !== null && yarnV.startsWith('1.')
  const pdf = poppler()
  return [
    {
      name: 'git',
      ok: gitV !== null,
      required: true,
      install: gitV === null,
      note: gitV ? '양산기를 내려받고 호 저장소에 반영할 때 씁니다.' : 'git이 없습니다. 설치한 뒤 「다시 확인」을 누르세요.'
    },
    {
      name: 'git 사용자',
      ok: Boolean(userName && userEmail),
      required: true,
      install: false,
      identity: Boolean(gitV) && !(userName && userEmail),
      note: userName && userEmail ? `${userName} 이름으로 커밋합니다.` : '커밋에 적을 git 이름과 메일이 없습니다. 아래 칸에 적고 「저장」을 누르세요.'
    },
    {
      name: 'Node.js',
      ok: nodeOk,
      required: true,
      install: !nodeOk,
      note: nodeOk
        ? '호 저장소의 미리보기와 sparkon 명령에 씁니다.'
        : nodeV
          ? `Node.js ${nodeV} 는 맞지 않습니다. 22.13 이상으로 설치한 뒤 「다시 확인」을 누르세요.`
          : 'Node.js가 없습니다. 22.13 이상으로 설치한 뒤 「다시 확인」을 누르세요.'
    },
    {
      name: 'yarn',
      ok: yarnOk,
      required: true,
      install: !yarnOk,
      note: yarnOk
        ? '호 저장소의 패키지를 설치할 때 씁니다.'
        : yarnV
          ? `yarn ${yarnV} 는 맞지 않습니다. yarn 1 을 설치한 뒤 「다시 확인」을 누르세요.`
          : 'yarn이 없습니다. yarn 1 을 설치한 뒤 「다시 확인」을 누르세요.'
    },
    {
      name: 'Claude Code',
      ok: claudeV !== null && claudeIn === true,
      required: true,
      install: claudeV === null,
      confirm: claudeV !== null && claudeIn === null,
      note:
        claudeV === null
          ? '대화로 만들기에 필요합니다. 설치하고 로그인한 뒤 「다시 확인」을 누르세요.'
          : claudeIn === false
            ? 'Claude Code에 로그인되어 있지 않습니다. 터미널에서 claude를 실행해 로그인한 뒤 「다시 확인」을 누르세요.'
            : claudeIn === null
              ? '로그인 상태를 확인하지 못했습니다. 로그인했으면 「확인했습니다」를 누르세요.'
              : '대화로 만들기에 씁니다.'
    },
    {
      name: 'poppler',
      ok: pdf.ok,
      required: false,
      install: false,
      note: pdf.ok ? '기획서 PDF를 읽을 때 씁니다.' : '기획서 PDF를 읽지 못합니다. 나머지 기능은 그대로 쓸 수 있습니다.'
    }
  ]
}
