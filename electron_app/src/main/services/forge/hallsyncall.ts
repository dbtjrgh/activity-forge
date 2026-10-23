/**
 * **「main 에 모두 올리기」 진행판 입구** (2026-10-14) — 양산기 설정으로 대상(공용 하나 · 호 저장소들)을 찾고, 계획(`hallsyncplan.ts`)과
 * 실행(`hallsync.ts`)을 저장소마다 부른다. 앱 저장소는 넣지 않는다.
 *
 * - 공용 먼저, 호 나중. **공용이 멈추면 호는 하지 않는다** — 호의 학습코드가 새 모듈에 기댈 수 있다
 * - 호끼리는 따로 — 한 호가 멈춰도 다음 호는 한다
 * - 한 번에 하나만 돈다 — 두 번 누르면 같은 저장소에 git 이 둘 붙는다
 *
 * Electron 을 import 하지 않는다(services 규칙). 진행 줄을 화면에 미는 것은 `ipc/sync.ts`.
 */

import { basename } from 'node:path'
import type { SyncLine, SyncPlan, SyncRepo, SyncRepoDone, SyncResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { isRepoRoot } from '../../lib/git'
import { chatHold } from './chatstore'
import { commitDone } from './hallcommit'
import { syncRepo, type SyncTarget } from './hallsync'
import { planRepo, type HallDeps } from './hallsyncplan'
import { hallDirs } from './hallwalk'
import { mark } from './measure'
import { loadForge } from './runtime'

let running = false

/** 올리는 중인가 — 끌 때 · 업데이트 뒤 다시 켜기가 본다(`busy.ts`) */
export const syncBusy = (): boolean => running

/** 양산기 설정으로 정한 대상 — 공용 하나(있으면)와 호 저장소들, 그리고 호 쪽이 쓰는 것 */
async function setup(): Promise<{ targets: SyncTarget[]; deps: HallDeps }> {
  const forge = await loadForge()
  const work = forge.paths.workRoot()
  // 공용 폴더 자리는 forge `commonRoot` 하나다 — 사람이 다른 자리로 정할 수 있다(2026-10-21)
  const common = forge.commonroot.commonRoot()
  const busy = (code: string): string => {
    const hold = chatHold(forge.paths.REPO_ROOT, code)
    return hold === 'busy' ? '생성 중입니다.' : hold === 'waiting' ? '대화가 답을 기다리고 있습니다.' : ''
  }
  return {
    // 저장소 맨 위일 때만 공용으로 — 다른 저장소 안의 폴더를 공용으로 올리지 않는다(2026-10-21)
    targets: [...((await isRepoRoot(common, 10_000)) ? [{ dir: common }] : []), ...hallDirs(work).map((h) => ({ dir: h.dir, hall: { month: h.month } }))],
    deps: {
      me: forge.user.loadUser(),
      busy,
      // 「양산 완료 커밋」과 같은 길 — 빗장 · 타입 검사 · 문구 · 기록. 저장소는 학습코드로 같은 자리를 찾는다
      commit: (_repo, code) => commitDone(code, { push: false }),
      marked: (code, branch) => mark(forge.paths.REPO_ROOT, code, 'main', branch)
    }
  }
}

/** 첫 누름 — 할 일이나 제외가 있는 저장소만. 받아 오지 않는다 */
export async function syncPlan(): Promise<SyncPlan> {
  try {
    const { targets, deps } = await setup()
    return { repos: await syncPlanOn(targets, deps) }
  } catch (error) {
    return { repos: [], error: toMessage(error) }
  }
}

/** 대상을 받는 쪽 — 시험 저장소로 그대로 돌린다 */
export async function syncPlanOn(targets: SyncTarget[], deps: HallDeps): Promise<SyncRepo[]> {
  const all = await Promise.all(targets.map((t) => planRepo(t.dir, t.hall ? { month: t.hall.month, me: deps.me, busy: deps.busy } : undefined)))
  return all.filter((r) => Boolean(r.error) || r.commits.length > 0 || r.ahead.length > 0 || r.skipped.length > 0)
}

/** 두 번째 누름 — `shown` 화면이 보인 열쇠(`syncKeys`). 열쇠가 없는 저장소는 건드리지 않는다 */
export async function syncRun(shown: string[], say: (l: SyncLine) => void): Promise<SyncResult> {
  if (running) return { repos: [], error: '이미 올리는 중입니다.' }
  running = true
  try {
    const { targets, deps } = await setup()
    return { repos: await syncRunOn(targets, deps, shown, say) }
  } catch (error) {
    return { repos: [], error: toMessage(error) }
  } finally {
    running = false
  }
}

/** 대상을 받는 쪽 — 공용 먼저(대상 차례 그대로), 공용이 멈추면 호는 안 한다 */
export async function syncRunOn(targets: SyncTarget[], deps: HallDeps, shown: string[], say: (l: SyncLine) => void): Promise<SyncRepoDone[]> {
  const names = new Set(shown.map((k) => k.split(':')[1]))
  const keys = new Set(shown)
  const repos: SyncRepoDone[] = []
  let commonStopped = false
  for (const t of targets.filter((x) => names.has(basename(x.dir)))) {
    const name = basename(t.dir)
    if (t.hall && commonStopped) {
      repos.push({ name, ok: false, done: [], stopped: '공용 저장소에서 멈춰 호 저장소는 하지 않았습니다.' })
      continue
    }
    const r = await syncRepo(t, keys, deps, (line) => say({ name, line }))
    repos.push(r)
    if (!t.hall && !r.ok) commonStopped = true
  }
  return repos
}
