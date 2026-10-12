/**
 * **이어 가는 대화로 `claude` 를 부른다** (2026-10-08, 대화로 만들기 — `chat.ts`).
 *
 * `ai.ts` 는 한 번 묻고 끝나는 부름이다. 여기는 **한 학습코드를 만드는 대화 하나**를 맡는다 —
 * 첫 부름이 `session_id` 를 주고, 사람이 답하면 `--resume <id>` 로 같은 대화를 잇는다(맥락이 남는다, 시험으로 확인).
 * claude 를 부르는 자리는 `ai.ts` 와 이 파일 둘뿐이다.
 *
 * **울타리** — 시험(haiku, 2026-10-08)으로 확인한 것만 믿는다.
 * - 작업 폴더(`cwd`)는 그 학습코드의 호 저장소 폴더다. `Edit(./**)` · `Write(./**)` 만 허락하면 **쓰기는 그 안에서만** 되고,
 *   밖에 쓰려 하면 도구 단계에서 거부된다(`permission_denials`)
 * - `--add-dir` 로 연 폴더(리소스 · 원본 · 모듈 · 스펙)는 **읽기만** 된다
 * - **셸은 안 연다.** 읽기 전용 셸(`git status`)은 허락 없이도 돌았다 — 파일 복사 · git · 검사는 앱이 한다
 *
 * **진행을 한 줄씩 받는다** — `--output-format stream-json` 은 도구를 쓸 때마다 한 줄이 온다. 그것을 사람 말로 바꿔 넘긴다.
 * **멈추기** — Windows 는 셸(cmd) 아래에 claude 가 뜨므로 자식만 죽이면 안 죽는다(함정). `taskkill /T` 로 나무째 내린다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { toMessage } from '../../lib/errors'
import { CLAUDE_LOGIN_NOTE, saysLogin } from './ai'
import { noteLimit } from './aitally'
import { base, lineOf, sessionArgs, usageOf, type StreamMsg } from './aisessionio'

/** 한 번 부르는 상한 — 그림 수십 장과 기획서를 열고 파일 셋을 쓴다. 넉넉히 */
const TURN_TIMEOUT = 40 * 60 * 1000

export type SessionTurn = {
  ok: boolean
  sessionId: string | null
  /** 그 차례의 마지막 답 글 */
  text: string
  error: string
  took: number
  cost?: number
  usage?: { input: number; cacheWrite: number; cacheRead: number; output: number }
  /** 울타리 밖이라 거부된 것 — 사람에게 보인다 */
  denied: string[]
}

export type SessionAsk = {
  prompt: string
  /** 쓰기를 허락할 폴더 — 곧 작업 폴더 */
  cwd: string
  /** 읽기만 할 폴더 */
  readDirs: string[]
  resume?: string | null
  onLine: (line: string) => void
  /** 대화 id 를 처음 받았을 때 — 차례가 끝나기 전에 남겨 두면 도중에 앱을 껐다 켜도 이어 갈 수 있다 */
  onSession?: (id: string) => void
}

const running = new Map<string, ChildProcess>()

/**
 * 한 차례 부른다. `key` 로 멈출 수 있다(학습코드).
 * 차례 줄의 금액 상한(`capSays`)은 안 본다 — 그 상한은 차례 줄이 그때 돌리는 학습코드 것이다. 대화 값은 대화가 따로 든다
 */
