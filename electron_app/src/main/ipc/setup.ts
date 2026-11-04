import { isAbsolute } from 'node:path'
import { dialog, ipcMain, shell } from 'electron'
import type { BranchPlans, ClaudeLoginOpen, SetupLine, SetupResult, SetupRun, WorkPick } from '../../shared/forge'
import { IPC } from '../../shared/ipc'
import { branchPlans, finishSetup, runSetup, setupState } from '../services/forge/setup'
import { branchProblem } from '../services/forge/setupbranch'
import { openClaudeLogin } from '../services/forge/claudelogin'
import { claudeLoggedIn, installPage, saveGitIdentity } from '../services/forge/setupchecks'
import { inspectWork } from '../services/forge/setuprepos'

/**
 * **처음 설정** 채널 (2026-10-01) — 양산기 폴더를 못 찾으면 렌더러가 처음 설정 창을 띄운다.
 * 폴더는 사람이 대화상자로 고른다 — 렌더러가 경로를 적어 보내지 않는다. 설정이 끝나면 화면이 새로 읽는다 —
 * 앱을 다시 켤 필요는 없다: 못 찾은 양산기를 붙잡아 두지 않는다(`runtime.ts` · `forgeroot.ts`). 다시 켜면 dev 에서는 개발 서버까지 꺼진다
 *
 * 2026-10-16 — 점검표(다시 확인) · 내 브랜치 계획 · 「설정 완료」(진행 줄을 누른 창에 민다) · 「마치기」. 받는 글은 여기서 한 번만 거른다:
 * 브랜치 이름(`branchProblem`), 따라갈 저장소 이름(`sparkon_common` · `sparkon_mNN` 꼴만), 이름 · 팀(비면 안 받음)
 */
let picked = ''

const FOLLOW = /^sparkon_(?:common|m\d\d)$/
const follows = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && FOLLOW.test(s)).slice(0, 40) : [])
const text = (x: unknown, max: number): string => String(x ?? '').trim().slice(0, max)

/**
 * 시험 전용 — `SPARKON_FIRST_RUN=1` 로 띄운 앱만 `SPARKON_FIRST_RUN_WORK` 를 고른 폴더로 본다(창 대화상자는 CDP 로 못 누른다).
 * 평소 앱은 이 값을 읽지 않는다
 */
function testPick(): string {
  const dir = process.env['SPARKON_FIRST_RUN'] === '1' ? (process.env['SPARKON_FIRST_RUN_WORK'] ?? '') : ''
  return dir && isAbsolute(dir) ? dir : ''
}

export function registerSetupIpc(): void {
  ipcMain.handle(IPC.setupState, () => setupState())

  ipcMain.handle(IPC.setupPickWork, async (): Promise<WorkPick | null> => {
    const pre = testPick()
    if (pre) {
      picked = pre
      return inspectWork(picked)
    }
    const got = await dialog.showOpenDialog({
      title: '작업 폴더 선택 (저장소를 받아 둘 폴더)',
      properties: ['openDirectory', 'createDirectory']
    })
    if (got.canceled || got.filePaths.length === 0) return null
    picked = got.filePaths[0] as string
    return inspectWork(picked)
  })

  // 「다시 확인」 — 사람이 git 으로 받은 뒤 다시 잰다
  ipcMain.handle(IPC.setupRecheck, (): Promise<WorkPick> | null => (picked ? inspectWork(picked) : null))

  ipcMain.handle(IPC.setupBranchPlan, async (_e, branch: unknown): Promise<BranchPlans> => {
    const b = text(branch, 60)
    if (!picked) return { branch: b, repos: [], error: '작업 폴더를 먼저 선택하세요.' }
    const why = await branchProblem(b)
    return why ? { branch: b, repos: [], error: why } : branchPlans(picked, b)
  })

  // 경로는 받지 않는다 — 대화상자로 고른 것만 쓴다(신뢰 경계). 도는 동안 진행 줄을 누른 창에만 민다
  ipcMain.handle(IPC.setupRun, async (event, branch: unknown, follow: unknown): Promise<SetupRun> => {
    const b = text(branch, 60)
    const fail = (error: string): SetupRun => ({ ok: false, forgeReady: false, repos: [], error })
    if (!picked) return fail('작업 폴더를 먼저 선택하세요.')
    const why = await branchProblem(b)
    if (why) return fail(why)
    return runSetup(picked, b, follows(follow), (l: SetupLine) => {
      if (!event.sender.isDestroyed()) event.sender.send(IPC.setupEvent, l)
    })
  })

  ipcMain.handle(IPC.setupFinish, (_e, developer: unknown, devTeam: unknown): Promise<SetupResult> | SetupResult => {
    if (!picked) return { ok: false, error: '작업 폴더를 먼저 선택하세요.' }
    const dev = text(developer, 80)
    const team = text(devTeam, 40)
    if (!dev || !team) return { ok: false, error: '이름과 팀을 적으세요.' }
    return finishSetup(picked, dev, team)
  })

  // 주소도 받지 않는다 — 프로그램 이름만 받고 정해 둔 설치 페이지만 연다
  ipcMain.handle(IPC.setupOpenInstall, async (_e, name: unknown): Promise<void> => {
    const url = installPage(String(name ?? ''))
    if (url) await shell.openExternal(url)
  })

  // git 이름 · 메일 — 줄바꿈 · 제어 글자는 설정 파일을 깨므로 여기서 한 번만 거른다(신뢰 경계)
  ipcMain.handle(IPC.setupGitIdentity, (_e, name: unknown, email: unknown): Promise<string> | string => {
    const n = String(name ?? '').trim()
    const m = String(email ?? '').trim()
    if (!n || n.length > 80 || /[\p{Cc}]/u.test(n)) return '이름을 80자 안으로 적으세요.'
    if (m.length > 120 || !/^[^\s@\p{Cc}]+@[^\s@\p{Cc}]+\.[^\s@\p{Cc}]+$/u.test(m)) return '메일 주소를 확인하세요.'
    return saveGitIdentity(n, m)
  })

  // Claude Code 로그인 — 처음 설정과 대화 칸이 같이 부른다. 받는 값이 없다
  ipcMain.handle(IPC.claudeLogin, (): ClaudeLoginOpen => openClaudeLogin())
  ipcMain.handle(IPC.claudeLoggedIn, (): Promise<boolean | null> => claudeLoggedIn())
}
