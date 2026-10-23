import { BrowserWindow, session, type Session } from 'electron'
import { toMessage } from './lib/errors'
import { consoleIssue, ISSUE_MAX, keepIssue } from './preview'
import { GUIDE_MOVIE } from './services/forge/devconfig'
import { SNAPSHOT } from './services/forge/regresspage'
import type { PageRun, PageSnap } from './services/forge/regress'

/**
 * **회귀 검사의 숨긴 창** (2026-10-15) — 완성본 하나를 띄워 글을 넣고 끝날 때까지 지켜본다. 차례 · 판정은 `services/forge/regress.ts`.
 *
 * 사람이 같은 PC 에서 양산 중이다 —
 * - **창을 보이지 않는다**(`show: false`) · **소리를 창째 끈다**(`setAudioMuted`, 띄우기 전에) · 카메라 · 마이크 같은 권한은 다 거절한다
 * - 세션을 따로 쓴다(`regress`, 메모리에만) — 404 를 듣는 귀(`webRequest`)를 앱의 다른 창에 걸지 않는다
 * - **preload 가 없다** — 호 저장소의 vite 가 내는 남의 코드다(`preview.ts` 와 같다). 새 창 · 다른 주소로 가기는 막는다
 * - 콘솔에서 무엇을 흠으로 셀지는 미리보기 창과 같은 거름이다(`preview.ts` `consoleIssue`) — 안내 영상 줄만 더 뺀다
 *
 * 밟은 것(2026-10-15) —
 * - 숨긴 창은 `backgroundThrottling: false` 여도 rAF 가 초당 1번이다 → 페이지 글보다 먼저 rAF 를 타이머로 바꾼다(`earlyScript`)
 * - 그 글을 넣는 CDP(`webContents.debugger`)는 **빈 페이지를 한 번 연 뒤에** 붙인다 — 아무것도 안 연 창에 붙이면 다음 `loadURL` 이 안 돌아온다
 * - 붙인 뒤에는 `executeJavaScript` 가 안 돌아온다 → 평가도 CDP `Runtime.evaluate` 로 한다
 * - **페이지가 메인 스레드를 붙잡으면(동기 무한 반복) `Runtime.evaluate` 도 안 돌아온다** — 평가마다 상한(`EVAL_LIMIT`)을 두고,
 *   걸리면 렌더러를 내려(`forcefullyCrashRenderer`) 그 학습코드를 「멈춤」으로 적는다. 창 하나 전체에도 상한(`HARD_SLACK`)을 한 번 더 둔다
 */

const WIDTH = 1280
const HEIGHT = 720
const LOAD_TIMEOUT = 60_000
const POLL = 1000
/** 평가 하나가 이만큼 안 돌아오면 페이지가 멈춘 것으로 본다 — 형편 읽기는 한 줄짜리라 보통 몇 ms 다 */
const EVAL_LIMIT = 15_000
/** 창 하나의 마지막 상한 — `limitMs` 를 이만큼 더 넘기면 무엇을 기다리든 끊는다 */
const HARD_SLACK = 30_000

let ses: Session | null = null
/** 창(webContents id)마다 못 받은 리소스 */
const missingOf = new Map<number, string[]>()

/** 주소 안 경로를 사람이 읽게 — `%` 가 홀로 든 이름은 못 풀므로 그대로 둔다(던지면 메인 프로세스 오류 창이 뜬다) */
function pathOf(url: string): string {
  const raw = new URL(url).pathname
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function regressSession(): Session {
  if (ses) return ses
  ses = session.fromPartition('regress')
  ses.setPermissionRequestHandler((_wc, _perm, done) => done(false))
  ses.setPermissionCheckHandler(() => false)
  ses.webRequest.onCompleted((d) => {
    try {
      if (d.statusCode < 400 || d.webContentsId === undefined) return
      const list = missingOf.get(d.webContentsId)
      if (!list || new URL(d.url).hostname !== 'localhost') return
      const path = pathOf(d.url)
      if (path.startsWith(GUIDE_MOVIE)) return
      const line = `${d.statusCode} ${path}`
      if (!list.includes(line) && list.length < ISSUE_MAX) list.push(line)
    } catch {
      // 주소 하나를 못 읽어도 검사는 그대로 간다 — 여기서 던지면 사람 화면에 메인 프로세스 오류 창이 뜬다
    }
  })
  return ses
}

const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms))

