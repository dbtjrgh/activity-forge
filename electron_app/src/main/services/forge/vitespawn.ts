/**
 * **호 저장소의 vite 를 띄우는 손** — 미리보기(`view.ts`)와 회귀 검사(`regressserve.ts`)가 같이 쓴다 (2026-10-15 에 `view.ts` 에서 뗌).
 *
 * - **`process.execPath` 를 node 로 쓴다.** `ELECTRON_RUN_AS_NODE=1` 이면 Electron 바이너리가 node 로 동작한다 —
 *   PATH 에 node 가 있는지에 기대지 않으려는 것이다(패키징한 exe 에는 없을 수 있다)
 * - vite 가 실제로 잡은 포트는 그 출력의 `localhost:<포트>` 에서 읽는다 — 정한 포트가 막혀 있으면 vite 가 올려 잡는다.
 *   색 글자를 먼저 걷는다(색 코드가 「localhost:」와 숫자 사이에 끼면 못 읽는다)
 * - 뜨기를 기다리는 셈(상한 · 포트 읽기 · 오류 · 끝남)도 여기 하나다(`waitVitePort`) — 두 벌일 때 한쪽만 고쳐졌다.
 *   **로그 · 상태 바꾸기 · 내리기는 부르는 쪽 몫이다** — 미리보기는 뜬 뒤에도 출력을 로그로 남기고, 회귀 검사는 끝 몇 줄만 든다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { toMessage } from '../../lib/errors'

/** vite 가 뜨기를 이만큼 기다린다 */
export const READY_TIMEOUT = 60_000

export const viteBin = (repo: string): string => join(repo, 'node_modules', 'vite', 'bin', 'vite.js')

/** vite 가 없을 때 알리는 글 — 미리보기와 회귀 검사가 같은 글을 쓴다 */
export const noVite = (repo: string): string => `호 폴더에 vite 가 없습니다. ${repo} 에서 yarn 을 먼저 실행하세요.`

/** 색 글자 걷기 */
export const plain = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, '')

/** vite 출력에서 잡은 포트 — 없으면 null */
export function portIn(text: string): number | null {
  const at = /localhost:(\d+)/.exec(plain(text))
  return at ? Number(at[1]) : null
}

/** 호 저장소에서 vite 를 띄운다 — `args` 는 vite 인자(포트 · config) */
export function spawnVite(repo: string, args: string[]): ChildProcess {
  return spawn(process.execPath, [viteBin(repo), ...args], {
    cwd: repo,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', FORCE_COLOR: '0' },
    windowsHide: true
  })
}

/** 뜨기를 기다린 결과 — 잡은 포트, 아니면 상한(`timeout`) · 못 띄움(`error`, 까닭) · 끝남(`exit`, 코드) */
export type ViteReady = { port: number } | { why: 'timeout' } | { why: 'error'; detail: string } | { why: 'exit'; code: number | null }

/**
 * 띄운 vite 가 포트를 잡기를 `ms` 까지 기다린다. 출력 조각은 **뜬 뒤에도 끝까지** `look` 에 넘기고(미리보기는 로그로 남긴다),
 * `look` 이 포트를 돌려주면 뜬 것이다(대개 `portIn`). 처음 온 것 하나로 정한다 — 그 뒤의 오류 · 끝남은 부르는 쪽이 따로 듣는다
 */
export function waitVitePort(child: ChildProcess, ms: number, look: (text: string) => number | null): Promise<ViteReady> {
  return new Promise((done) => {
    let settled = false
    const finish = (r: ViteReady): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      done(r)
    }
    const timer = setTimeout(() => finish({ why: 'timeout' }), ms)
    const onData = (chunk: Buffer): void => {
      const port = look(chunk.toString())
      if (port) finish({ port })
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('error', (e) => finish({ why: 'error', detail: toMessage(e) }))
    child.on('exit', (code) => finish({ why: 'exit', code }))
  })
}
