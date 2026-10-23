/**
 * 만든 것을 브라우저로 띄운다 (4단계).
 *
 * `tsc` 와 `check:repro` 를 둘 다 통과하고도 8호 결함 둘이 살아 있었습니다.
 * **띄워 보지 않으면 양산이 끝난 것이 아닙니다** (`_document/양산계획.md` 4단계).
 * 지금은 사람이 `sparkon link M07` 을 치고 주소를 손으로 적습니다.
 *
 * 하는 일은 셋입니다 —
 *   ① 정션이 제대로 걸려 있나 보고, 아니면 **칠 명령을 알려 준다**
 *   ② 호 저장소에서 vite 를 띄우고 **실제로 잡힌 포트를 읽어 낸다**
 *   ③ `localhost:<포트>/<학습코드>/` 를 연다 (여는 것은 ipc 층의 몫)
 *
 * **정션은 사람이 「연결」을 누를 때만 건다** (2026-09-29, `link.ts`). `sparkon_common/node_modules` 가
 * **호 하나만 가리키는 전역 상태**라 다시 거는 순간 다른 호의 미리보기가 바뀝니다 — 그래서 저절로는 안 겁니다.
 *
 * ① 은 `viewcheck.ts` 에 있습니다.
 */

import type { ChildProcess } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { VIEW_EXITED, type Server } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { writeDevConfig } from './devconfig'
import { mark } from './measure'
import { loadForge } from './runtime'
import { noVite, plain, portIn, READY_TIMEOUT, spawnVite, viteBin, waitVitePort } from './vitespawn'
import { viewCheck } from './viewcheck'

// vite 가 뜨기를 `READY_TIMEOUT`(`vitespawn.ts`)만큼 기다린다. 넘으면 죽이고 로그를 보여 준다.

/** 앱 자신의 dev 서버(5173~)와 안 부딪히게 멀찍이 잡는다. 막혀 있으면 vite 가 올린다. */
const PORT_FROM = 5300

/** 로그는 뒤에서 이만큼만 들고 있는다. 다 쌓으면 IPC 로 보낼 때 무거워진다. */
const LOG_CAP = 200

// ─── dev 서버 ──────────────────────────────────────────────────────────
//
// **한 번에 하나만 띄운다.** 호마다 띄우면 포트도 메모리도 쌓이고, 어느 창이
// 어느 호인지 사람이 못 짚는다. 다른 호를 부르면 앞의 것을 먼저 내린다.

let child: ChildProcess | null = null
/** 지금 서버를 띄운 때 — 그 뒤에 생긴 액티비티 폴더는 이 서버의 길 목록에 없다 */
let startedAt = 0

/**
 * **떠 있는 서버가 이 학습코드를 모르나** (M6). 호 저장소의 `vite-plugin-spark` 는 서버가 뜰 때 한 번만
 * 액티비티 폴더를 훑어 길(`/<학습코드>/`)을 만든다(`index.ts:53-62` `history({ rewrites })`). 그 뒤에 쓴 폴더는
 * 떠 있는 서버에서 404 다 — 새로 쓴 것을 띄우는 것이 이 일의 뜻인데 바로 그 경우에 안 뜬다.
 */
export function routeStale(repo: string, code: string, since: number): boolean {
  try {
    return statSync(join(repo, 'src', 'activity', code)).birthtimeMs > since
  } catch {
    return false
  }
}
let state: Server = { running: false, port: null, url: '', repo: '', log: [] }

export function serverState(): Server {
  return { ...state, log: [...state.log] }
}

export function stopServer(): Server {
  if (child) {
    // 자식(esbuild 등)까지 함께 내려가야 포트가 풀린다.
    child.kill()
    child = null
  }
  state = { running: false, port: null, url: '', repo: '', log: state.log }
  return serverState()
}