/** 페이지가 답하지 않음 — 평가가 상한 안에 안 돌아왔다 */
class Stalled extends Error {}

/** `p` 를 `ms` 까지만 기다린다. 넘으면 `fail()` 로 던진다 */
function within<T>(p: Promise<T>, ms: number, fail: () => Error): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<never>((_ok, no) => {
    timer = setTimeout(() => no(fail()), ms)
  })
  return Promise.race([p, late]).finally(() => clearTimeout(timer))
}

/** 숨긴 창 하나로 주소를 띄우고 글을 넣어 끝날 때까지(또는 `limitMs` 까지) 지켜본다 */
export async function runRegressPage(url: string, early: string, scripts: string[], limitMs: number): Promise<PageRun> {
  const started = Date.now()
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    useContentSize: true,
    show: false,
    webPreferences: {
      session: regressSession(),
      sandbox: true,
      contextIsolation: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  const wc = win.webContents
  const id = wc.id
  wc.setAudioMuted(true)
  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  const origin = new URL(url).origin
  wc.on('will-navigate', (e, to) => {
    if (new URL(to).origin !== origin) e.preventDefault()
  })
  const errors: string[] = []
  const missing: string[] = []
  missingOf.set(id, missing)
  wc.on('console-message', (e) => {
    if (String(e.message ?? '').includes(GUIDE_MOVIE)) return
    keepIssue(errors, consoleIssue(e.level, e.message), ISSUE_MAX)
  })
  let snap: PageSnap | null = null
  let stalled = false
  const result = (error?: string): PageRun => ({
    snap,
    errors,
    missing,
    took: Date.now() - started,
    ...(error ? { error } : {}),
    ...(stalled ? { stalled } : {})
  })

  const watch = async (): Promise<PageRun> => {
    try {
      await wc.loadURL('about:blank')
      const dbg = wc.debugger
      dbg.attach('1.3')
      await dbg.sendCommand('Page.enable')
      await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: early })
      const evaluate = async (expression: string): Promise<unknown> => {
        const r = (await within(
          dbg.sendCommand('Runtime.evaluate', { expression, returnByValue: true }),
          EVAL_LIMIT,
          () => new Stalled(`페이지가 ${EVAL_LIMIT / 1000}초 동안 응답하지 않아 끊었습니다.`)
        )) as {
          result?: { value?: unknown }
          exceptionDetails?: { text?: string; exception?: { description?: string } }
        }
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? '페이지에 넣은 코드가 오류를 냈습니다.')
        return r.result?.value
      }
      await within(wc.loadURL(url), LOAD_TIMEOUT, () => new Error(`${LOAD_TIMEOUT / 1000}초 안에 페이지가 열리지 않았습니다.`))
      for (const s of scripts) await evaluate(s)
      while (Date.now() - started < limitMs) {
        await sleep(POLL)
        const raw = await evaluate(SNAPSHOT)
        snap = typeof raw === 'string' ? (JSON.parse(raw) as PageSnap | null) : null
        if (snap?.done) break
      }
      return result()
    } catch (error) {
      if (error instanceof Stalled) stalled = true
      return result(toMessage(error))
    }
  }

  let hard: NodeJS.Timeout | undefined
  const deadline = new Promise<PageRun>((ok) => {
    hard = setTimeout(() => {
      stalled = true
      ok(result(`${Math.round((limitMs + HARD_SLACK) / 1000)}초가 지나도 끝나지 않아 끊었습니다.`))
    }, limitMs + HARD_SLACK)
  })
  try {
    return await Promise.race([watch(), deadline])
  } finally {
    clearTimeout(hard)
    missingOf.delete(id)
    if (!win.isDestroyed()) {
      // 멈춘 렌더러는 창만 닫으면 남을 수 있다 — 렌더러째 먼저 내린다(세션이 따로라 사람의 창과 렌더러를 같이 쓰지 않는다)
      if (stalled && !wc.isCrashed()) wc.forcefullyCrashRenderer()
      win.destroy()
    }
  }
}
