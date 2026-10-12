/**
 * **처음 설정** (2026-10-01, 사용자 요청) — 단일 실행 파일로 받은 사람이 처음 켜면 양산기 폴더가 없다.
 *
 * 사람은 **작업 폴더 하나만** 고른다 — 호 저장소(sparkon_m01 ~ sparkon_m11)가 들어 있는 상위 폴더.
 * 그 안에 `SparkOn-양산기`(이 저장소를 내려받음 · 스펙 · 배치표 · 업데이트)와 `SparkOn-리소스`(학습코드별 리소스)를 만든다.
 * - 양산기 폴더를 묻지 않는다(사용자 결정). 저장소 뿌리가 `SparkOn-양산기` 이고 앱이 읽는 것은 그 안의 `forge` 다
 * - **정본은 그대로다** — 앱 쪽에는 양산기 자리 하나(`home.ts`), 작업 · 리소스 폴더는 `.user.json`(forge `user.ts` 가 쓴다)
 * - 차례: 살펴보기 → 내려받기(이미 있으면 건너뜀) → 양산기인지 확인 → 자리 기억 → 리소스 폴더 → `.user.json`
 * - 내려받기는 git 이 필요하고 git.example.com 계정이 있어야 한다 — 없으면 까닭을 사람 말로
 *
 * Electron 을 import 하지 않는다(services 규칙). 다시 켜는 것은 IPC 층이 한다.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { SETUP_FORGE_DIR, SETUP_RSC_DIR, type SetupResult, type SetupState, type WorkPick } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { gitClone } from '../../lib/git'
import { looksLikeForge, rememberForgeRoot } from './home'
import { findForgeRoot, loadForge } from './runtime'
import { gitName, programChecks } from './setupchecks'

/** 양산기 저장소 — 이 앱의 저장소다. 앱이 업데이트를 받는 곳도 여기다(`refresh.ts`) */
const REPO_URL = 'https://git.example.com/your-org/activity-forge.git'
/** 내려받기 상한 — 저장소는 9MB 남짓이지만 로그인 창을 기다릴 수 있다 */
const CLONE_MS = 10 * 60_000
const REPO = /^sparkon_m\d\d$/

/** 팀 칸 제안 — 이 앱을 쓰는 팀 대부분이 이 이름으로 적는다(관리 「팀별」) */
const TEAM = 'my-team'

export async function setupState(): Promise<SetupState> {
  const needed = findForgeRoot() === null
  const suggest = { developer: await gitName(), devTeam: TEAM }
  if (!needed) return { needed, checks: [], suggest }
  return { needed, checks: await programChecks(), suggest }
}

/** 고른 폴더가 작업 폴더인가 — 안에 호 저장소가 있어야 한다 */
export function inspectWork(dir: string): WorkPick {
  const clean = dir.trim()
  const forgeDir = join(clean, SETUP_FORGE_DIR)
  const rscDir = join(clean, SETUP_RSC_DIR)
  const out: WorkPick = { dir: clean, repos: [], forgeDir, forgeReady: false, rscDir, rscReady: false }
  if (!clean || !isAbsolute(clean)) return { ...out, error: '폴더를 선택하세요.' }
  if (!existsSync(clean)) return { ...out, error: '선택한 폴더가 없습니다.' }
  try {
    out.repos = readdirSync(clean, { withFileTypes: true })
      .filter((d) => d.isDirectory() && REPO.test(d.name))
      .map((d) => d.name)
      .sort()
  } catch (error) {
    return { ...out, error: toMessage(error) }
  }
  out.forgeReady = looksLikeForge(join(forgeDir, 'forge'))
  out.rscReady = existsSync(rscDir)
  if (!out.repos.length) {
    return {
      ...out,
      error: '이 폴더 안에 호 저장소(sparkon_m01 같은 폴더)가 없습니다. 호 저장소들이 들어 있는 상위 폴더를 선택하세요.'
    }
  }
  return out
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

export async function runSetup(dir: string, developer: string, devTeam: string): Promise<SetupResult> {
  const pick = inspectWork(dir)
  if (pick.error) return { ok: false, error: pick.error }
  try {
    // ─ 양산기 내려받기 ─ 이미 받아 둔 것이 있으면 그대로 쓴다(다시 설정할 때)
    if (!pick.forgeReady) {
      if (existsSync(pick.forgeDir) && readdirSync(pick.forgeDir).length > 0) {
        return {
          ok: false,
          error: `${pick.forgeDir} 폴더가 이미 있는데 양산기 저장소가 아닙니다. 폴더 이름을 바꾸거나 비운 뒤 다시 시도하세요.`
        }
      }
      try {
        // main 만 받는다 — 앱 새 버전을 싣는 app-dist 가지는 업데이트할 때만 따로 받는다(`appupdate.ts`)
        await gitClone(REPO_URL, pick.forgeDir, CLONE_MS, ['--single-branch', '--branch', 'main'])
      } catch (error) {
        return { ok: false, error: cloneError((error as Error).message) }
      }
    }
    const forgeRoot = join(pick.forgeDir, 'forge')
    const remembered = rememberForgeRoot(forgeRoot)
    if (!remembered.ok) return { ok: false, error: remembered.error }

    // ─ 리소스 폴더 ─ 사람이 학습코드별 리소스를 넣는 자리. 빈 폴더로 만든다
    mkdirSync(pick.rscDir, { recursive: true })

    // ─ 작업 · 리소스 폴더 · 만든 사람 ─ `.user.json` 이 정본이다. forge 가 쓰게 한다(두 벌로 안 쓴다)
    const { user } = await loadForge()
    user.saveUser({
      workRoot: pick.dir,
      rscRoot: pick.rscDir,
      ...(developer.trim() ? { developer: developer.trim() } : {}),
      ...(devTeam.trim() ? { devTeam: devTeam.trim() } : {})
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toMessage(error) }
  }
}
