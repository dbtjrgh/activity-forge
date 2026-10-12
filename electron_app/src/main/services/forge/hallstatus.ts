/**
 * **호 저장소마다 git 형편** — 커밋 안 한 파일 · 원격보다 앞섬/뒤처짐 · 마지막 커밋 (2026-09-30, 「관리」 화면).
 *
 * 9호 KOL1M08W1S3 을 반영만 하고 커밋을 안 한 채 두었다 — 그런 것이 한눈에 보이게 한다.
 * **받지 않는다(fetch 안 함).** `behind.ts` 와 같은 까닭이다 — 받는 것은 남의 저장소를 바꾸는 일이라 사람이 한다.
 * 그래서 「마지막으로 받은 때 기준」을 같이 싣는다. 저장소마다 따로 실패한다(한 곳이 넘어져도 나머지는 보인다).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { HallRepo, HallStatus } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git, lines } from '../../lib/git'
import { hallDirs, type HallDir } from './hallwalk'
import { loadForge } from './runtime'

const TIMEOUT = 15_000

/** `## main...origin/main [ahead 1, behind 2]` · `## main` (원격 가지 없음) · `## HEAD (no branch)` */
export function parseHead(head: string): Pick<HallRepo, 'branch' | 'ahead' | 'behind'> {
  const m = /^## (.+?)(?:\.\.\.(\S+))?(?: \[(.+)\])?$/.exec(head.trim())
  if (!m) return { branch: null, ahead: null, behind: null }
  const branch = (m[1] as string).startsWith('HEAD') ? null : (m[1] as string).replace(/^No commits yet on /, '')
  if (!m[2]) return { branch, ahead: null, behind: null }
  const count = (word: string): number => Number(new RegExp(`${word} (\\d+)`).exec(m[3] ?? '')?.[1] ?? 0)
  // `[gone]` 은 원격 가지가 지워진 것 — 비교할 것이 없다
  if (m[3] === 'gone') return { branch, ahead: null, behind: null }
  return { branch, ahead: count('ahead'), behind: count('behind') }
}

async function repoOf(hall: HallDir): Promise<HallRepo> {
  const base: HallRepo = {
    name: hall.name,
    month: hall.month,
    branch: null,
    dirty: null,
    ahead: null,
    behind: null,
    last: null,
    synced: null
  }
  try {
    const status = lines(await git(hall.dir, ['status', '--porcelain=v1', '-b'], TIMEOUT))
    const [head, ...files] = status
    const out: HallRepo = {
      ...base,
      ...parseHead(head ?? ''),
      dirty: files.length
    }
    // 시각은 숫자(%ct)로 받는다 — `%cr` 은 git 이 영어로 적는다(「37 seconds ago」). 한국어로는 화면이 그린다
    const log = (await git(hall.dir, ['log', '-1', '--format=%h%x09%ct%x09%s'], TIMEOUT)).trim().split('\t')
    if (log.length >= 3)
      out.last = {
        hash: log[0] as string,
        at: Number(log[1]) * 1000,
        subject: log.slice(2).join('\t')
      }
    // 마지막으로 받은 때 — `FETCH_HEAD` 가 받을 때마다 다시 쓰인다(`@{u}` 의 커밋 시각은 남이 올린 때라 다르다)
    const fetched = join(hall.dir, '.git', 'FETCH_HEAD')
    if (existsSync(fetched)) out.synced = statSync(fetched).mtimeMs
    return out
  } catch (error) {
    return {
      ...base,
      error: /not a git repository/i.test(String(error)) ? 'git 저장소가 아닙니다.' : toMessage(error)
    }
  }
}

export async function hallStatus(): Promise<HallStatus> {
  try {
    const { paths } = await loadForge()
    const halls = hallDirs(paths.workRoot())
    if (!halls.length)
      return {
        repos: [],
        error: `작업 폴더(${paths.workRoot()})에 호 저장소가 없습니다.`
      }
    return { repos: await Promise.all(halls.map(repoOf)) }
  } catch (error) {
    return { repos: [], error: toMessage(error) }
  }
}
