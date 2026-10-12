/**
 * **초기 설정의 「필요한 프로그램」** (2026-10-01, `setup.ts` 에서 뗌 — 200줄을 넘었다).
 * git · Claude Code · poppler 가 있나, Claude Code 에 로그인돼 있나, 없으면 어디서 받나 · 이름 칸 제안(git 이름).
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
  'Claude Code': 'https://code.claude.com/docs/en/setup'
}

export function installPage(name: string): string | null {
  return INSTALL[name] ?? null
}

/** 이름 칸 제안 — 그 PC 의 git 사용자 이름. 없으면 빈 글 */
export async function gitName(): Promise<string> {
  try {
    return (await git(process.cwd(), ['config', 'user.name'], 5000)).trim()
  } catch {
    return ''
  }
}

/** 프로그램이 있나 — 버전을 물어 본다. 셸로 불러야 claude.cmd 도 잡힌다 */
async function has(cmd: string, args: string[], shell = false): Promise<boolean> {
  try {
    await run(cmd, args, { timeout: 15_000, windowsHide: true, shell })
    return true
  } catch {
    return false
  }
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

export async function programChecks(): Promise<SetupCheck[]> {
  // 앱을 켜 둔 채 설치했어도 「다시 확인」으로 잡히게 — 레지스트리 PATH 와 기본 자리를 다시 본다
  refreshToolPath()
  const [gitOk, claude] = await Promise.all([has('git', ['--version']), has('claude', ['--version'], process.platform === 'win32')])
  const claudeIn = claude ? await claudeLoggedIn() : null
  const pdf = poppler()
  return [
    {
      name: 'git',
      ok: gitOk,
      required: true,
      install: !gitOk,
      note: gitOk ? '양산기를 내려받고 호 저장소에 반영할 때 씁니다.' : 'git이 없습니다. 설치한 뒤 「다시 확인」을 누르세요.'
    },
    {
      name: 'Claude Code',
      ok: claude && claudeIn !== false,
      required: false,
      install: !claude,
      note: !claude
        ? 'AI 생성에 필요합니다. 설치하고 로그인한 뒤 「다시 확인」을 누르세요.'
        : claudeIn === false
          ? 'Claude Code에 로그인되어 있지 않습니다. 터미널에서 claude를 실행해 로그인한 뒤 「다시 확인」을 누르세요.'
          : 'AI 생성에 씁니다.'
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
