/**
 * 자식 프로세스 한 번 — **도메인을 모른다.** 시간 상한 · 줄마다 알림 · 끝 몇 줄 · 나무째 내리기.
 *
 * - 실행 파일(node 같은 것)은 **셸 없이** `runProc(file, args)` — 인자가 그대로 간다
 * - `.cmd`(yarn 같은 것)는 셸 없이 못 부른다(Node 20.12 부터 EINVAL). `runLine` 이 **고정된 한 줄**을 `cmd.exe /d /s /c` 에 넘긴다 —
 *   부르는 쪽은 상수만 넘긴다. 사람이 준 글을 넣지 않는다(`shell: true` 는 인자에 따옴표를 안 씌운다 — 함정)
 * - stdin 은 닫는다. 묻는 프로그램이 상한까지 멈춰 있지 않고 바로 끝난다
 * - Windows 는 셸 아래 손자(cmd → yarn → node)가 셸과 같이 안 죽는다(함정). 상한에 걸리거나 앱이 꺼지면 `taskkill /T /F` 로 나무째 내린다
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'

export interface ProcResult {
  /** 끝난 코드 — 상한에 걸려 내렸거나 못 띄웠으면 null */
  code: number | null
  timedOut: boolean
  /** 끝 몇 줄(색 글자는 뺌) — 실패 까닭을 사람이 읽게 */
  tail: string[]
  /** 띄우지도 못했다(ENOENT 같은 것) */
  error?: string
}

export interface ProcOptions {
  cwd: string
  timeout: number
  /** 지금 환경 위에 덧씌울 것 */
  env?: Record<string, string>
  onLine?: (line: string) => void
}

const TAIL = 40
const running = new Set<ChildProcess>()

/** 나무째 내린다 — 이미 끝났으면 아무것도 안 한다 */
export function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
  else child.kill()
}

/** 앱이 꺼질 때 — 여기로 띄운 것이 남아 있으면 전부 내린다 */
export function stopAllProcs(): void {
  for (const child of [...running]) killTree(child)
}

const plain = (text: string): string => text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')

export function runProc(file: string, args: string[], opts: ProcOptions): Promise<ProcResult> {
  return new Promise((resolve) => {
    const tail: string[] = []
    let timedOut = false
    let error: string | undefined
    let child: ChildProcess
    try {
      child = spawn(file, args, {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
    } catch (e) {
      resolve({ code: null, timedOut: false, tail, error: e instanceof Error ? e.message : String(e) })
      return
    }
    running.add(child)
    // 진행 표시는 `\r` 로 한 줄을 고쳐 쓴다 — 그것도 줄로 본다
    const pending: Record<'out' | 'err', string> = { out: '', err: '' }
    const take = (key: 'out' | 'err', chunk: string, flush = false): void => {
      const parts = (pending[key] + chunk).split(/\r\n|\n|\r/)
      pending[key] = flush ? '' : (parts.pop() ?? '')
      for (const raw of parts) {
        const line = plain(raw).trimEnd()
        if (!line.trim()) continue
        tail.push(line)
        if (tail.length > TAIL) tail.shift()
        opts.onLine?.(line)
      }
    }
    child.stdout?.setEncoding('utf8').on('data', (c: string) => take('out', c))
    child.stderr?.setEncoding('utf8').on('data', (c: string) => take('err', c))
    let settled = false
    const finish = (code: number | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      running.delete(child)
      take('out', '', true)
      take('err', '', true)
      resolve({ code: timedOut ? null : code, timedOut, tail, error })
    }
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child)
    }, opts.timeout)
    child.on('error', (e) => {
      error = e.message
      // 못 띄운 것(ENOENT)은 close 가 안 올 수 있다
      if (child.pid === undefined) finish(null)
    })
    child.on('close', (code) => finish(code))
  })
}

/** 고정된 명령 한 줄을 셸로 — `.cmd` 를 부를 때만. **사람이 준 글을 넣지 않는다** */
export function runLine(line: string, opts: ProcOptions): Promise<ProcResult> {
  return process.platform === 'win32' ? runProc('cmd.exe', ['/d', '/s', '/c', line], opts) : runProc('/bin/sh', ['-c', line], opts)
}

/** 실패를 한 줄로 — 상한 · 못 띄움 · 마지막 오류 줄(yarn 은 끝에 「info Visit …」 안내를 붙인다) · 없으면 마지막 줄 */
export function procWhy(r: ProcResult, limitText: string): string {
  if (r.timedOut) return limitText
  if (r.error) return r.error
  const err = [...r.tail].reverse().find((l) => /^\s*(error|fatal|err!)\b/i.test(l))
  return (err ?? r.tail[r.tail.length - 1] ?? `종료 코드 ${r.code}`).trim().slice(0, 300)
}
