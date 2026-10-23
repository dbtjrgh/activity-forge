/**
 * **처음 설정** (2026-10-01, 사용자 요청) — 단일 실행 파일로 받은 사람이 처음 켜면 양산기 폴더가 없다.
 *
 * 사람은 **작업 폴더 하나만** 고른다 — 호 저장소(sparkon_m01 ~ sparkon_m11)를 받아 둘 상위 폴더.
 * 그 안에 `SparkOn-양산기`(이 저장소를 내려받음 · 스펙 · 배치표 · 업데이트)와 `SparkOn-리소스`(학습코드별 리소스)를 만든다.
 * - 양산기 폴더를 묻지 않는다(사용자 결정). 저장소 뿌리가 `SparkOn-양산기` 이고 앱이 읽는 것은 그 안의 `forge` 다
 * - **정본은 그대로다** — 앱 쪽에는 양산기 자리 하나(`home.ts`), 작업 · 리소스 폴더는 `.user.json`(forge `user.ts` 가 쓴다)
 * - 내려받기는 git 이 필요하고 git.example.com 계정이 있어야 한다 — 없으면 까닭을 사람 말로
 *
 * **2026-10-16 — 나머지 저장소는 사람이 git 으로 받는다**(사용자 결정). 앱이 받는 것은 양산기 하나다(로그인 창은 여기서 한 번).
 * 차례: 점검표(`setuprepos.ts`) → 「설정 완료」 = 양산기 받기 + 받아 둔 저장소 준비(`setupprep.ts`) → 「마치기」 = 자리 기억 · 리소스 폴더 · `.user.json`
 * (실패 없이 「설정 완료」가 끝났을 때만).
 * **자리 기억은 맨 끝 「마치기」에서만** 한다 — 전에는 양산기를 받은 바로 뒤라, 뒤에서 실패해도 다음에 켜면 처음 설정이 다시 안 떴다.
 * 다시 하면 이미 된 것은 건너뛴다.
 *
 * Electron 을 import 하지 않는다(services 규칙). 화면을 다시 읽는 것은 렌더러가 한다.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { onMainBranch, type BranchPlans, type SetupLine, type SetupRepo, type SetupResult, type SetupRun, type SetupState } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { gitClone } from '../../lib/git'
import { forgetForgeRoot, looksLikeForge, rememberForgeRoot } from './home'
import { findForgeRoot, loadForge } from './runtime'
import { planBranch, suggestBranch } from './setupbranch'
import { gitName, programChecks } from './setupchecks'
import { prepareWork, repoDone } from './setupprep'
import { inspectWork, repoUrl } from './setuprepos'

/** 양산기 저장소 — 이 앱의 저장소다. 앱이 업데이트를 받는 곳도 여기다(`refresh.ts`) */
const REPO_URL = repoUrl('electron-app')
/** 내려받기 상한 — 저장소는 9MB 남짓이지만 로그인 창을 기다릴 수 있다 */
const CLONE_MS = 10 * 60_000

/** 팀 칸 제안 — 이 앱을 쓰는 팀 대부분이 이 이름으로 적는다(관리 「팀별」) */
const TEAM = 'my-team'

export async function setupState(): Promise<SetupState> {
  const needed = findForgeRoot() === null
  const developer = await gitName()
  const suggest = { developer, devTeam: TEAM, branch: suggestBranch(developer) }
  if (!needed) return { needed, checks: [], suggest }
  return { needed, checks: await programChecks(), suggest }
}

/** git 이 낸 글 → 사람이 할 일 */
function cloneError(raw: string): string {
  if (raw === 'timeout') return '양산기를 내려받는 데 10분이 넘었습니다. 네트워크를 확인한 뒤 다시 시도하세요.'
  if (/could not read Username|Authentication failed|403|401|terminal prompts disabled/i.test(raw)) {
    return 'git.example.com에 로그인하지 못했습니다. 저장소에 접근할 수 있는 계정인지 확인한 뒤 다시 시도하세요.'
  }
  if (/Could not resolve host|unable to access|timed out/i.test(raw)) {
    return 'git.example.com에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요.'
  }
  const last = raw.trim().split(/\r?\n/).pop() ?? ''
  return `양산기를 내려받지 못했습니다. ${last}`
}

/** 내 브랜치를 만드는 저장소 — 받아 둔 sparkon_common 과 호. resource_common · sparkon_cli 는 main 그대로다 */
const branchTarget = (r: SetupRepo): boolean => r.have && (r.kind === 'hall' || r.name === 'sparkon_common')

/** 내 브랜치를 저장소마다 어떻게 할지 — sparkon_common 과 받아 둔 호. 읽기만 한다 */
export async function branchPlans(dir: string, branch: string): Promise<BranchPlans> {
  const pick = await inspectWork(dir)
  if (pick.error) return { branch, repos: [], error: pick.error }
  const targets = pick.repos.filter(branchTarget).map((r) => r.name)
  return { branch, repos: await Promise.all(targets.map((t) => planBranch(pick.dir, t, branch))) }
}

let running = false
/** 「설정 완료」가 도는 중인가 — 끌 때 묻기(`busy.ts`)가 본다. 끄면 받기 · yarn 이 중간에 끊긴다 */
export const setupBusy = (): boolean => running

