/**
 * **앱 새 버전 받기** (2026-10-01 사용자 요청 — 「앱 화면이나 기능이 바뀌어도 다 바뀌도록」).
 *
 * 실행 파일에 묶인 앱 코드는 git pull 로 안 바뀐다. 그래서 빌드한 앱(`out/` — main · preload · renderer)을
 * 같은 원격의 **`app-dist` 가지에 커밋 하나로** 올려 두고(`scripts/release-app.mjs`), 여기서 그것을 받아
 * `userData/app/<커밋>/` 에 풀어 둔다. 다음에 켤 때 입구(`main/boot.ts`)가 더 새것을 연다.
 * - **git 하나로 받는다** — 사람 PC 에 이미 로그인된 길이 git 뿐이다. 새 서버를 두지 않는다
 * - `app-dist` 는 커밋 하나짜리 가지라(올릴 때마다 덮는다) 받는 양이 앱 하나 크기다
 * - 새것인가는 **빌드 시각**으로 가린다 — 실행 파일을 더 새것으로 받은 사람이 옛 버전으로 내려가지 않는다
 * - 소스로 띄운 앱(dev)은 이 길을 안 탄다 — 받은 코드를 감시 모드가 다시 빌드한다(`refresh.ts`)
 * Electron 을 import 하지 않는다. 다시 켜는 것은 IPC 층이 한다.
 */

import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppStamp } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git } from '../../lib/git'
import { toTrash } from '../../lib/trash'

/** 빌드할 때 박힌 이 앱의 판(`electron.vite.config.ts`) */
// define 이 객체 그대로 박는다(글이 아니다 — JSON.parse 하면 켜자마자 죽는다)
declare const __APP_STAMP__: AppStamp
export const RUNNING: AppStamp = __APP_STAMP__

export const APP_BRANCH = 'app-dist'
const APP_REF = `refs/remotes/origin/${APP_BRANCH}`
const ASK_TIMEOUT = 10_000
const FETCH_TIMEOUT = 120_000
/** 받아 둔 판을 몇 개까지 남기나 — 지금 것과 그 앞 것 */
const KEEP = 2

let store = ''
let packaged = false

/** 앱 시작 때 한 번 — 받아 둔 앱을 둘 자리(`userData/app`)와 실행 파일로 떴는지 */
export function configureAppUpdate(userDataDir: string, isPackaged: boolean): void {
  store = join(userDataDir, 'app')
  packaged = isPackaged
}

/** 실행 파일로 떴을 때만 앱을 받는다 */
export function appUpdates(): boolean {
  return packaged && store !== ''
}

/** 원격 가지가 가리키는 커밋 — 망을 한 번만 탄다(`ls-remote`). 못 물으면 던진다 */
export async function remoteHeads(repo: string, branch: string): Promise<{ main: string; app: string }> {
  const out = await git(repo, ['ls-remote', 'origin', `refs/heads/${branch}`, `refs/heads/${APP_BRANCH}`], ASK_TIMEOUT * 3)
  const of = (ref: string): string => out.split(/\r?\n/).find((l) => l.endsWith(`\trefs/heads/${ref}`))?.split('\t')[0] ?? ''
  return { main: of(branch), app: of(APP_BRANCH) }
}

/** 마지막으로 견준 app-dist 커밋과 그 답 — 같은 커밋이면 다시 받지 않는다 */
let seen: { sha: string; stamp: AppStamp | null } = { sha: '', stamp: null }

/** 원격 app-dist 가 이 앱보다 새것이면 그 판 — 아니면 null. 커밋이 바뀌었을 때만 받는다 */
export async function appCheck(repo: string, remoteSha: string): Promise<AppStamp | null> {
  if (!appUpdates() || !remoteSha) return null
  if (seen.sha !== remoteSha) {
    await git(repo, ['fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${APP_BRANCH}:${APP_REF}`], FETCH_TIMEOUT)
    const text = await git(repo, ['show', `${APP_REF}:main/version.json`], ASK_TIMEOUT)
    seen = { sha: remoteSha, stamp: JSON.parse(text) as AppStamp }
  }
  const stamp = seen.stamp
  // 빌드 시각만 본다 — 같은 커밋을 다시 빌드해 올려도(고친 것을 더해) 새 버전이다
  return stamp && stamp.builtAt > RUNNING.builtAt ? stamp : null
}

/**
 * 받아 둔 app-dist 를 `userData/app/<커밋>` 에 푼다 — 다 푼 뒤에 이름을 바꿔서, 반쯤 푼 것을 입구가 열지 않게 한다.
 * 저장소의 index 는 건드리지 않는다(따로 둔 index 파일로 푼다). 풀었으면 참
 */
export async function installApp(repo: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const sha = (await git(repo, ['rev-parse', APP_REF], ASK_TIMEOUT)).trim()
    const dir = join(store, sha.slice(0, 12))
    if (!existsSync(join(dir, 'main', 'index.js'))) {
      mkdirSync(store, { recursive: true })
      const part = `${dir}.part`
      rmSync(part, { recursive: true, force: true })
      const index = { GIT_INDEX_FILE: join(store, 'index.tmp') }
      await git(repo, ['read-tree', sha], ASK_TIMEOUT, index)
      await git(repo, ['checkout-index', '-a', '-f', `--prefix=${part.replace(/\\/g, '/')}/`], FETCH_TIMEOUT, index)
      rmSync(index.GIT_INDEX_FILE, { force: true })
      if (!existsSync(join(part, 'main', 'index.js')) || !existsSync(join(part, 'main', 'version.json'))) {
        return { ok: false, error: '받은 앱 새 버전에 필요한 파일이 없습니다.' }
      }
      renameSync(part, dir)
    }
    writeFileSync(join(store, 'current.json'), JSON.stringify({ dir, sha }, null, 2))
    await prune(dir)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: `앱 새 버전을 받지 못했습니다: ${toMessage(error)}` }
  }
}

/** 오래된 판은 휴지통으로 — 지금 것과 그 앞 것만 남긴다 */
async function prune(keep: string): Promise<void> {
  const dirs = readdirSync(store, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.endsWith('.part'))
    .map((d) => join(store, d.name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  const old = dirs.filter((d) => d !== keep).slice(KEEP - 1)
  for (const d of old) await toTrash(d).catch(() => undefined)
}
