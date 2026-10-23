/**
 * **처음 설정이 받아 둔 저장소에 하는 일** (2026-10-16) — sparkon_cli 준비 → sparkon_common 브랜치 → 호마다 브랜치 · yarn · `sparkon link`.
 *
 * - **이미 된 것은 건너뛴다(멱등)** — 다시 눌러도 같은 결과. bin 이 있으면 안 만들고, vite 가 있으면 yarn 안 하고, 브랜치가 맞으면 그대로,
 *   정션이 제자리면 다시 안 건다
 * - 호 안의 차례는 **브랜치 → yarn → 연결.** 브랜치를 바꾸면 package.json 이 달라질 수 있어 yarn 이 뒤다.
 *   연결(`src/_common` 정션 · skip-worktree)이 브랜치 바꾸기와 부딪히지 않게 연결이 맨 뒤다
 * - yarn 은 vite 가 없을 때만 `--frozen-lockfile`(lock 을 안 바꾼다). 실패하면 그 호만 실패로 두고 다음 호로 간다 — 그 호는 연결하지 않는다
 * - `sparkon_common/node_modules` 는 PC 에 하나뿐인 정션이라 마지막에 건 호를 가리킨다 — **M 번호가 가장 큰 호를 맨 끝에** 맞춘다
 * - 끝나면 정션을 다시 잰다. CLI 가 「만들었습니다」라고 해도 믿지 않는다
 * - **공용 폴더 설정(`.user.json` 의 commonRoot, 2026-10-21)은 여기서 안 쓴다.** 처음 설정은 고른 작업 폴더에 받은 저장소를 다루고,
 *   `sparkon link` 는 cwd(작업 폴더)의 `sparkon_common` 에만 정션을 건다 — 여기는 그 CLI 결과를 재는 자리라 설정 자리로 재면 멀쩡한 연결을 실패로 본다.
 *   그래서 작업 폴더 밖 공용 폴더로 잇는 정션(`commonlink.ts`)도 여기서는 안 건다 — 처음 설정은 작업 폴더 안 sparkon_common 이 있어야 시작한다(`setuprepos.ts`)
 * Electron 을 import 하지 않는다.
 */

import { existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import type { SetupLine, SetupRepoDone, SetupStep } from '../../../shared/forge'
import { applyBranch } from './setupbranch'
import { HALL } from './setuprepos'
import { CLI_DIR, prepareCli, runCli, yarnInstall } from './sparkoncli'
import { viteBin } from './vitespawn'

type Say = (l: SetupLine) => void

const RANK: Record<SetupStep['state'], number> = { skip: 0, done: 1, hold: 2, fail: 3 }

export function repoDone(name: string, steps: SetupStep[]): SetupRepoDone {
  const state = steps.reduce<SetupStep['state']>((a, s) => (RANK[s.state] > RANK[a] ? s.state : a), 'skip')
  return { name, state, steps }
}

const real = (p: string): string => {
  try {
    return realpathSync(p).toLowerCase()
  } catch {
    return ''
  }
}

/** 호 하나의 정션 셋이 제자리를 가리키나 — 공통 소스 · 공통 리소스 · 글꼴 · 첫 화면 */
function hallLinked(work: string, hall: string): boolean {
  const pairs: [string, string][] = [
    [join(work, hall, 'src', '_common'), join(work, 'sparkon_common', '_common')],
    ...['common', 'font', 'landing'].map((p): [string, string] => [join(work, hall, 'public', 'sparklab', p), join(work, 'resource_common', p)])
  ]
  return pairs.every(([at, to]) => {
    const got = real(at)
    return got !== '' && got === real(to)
  })
}

/** 공통 node_modules 가 이 호를 가리키나 */
const sharedOn = (work: string, hall: string): boolean => {
  const got = real(join(work, 'sparkon_common', 'node_modules'))
  return got !== '' && got === real(join(work, hall, 'node_modules'))
}

async function link(work: string, hall: string, say: Say, check: () => boolean): Promise<SetupStep> {
  say({ name: hall, line: '연결합니다.' })
  const r = await runCli(work, 'link', `M${HALL.exec(hall)?.[1] ?? ''}`, (line) => say({ name: hall, line }))
  if (!r.ok) return { state: 'fail', line: '연결하지 못했습니다.', detail: r.why }
  return check() ? { state: 'done', line: '연결했습니다.' } : { state: 'fail', line: '연결 명령은 끝났는데 정션이 제자리를 가리키지 않습니다.' }
}

/** 호 하나 — 브랜치 · yarn · 연결 */
async function prepareHall(work: string, hall: string, branch: string, follow: boolean, cliOk: boolean, say: Say): Promise<SetupStep[]> {
  const dir = join(work, hall)
  const steps = [await applyBranch(work, hall, branch, follow)]
  if (existsSync(viteBin(dir))) steps.push({ state: 'skip', line: '패키지가 이미 설치되어 있습니다.' })
  else {
    say({ name: hall, line: '패키지를 설치하는 중이며, 몇 분 걸릴 수 있습니다.' })
    const r = await yarnInstall(dir, (line) => say({ name: hall, line }))
    const ok = r.ok && existsSync(viteBin(dir))
    steps.push(
      ok
        ? { state: 'done', line: '패키지를 설치했습니다.' }
        : r.ok
          ? { state: 'fail', line: '설치는 끝났는데 vite 가 없습니다.' }
          : { state: 'fail', line: '패키지를 설치하지 못했습니다.', detail: r.why }
    )
    if (!ok) return [...steps, { state: 'hold', line: '패키지가 없어 연결하지 않았습니다.' }]
  }
  if (!cliOk) return [...steps, { state: 'hold', line: 'sparkon_cli 를 준비하지 못해 연결하지 않았습니다.' }]
  if (hallLinked(work, hall)) return [...steps, { state: 'skip', line: '이미 연결되어 있습니다.' }]
  return [...steps, await link(work, hall, say, () => hallLinked(work, hall))]
}

/**
 * 받아 둔 저장소에 할 일 전부. `halls` 는 받아 둔 호 이름, `follow` 는 원격 브랜치를 따라가기로 확인한 저장소 이름.
 * 저장소마다 결과 한 줄 — 실패해도 다음 저장소로 간다. 두 번 돌지 않게 막는 것은 부르는 쪽(`setup.ts`)이다
 */
export async function prepareWork(work: string, halls: string[], branch: string, follow: string[], say: Say): Promise<SetupRepoDone[]> {
  // 저장소 하나가 끝나면 진행 줄도 그 끝으로 — 안 그러면 마지막 줄이 도구가 낸 글(도움말 끝 줄 같은 것)로 남는다
  const ended = (name: string, steps: SetupStep[]): SetupStep[] => {
    const last = steps[steps.length - 1]
    say({ name, line: last ? last.line : '할 일이 없습니다.' })
    return steps
  }
  say({ name: CLI_DIR, line: 'sparkon 명령을 준비합니다.' })
  const cliSteps = await prepareCli(work, (line) => say({ name: CLI_DIR, line }))
  const cliOk = cliSteps.every((s) => s.state !== 'fail')
  if (cliOk) say({ name: CLI_DIR, line: 'sparkon 명령을 준비했습니다.' })
  else ended(CLI_DIR, cliSteps)
  const out = [repoDone(CLI_DIR, cliSteps)]

  say({ name: 'sparkon_common', line: '브랜치를 맞춥니다.' })
  out.push(repoDone('sparkon_common', ended('sparkon_common', [await applyBranch(work, 'sparkon_common', branch, follow.includes('sparkon_common'))])))

  // M 번호 차례 — 공통 node_modules 가 마지막 호를 가리키므로 가장 큰 호가 끝이다
  const order = [...halls].sort()
  const steps: Record<string, SetupStep[]> = {}
  for (const hall of order) {
    say({ name: hall, line: '브랜치를 맞춥니다.' })
    steps[hall] = ended(hall, await prepareHall(work, hall, branch, follow.includes(hall), cliOk, say))
  }
  // 끝에 공통 node_modules 를 준비된 호 가운데 가장 큰 호로 — 이미 그 호면 건드리지 않는다
  const last = order.filter((h) => existsSync(viteBin(join(work, h))) && hallLinked(work, h)).pop()
  if (cliOk && last && !sharedOn(work, last)) {
    const s = await link(work, last, say, () => sharedOn(work, last))
    steps[last]?.push(s.state === 'done' ? { state: 'done', line: '공통 node_modules 를 이 호로 연결했습니다.' } : s)
  }
  for (const hall of order) out.push(repoDone(hall, steps[hall] ?? []))
  return out
}