/**
 * 마지막 「설정 완료」의 폴더와 실패가 없었나 — 「마치기」가 본다(화면이 단추를 막는 것만 믿지 않는다).
 * 실패(✕)가 있으면 자리를 기억하지 않는다 — 기억하면 다음에 켤 때 처음 설정이 안 떠 고칠 자리가 없다(2026-10-16 검산).
 * 사람이 볼 것(!, 원격 브랜치를 안 따라감 · 커밋 안 한 변경)은 마칠 수 있다 — 그래서 main 에 남으면 ! 가 아니라 ✕ 다(`setupbranch.ts`). 메모리에만 둔다 — 앱을 다시 켜면 한 번 더 눌러야 하지만 된 것은 건너뛴다
 */
let lastRun: { dir: string; ok: boolean } | null = null

/** 「설정 완료」 — 양산기를 받고(이미 있으면 건너뜀) 받아 둔 저장소를 준비한다. 자리는 아직 기억하지 않는다. 한 번에 하나만 돈다 */
export async function runSetup(dir: string, branch: string, follow: string[], say: (l: SetupLine) => void): Promise<SetupRun> {
  if (running) return { ok: false, forgeReady: false, repos: [], error: '이미 설정하는 중입니다.' }
  running = true
  lastRun = null
  try {
    const r = await setupOnce(dir, branch, follow, say)
    lastRun = { dir: dir.trim(), ok: r.ok && !r.error }
    return r
  } finally {
    running = false
  }
}

async function setupOnce(dir: string, branch: string, follow: string[], say: (l: SetupLine) => void): Promise<SetupRun> {
  const pick = await inspectWork(dir)
  const fail = (error: string): SetupRun => ({ ok: false, forgeReady: pick.forgeReady, repos: [], error })
  if (pick.error) return fail(pick.error)
  if (!pick.ready) return fail(pick.missing)
  const forge = repoDone('SparkOn-양산기', [{ state: 'skip', line: '이미 받아 두었습니다.' }])
  if (!pick.forgeReady) {
    if (existsSync(pick.forgeDir) && readdirSync(pick.forgeDir).length > 0) {
      return fail(`${pick.forgeDir} 폴더가 이미 있는데 양산기 저장소가 아닙니다. 폴더 이름을 바꾸거나 비운 뒤 다시 시도하세요.`)
    }
    say({ name: 'SparkOn-양산기', line: '양산기를 내려받는 중이며, 로그인 창이 뜨면 git.example.com 계정으로 로그인하세요.' })
    try {
      // main 만 받는다 — 앱 새 버전을 싣는 app-dist 가지는 업데이트할 때만 따로 받는다(`appupdate.ts`)
      await gitClone(REPO_URL, pick.forgeDir, CLONE_MS, ['--single-branch', '--branch', 'main'])
    } catch (error) {
      return fail(cloneError((error as Error).message))
    }
    if (!looksLikeForge(join(pick.forgeDir, 'forge'))) return fail('양산기를 받았는데 forge 폴더가 없습니다.')
    forge.state = 'done'
    forge.steps = [{ state: 'done', line: '양산기를 내려받았습니다.' }]
    say({ name: 'SparkOn-양산기', line: '양산기를 내려받았습니다.' })
  }
  const halls = pick.repos.filter((r) => r.kind === 'hall' && r.have).map((r) => r.name)
  const repos = [forge, ...(await prepareWork(pick.dir, halls, branch, follow, say))]
  return { ok: repos.every((r) => r.state !== 'fail'), forgeReady: true, repos }
}

/**
 * 「마치기」 — 양산기 자리를 기억하고 리소스 폴더와 `.user.json` 을 쓴다. `.user.json` 을 못 쓰면 기억을 되돌린다(다음에 켜면 처음 설정이 다시 뜨게).
 * 이 폴더로 「설정 완료」를 돌려 실패가 없었을 때만 한다(`lastRun`). 그사이 저장소를 지웠으면 점검표가 다시 막는다
 */
export async function finishSetup(dir: string, developer: string, devTeam: string): Promise<SetupResult> {
  const pick = await inspectWork(dir)
  if (pick.error) return { ok: false, error: pick.error }
  if (!lastRun || lastRun.dir !== pick.dir || !pick.forgeReady) return { ok: false, error: '「설정 완료」를 먼저 누르세요.' }
  if (!lastRun.ok) return { ok: false, error: '✕ 표시한 것을 고친 뒤 「다시 실행」을 누르세요.' }
  if (!pick.ready) return { ok: false, error: pick.missing }
  // 디스크를 다시 읽는다 — 「설정 완료」 뒤 사람이 손으로 main 으로 돌아갔을 수도 있다(`onMainBranch`)
  const stuck = pick.repos.filter((r) => branchTarget(r) && onMainBranch(r.branch ?? '')).map((r) => r.name)
  if (stuck.length) return { ok: false, error: `${stuck.join(', ')} 저장소가 main 브랜치에 남아 있어 마칠 수 없습니다.` }
  const remembered = rememberForgeRoot(join(pick.forgeDir, 'forge'))
  if (!remembered.ok) return { ok: false, error: remembered.error }
  try {
    // 리소스 폴더 — 사람이 학습코드별 리소스를 넣는 자리. 빈 폴더로 만든다
    mkdirSync(pick.rscDir, { recursive: true })
    // 작업 · 리소스 폴더 · 만든 사람 — `.user.json` 이 정본이다. forge 가 쓰게 한다(두 벌로 안 쓴다)
    const { user } = await loadForge()
    user.saveUser({ workRoot: pick.dir, rscRoot: pick.rscDir, developer, devTeam })
    return { ok: true }
  } catch (error) {
    forgetForgeRoot()
    return { ok: false, error: toMessage(error) }
  }
}