export function sessionTurn(key: string, ask: SessionAsk): Promise<SessionTurn> {
  const at = Date.now()
  return new Promise<SessionTurn>((done) => {
    let child: ChildProcess
    try {
      child = spawn('claude', sessionArgs(ask.readDirs, ask.resume), { cwd: ask.cwd, windowsHide: true, shell: process.platform === 'win32' })
    } catch (error) {
      done({ ok: false, sessionId: null, text: '', error: toMessage(error), took: 0, denied: [] })
      return
    }
    running.set(key, child)
    let sessionId: string | null = ask.resume ?? null
    let last: StreamMsg | null = null
    let lastText = ''
    let buf = ''
    let err = ''
    // 시간 초과는 사람이 멈춘 것과 다른 글로 — 같은 「멈췄습니다.」로 남기면 사람은 자기가 누른 줄 안다
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      stopSession(key)
    }, TURN_TIMEOUT)
    const take = (raw: string): void => {
      let m: StreamMsg
      try {
        m = JSON.parse(raw) as StreamMsg
      } catch {
        return
      }
      if (m.session_id && m.session_id !== sessionId) {
        sessionId = m.session_id
        ask.onSession?.(m.session_id)
      }
      if (m.type === 'result') last = m
      if (m.type === 'assistant') {
        for (const c of m.message?.content ?? []) {
          if (c.type === 'tool_use' && c.name) ask.onLine(lineOf(c.name, c.input ?? {}))
          if (c.type === 'text' && c.text?.trim()) {
            lastText = c.text
            ask.onLine(c.text.trim().split('\n')[0]?.slice(0, 160) ?? '')
          }
        }
      }
    }
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      buf += chunk
      let at2 = buf.indexOf('\n')
      while (at2 >= 0) {
        const one = buf.slice(0, at2).trim()
        buf = buf.slice(at2 + 1)
        if (one) take(one)
        at2 = buf.indexOf('\n')
      }
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      if (err.length < 4000) err += chunk
    })
    child.on('error', (e) => {
      err += toMessage(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      running.delete(key)
      if (buf.trim()) take(buf.trim())
      const r = last as StreamMsg | null
      const took = Date.now() - at
      const usage = usageOf(r)
      // 쓰기가 막힌 것만 사람에게 — 읽기 도구가 안 연 폴더를 찾다 막힌 것(Grep)은 그 자리에서 돌아가므로 알릴 까닭이 없다(2026-10-08 첫 판)
      const denied = (r?.permission_denials ?? [])
        .filter((d) => /^(Edit|Write)$/.test(d.tool_name ?? ''))
        .map((d) => `${d.tool_name ?? ''} ${base(d.tool_input?.['file_path'])}`.trim())
      const text = typeof r?.result === 'string' && r.result.trim() ? r.result : lastText
      const said = `${text}\n${err}`
      const error = !r
        ? saysLogin(said)
          ? CLAUDE_LOGIN_NOTE
          : /ENOENT|not recognized|찾을 수 없습니다/i.test(err)
            ? 'claude 명령을 찾지 못했습니다. Claude Code 가 설치되어 있는지 확인하세요.'
            : timedOut
              ? `AI 가 ${TURN_TIMEOUT / 60000}분 안에 끝내지 못해 중단했습니다. 답을 보내면 같은 대화로 이어 갑니다.`
              : code === null || stopped.has(key)
                ? '멈췄습니다.'
                : `AI 를 호출하지 못했습니다: ${err.trim().slice(0, 300) || `종료 코드 ${code}`}`
        : r.is_error
          ? saysLogin(said)
            ? CLAUDE_LOGIN_NOTE
            : `AI 가 오류로 끝났습니다: ${text.slice(0, 300)}`
          : ''
      stopped.delete(key)
      const turn: SessionTurn = { ok: !error, sessionId, text, error, took, cost: r?.total_cost_usd, usage, denied }
      noteLimit(turn.error)
      done(turn)
    })
    try {
      child.stdin?.end(ask.prompt, 'utf8')
    } catch {
      // 닫혔으면 close 가 까닭을 들고 온다
    }
  })
}

const stopped = new Set<string>()

/** 도는 차례를 나무째 내린다. 안 돌면 false */
export function stopSession(key: string): boolean {
  const child = running.get(key)
  if (!child || child.pid === undefined) return false
  stopped.add(key)
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
  else child.kill()
  return true
}

export const sessionRunning = (key: string): boolean => running.has(key)

/** 앱이 꺼질 때 — 셸(cmd) 아래에 뜬 claude 는 Electron 과 같이 안 죽는다(함정). 남으면 값이 계속 나간다 */
export function stopAllSessions(): void {
  for (const key of [...running.keys()]) stopSession(key)
}
