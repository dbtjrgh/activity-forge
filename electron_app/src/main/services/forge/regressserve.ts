/**
 * **회귀 검사가 호마다 따로 띄우는 vite** (2026-10-15). 사람의 미리보기 서버(`view.ts`, 5300~)는 건드리지 않는다.
 *
 * - **포트가 다르다**(5450~). 막혀 있으면 vite 가 올려 잡고, 실제 포트는 출력에서 읽는다(`vitespawn.ts`)
 * - **덧config 자리가 다르다** — 미리보기 덧config(`devconfig.ts`)를 다시 쓰면 그 config 를 보던 사람의 vite 가 다시 뜬다.
 *   호마다 `회귀 검사 임시 폴더/vite.<M 번호>.mts` 에 쓴다
 * - **의존성 캐시도 따로**(`cacheDir`) — 호 저장소의 `node_modules/.vite` 를 사람의 서버와 같이 쓰면 한쪽이 다시 묶는 동안 다른 쪽이 깨진다
 * - **전역 정션을 안 따른다** — 호 package.json 의 의존성을 전부 `resolve.dedupe` 에 넣어 늘 그 호 것으로 푼다(`hallDeps`, 미리보기도 같다)
 * - 안내 영상이 없으면 「다 봤다」로 보내는 글은 미리보기와 같은 것(`GUIDE_SKIP_PLUGIN`)을 끼운다
 * - 파일 감시(`watch: null`)와 HMR 을 끈다 — 돌리는 동안 바뀔 것이 없고, 쓰는 중인 파일에 서버째 죽는 길(함정)도 막는다
 * - 호 저장소의 정션 셋(`hallLinks`)이 없으면 띄우지 않는다 — **만들지 않는다**(전역 상태라 사람이 건다)
 * - vite 는 config 를 `<config>.timestamp-*.mjs` 로 묶어 읽고 다 읽으면 지운다 — 읽는 도중에 내리면(상한 · 다시 띄우기) 남는다.
 *   새 config 를 쓰기 전에 그 호의 남은 것을 지운다(`sweepStamps`)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { toMessage } from '../../lib/errors'
import { baseImport, GUIDE_SKIP_PLUGIN, hallDeps } from './devconfig'
import { hallLinks } from './viewcheck'
import { noVite, plain, portIn, READY_TIMEOUT, spawnVite, viteBin, waitVitePort } from './vitespawn'

const PORT_FROM = 5450
const TAIL = 8

export type RegressServer = { port: number; child: ChildProcess }

/** 회귀 검사가 쓰는 임시 폴더 — 덧config · 의존성 캐시 */
export const regressTmp = (): string => join(tmpdir(), 'sparkon-forge', 'regress')

/** 띄우지 못할 까닭 — 비면 띄울 수 있다 */
export function serveBlocked(repo: string): string {
  if (!existsSync(repo)) return `호 폴더가 없습니다: ${repo}`
  const broken = hallLinks(repo).filter((l) => !l.ok)
  if (broken.length) return `연결(정션)이 없어 이 호는 건너뜁니다(${broken.map((l) => l.name).join(', ')}).`
  if (!existsSync(viteBin(repo))) return noVite(repo)
  return ''
}

/**
 * 읽는 도중에 내린 vite 가 남긴 config 묶음(`vite.<호>.mts.timestamp-*.mjs`)을 지운다.
 * 이 앱이 만든 임시 폴더 안의 것이라 휴지통을 거치지 않는다(`appupdate.ts` 의 `.part` 와 같다).
 * 막 읽는 중인 것은 건드리지 않게 뜨기 상한보다 오래된 것만 — 그보다 오래 걸리는 vite 는 이미 내렸다
 */
function sweepStamps(dir: string, month: string): void {
  const head = `vite.${month}.mts.timestamp-`
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(head) || !name.endsWith('.mjs')) continue
    const at = join(dir, name)
    try {
      if (Date.now() - statSync(at).mtimeMs > READY_TIMEOUT) rmSync(at, { force: true })
    } catch {
      // 못 지워도 띄우기는 그대로 한다 — 작은 임시 파일이다
    }
  }
}

function writeConfig(repo: string, month: string): string {
  const deps = hallDeps(repo)
  const dir = regressTmp()
  mkdirSync(dir, { recursive: true })
  sweepStamps(dir, month)
  const text = `${baseImport(repo)}

${GUIDE_SKIP_PLUGIN}

// 양산기 회귀 검사가 띄운 서버에만 끼는 config — 호 저장소에는 안 남긴다
export default {
  ...base,
  clearScreen: false,
  cacheDir: ${JSON.stringify(join(dir, `cache-${month}`).replace(/\\/g, '/'))},
  resolve: { ...(base.resolve ?? {}), dedupe: ${JSON.stringify(deps)} },
  server: { ...(base.server ?? {}), watch: null, hmr: false },
  plugins: [...(base.plugins ?? []), guideSkip]
}
`
  const at = join(dir, `vite.${month}.mts`)
  writeFileSync(at, text, 'utf8')
  return at
}

/**
 * 호 하나의 서버를 띄우고 잡은 포트를 기다린다. 실패하면 까닭과 출력 끝 몇 줄.
 * **아무 출력 없이 시간만 넘기면 한 번 더 띄운다** — 2026-10-15 M01 22개를 돌릴 때 m07 서버가 60초 동안 한 줄도 안 냈고, 바로 다시 띄우니 0.5초에 떴다
 */
export async function startRegressServer(repo: string, month: string): Promise<RegressServer | { error: string }> {
  const blocked = serveBlocked(repo)
  if (blocked) return { error: blocked }
  const first = await startOnce(repo, month)
  return 'quiet' in first ? startOnce(repo, month) : first
}

async function startOnce(repo: string, month: string): Promise<RegressServer | { error: string; quiet?: true }> {
  let child: ChildProcess
  try {
    child = spawnVite(repo, ['--port', String(PORT_FROM), '--config', writeConfig(repo, month)])
  } catch (error) {
    return { error: `서버를 열지 못했습니다: ${toMessage(error)}` }
  }
  const tail: string[] = []
  const ready = await waitVitePort(child, READY_TIMEOUT, (text) => {
    for (const l of plain(text).split(/\r?\n/).filter((x) => x.trim())) tail.push(l.trim()) > TAIL && tail.shift()
    return portIn(text)
  })
  if ('port' in ready) return { port: ready.port, child }
  child.kill()
  if (ready.why === 'timeout') return { error: `${READY_TIMEOUT / 1000}초 안에 서버가 열리지 않았습니다. ${tail.join(' / ')}`, ...(tail.length ? {} : { quiet: true as const }) }
  if (ready.why === 'error') return { error: `서버를 열지 못했습니다: ${ready.detail}` }
  return { error: `서버가 시작 직후 종료되었습니다(코드 ${ready.code}). ${tail.join(' / ')}` }
}