export async function startServer(
  code: string,
  onLog: (line: string) => void,
  /** 사람이 누른 것인가. 6단계가 대신 부를 때는 false 다 (`measure.ts`) */
  byHand = true
): Promise<Server> {
  // **한 판의 마지막 손길** (1단계 시험대). 6단계가 이것까지 저절로 잇는
  // 자리라, 대신 부른 것은 안 센다 — 줄이려고 만든 것이 숫자를 늘리면 안 된다.
  if (byHand) {
    try {
      const forge = await loadForge()
      mark(forge.paths.REPO_ROOT, code, '띄우기')
    } catch {
      // 못 적어도 띄우는 것은 그대로 한다.
    }
  }

  const check = await viewCheck(code)
  if (check.blocked) return { ...serverState(), error: check.blocked }

  const url = (port: number): string => `http://localhost:${port}/${code}/`

  // 같은 호가 이미 떠 있으면 그대로 쓴다. 다시 띄울 까닭이 없다.
  // **그 뒤에 쓴 폴더면 다시 띄운다** — 떠 있는 서버는 그 길을 모른다(`routeStale`)
  if (state.running && state.repo === check.repo && state.port && !routeStale(check.repo, code, startedAt)) {
    return { ...serverState(), url: url(state.port) }
  }
  if (state.running) stopServer()

  if (!existsSync(viteBin(check.repo))) return { ...serverState(), error: noVite(check.repo) }

  state = { running: true, port: null, url: '', repo: check.repo, log: [] }
  const push = (line: string): void => {
    for (const one of line.split(/\r?\n/)) {
      const text = plain(one).trimEnd()
      if (!text.trim()) continue
      state.log.push(text)
      if (state.log.length > LOG_CAP) state.log.shift()
      onLog(text)
    }
  }

  // 앱의 node 로 띄운다(`vitespawn.ts`).
  // **앱이 띄운 서버에만 덧config 를 끼운다** — 안내 영상이 없을 때 건너뛰게
  // 하는 글 한 줄이다. 공용 코드를 안 고치고, 사람이 손으로 `yarn dev` 를
  // 돌릴 때는 안 끼므로 평소 개발은 그대로다 (`devconfig.ts`).
  // **못 만들어도 서버는 띄운다** — 편의 때문에 띄우기 자체가 막히면 안 된다.
  const args = ['--port', String(PORT_FROM)]
  try {
    args.push('--config', writeDevConfig(check.repo))
  } catch (error) {
    push(`추가 설정 없이 서버를 엽니다: ${toMessage(error)}`)
  }

  startedAt = Date.now()
  child = spawnVite(check.repo, args)
  const mine = child

  // 뜬 뒤에도 듣는다 — 오류는 로그에 남기고 내리며, 끝나면 화면에 알린다. 뜨기를 기다리는 셈(상한 · 처음 것 하나)은 `waitVitePort` 다
  mine.on('error', (error) => {
    push(toMessage(error))
    stopServer()
  })
  mine.on('exit', (codeOut) => {
    // 내가 내린 앞 서버의 끝은 안 알린다 — 알리면 새로 뜬 서버의 화면이 꺼진 줄 안다
    if (child === mine) {
      child = null
      state = { ...state, running: false, port: null }
      push(`${VIEW_EXITED}(코드 ${codeOut}).`)
    }
  })

  // 출력은 뜬 뒤에도 끝까지 로그로 간다
  const look = (text: string): number | null => {
    push(text)
    // vite 가 실제로 잡은 포트를 읽는다 — 5300 이 막혀 있으면 올려 잡는다.
    const at = portIn(text)
    if (!at || state.port) return null
    state.port = at
    state.url = url(state.port)
    return at
  }
  const ready = await waitVitePort(mine, READY_TIMEOUT, look)
  if ('port' in ready) return { ...serverState(), port: state.port, url: state.url }
  if (ready.why === 'timeout') {
    push(`${READY_TIMEOUT / 1000}초 안에 서버가 열리지 않아 중지합니다.`)
    stopServer()
    return { ...serverState(), error: '서버가 열리지 않았습니다. 아래 로그를 확인하세요.' }
  }
  if (ready.why === 'error') return { ...serverState(), error: `서버를 열지 못했습니다: ${ready.detail}` }
  return { ...serverState(), error: `서버가 시작 직후 종료되었습니다(코드 ${ready.code}). 아래 로그를 확인하세요.` }
}
