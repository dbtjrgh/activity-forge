/**
 * **처음 설정의 내 브랜치** (2026-10-16, 사용자 결정). sparkon_common 과 받아 둔 호에만 만든다 — resource_common · sparkon_cli 는 main 그대로.
 *
 * - 지금 그 브랜치면 그대로 · 로컬에 있으면 그 브랜치로 바꾼다 · 없으면 `origin/main` 에서 만들어 바꾼다(`--no-track` — main 을 따라가지 않게)
 * - **원격(origin/<브랜치>)에 이미 있으면** 마지막 커밋의 작성자와 날짜를 보이고, 사람이 두 번 눌러야 그 브랜치를 따라간다 —
 *   남의 브랜치를 내 것으로 알고 「양산 완료 커밋」(`git push origin HEAD`)하지 않게
 * - 커밋하지 않은 변경이 있는 저장소는 브랜치를 바꾸지 않고 까닭을 보인다. **받지 않는다(fetch 안 함)** — 사람이 받을 때 온 원격 브랜치로 잰다
 * - 푸시하지 않는다. 처음 「양산 완료 커밋」(또는 「main 에 모두 올리기」)이 원격에 만들고, 그 푸시가 `-u` 로 `origin/<브랜치>` 를
 *   따라갈 원격 브랜치(`@{u}`)로 건다 — `behind.ts` · 관리 화면이 그것과 비교한다. `--track origin/main` 으로 만들지 않는 까닭:
 *   그러면 그 둘이 main 과 비교하게 되고, push.default 가 upstream 인 PC 에서는 손으로 친 `git push` 가 main 으로 간다
 * 디스크가 정본이다 — 브랜치 이름을 따로 저장하지 않는다. Electron 을 import 하지 않는다.
 */

import { join } from 'node:path'
import { onMainBranch, type BranchPlan, type SetupStep } from '../../../shared/forge'
import { git, tryGit } from '../../lib/git'

const T = 15_000
/** 처음 설정이 받는 브랜치 이름 — 영문 · 숫자 · `.` `_` `-` 만, 40자까지 */
const NAME = /^[A-Za-z0-9._-]{1,40}$/
const RESERVED = new Set(['main', 'master', 'head'])

/** 이름 칸 제안 — git 사용자 이름을 영문 소문자로. 한글 이름처럼 남는 글자가 없으면 빈 글 */
export function suggestBranch(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 40)
  return RESERVED.has(s) ? '' : s
}

/** 받을 수 없는 브랜치 이름이면 그 까닭(사람 말) — 받을 수 있으면 빈 글. IPC 층이 한 번 부른다 */
export async function branchProblem(name: string): Promise<string> {
  if (!name) return '브랜치 이름을 적으세요.'
  if (!NAME.test(name)) return '브랜치 이름은 영문, 숫자, 마침표, 밑줄, 붙임표로 40자 안에 적으세요.'
  if (RESERVED.has(name.toLowerCase())) return `${name} 브랜치는 쓸 수 없으니 내 이름으로 된 브랜치를 적으세요.`
  const r = await tryGit(process.cwd(), ['check-ref-format', '--branch', name], T)
  return r.ok ? '' : 'git 이 받지 않는 이름이니 다른 브랜치 이름을 적으세요.'
}

const has = async (dir: string, ref: string): Promise<boolean> => (await tryGit(dir, ['rev-parse', '--verify', '-q', ref], T)).ok

/** 저장소 하나를 어떻게 할지 — 읽기만 한다 */
export async function planBranch(work: string, repo: string, branch: string): Promise<BranchPlan> {
  const dir = join(work, repo)
  const now = (await tryGit(dir, ['branch', '--show-current'], T)).out.trim()
  const out: BranchPlan = { repo, now, action: 'error' }
  if (now === branch) return { ...out, action: 'same' }
  const st = await tryGit(dir, ['status', '--porcelain', '--untracked-files=no'], T)
  if (!st.ok) return { ...out, why: '저장소 상태를 읽지 못했습니다.' }
  if (st.out.trim()) return { ...out, action: 'dirty', why: '커밋하지 않은 변경이 있어 브랜치를 바꾸지 않습니다.' }
  if (await has(dir, `refs/heads/${branch}`)) return { ...out, action: 'local' }
  if (await has(dir, `refs/remotes/origin/${branch}`)) {
    const last = (await tryGit(dir, ['log', '-1', '--format=%an%x09%cI', `refs/remotes/origin/${branch}`], T)).out.trim()
    const [author = '', date = ''] = last.split('\t')
    return { ...out, action: 'remote', author, date: date.slice(0, 10) }
  }
  if (!(await has(dir, 'refs/remotes/origin/main'))) return { ...out, why: '원격 main 브랜치가 없어 브랜치를 만들 수 없습니다.' }
  return { ...out, action: 'create' }
}

/** 브랜치를 맞춘다 — 누를 때 다시 잰다. `follow` 는 원격에 같은 이름이 있을 때 사람이 두 번 눌러 확인한 것 */
export async function applyBranch(work: string, repo: string, branch: string, follow: boolean): Promise<SetupStep> {
  const p = await planBranch(work, repo, branch)
  const dir = join(work, repo)
  const run = async (args: string[], done: string): Promise<SetupStep> => {
    try {
      await git(dir, args, T)
      return { state: 'done', line: done }
    } catch (error) {
      const err = String((error as { stderr?: string }).stderr || (error as Error).message || '').trim().split(/\r?\n/).pop()
      return { state: 'fail', line: '브랜치를 바꾸지 못했습니다.', detail: err }
    }
  }
  switch (p.action) {
    case 'same':
      return { state: 'skip', line: `이미 ${branch} 브랜치입니다.` }
    case 'local':
      return run(['switch', branch], `로컬에 있던 ${branch} 브랜치로 바꿨습니다.`)
    case 'create':
      return run(['switch', '-c', branch, '--no-track', 'origin/main'], `origin/main 에서 ${branch} 브랜치를 만들었습니다.`)
    // 못 바꾼 채 main 에 남으면 실패(✕)로 둔다 — 「마치기」를 막는다(`onMainBranch`). main 이 아닌 내 브랜치에 남은 것은 사람이 볼 것(!)이다
    case 'remote':
      if (follow) return run(['switch', '-c', branch, '--track', `origin/${branch}`], `원격 ${branch} 브랜치를 따라가도록 바꿨습니다.`)
      if (onMainBranch(p.now)) return { state: 'fail', line: `원격에 ${branch} 브랜치가 이미 있어 ${p.now} 브랜치에 남았으니, 따라가기를 누르거나 다른 이름을 적으세요.` }
      return { state: 'hold', line: `원격에 ${branch} 브랜치가 이미 있어 바꾸지 않았습니다.` }
    case 'dirty':
      if (onMainBranch(p.now)) return { state: 'fail', line: `커밋하지 않은 변경이 있어 ${p.now} 브랜치에 남았으니, 변경을 커밋하거나 치운 뒤 다시 실행하세요.` }
      return { state: 'hold', line: p.why ?? '' }
    default:
      return { state: 'fail', line: p.why ?? '브랜치를 바꾸지 못했습니다.' }
  }
}
