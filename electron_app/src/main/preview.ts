import { BrowserWindow } from 'electron'

/**
 * **앱 안 창** (2026-09-29, M6) — 만든 액티비티를 바깥 브라우저 대신 여기서 본다.
 *
 * - **preload 가 없다.** 이 창에 뜨는 것은 호 저장소의 vite 가 내는 남의 코드다 — IPC 를 쥐여 주지 않는다
 * - 처음에는 안쪽 1280×720(16:9)으로 연다. **그 뒤 크기 · 비율은 사람이 정한다** — 처음에는 늘릴 때마다 16:9 로 되돌렸는데
 *   모서리를 대각선으로 끌면 그 맞춤이 끼어들고, 4K 로 크게 보려 해도 막혔다(2026-10-08 사용자 결정 — 「비율 강제로 조정하지마」)
 * - 소리를 누르지 않아도 튼다(`autoplayPolicy`) — 여는 것이 사람 손이라 그 뒤는 막을 까닭이 없다
 * - 한 창만 둔다. 다른 학습코드를 열면 그 창의 주소만 바꾼다
 * - 창 밖으로 나가는 주소(새 창 · 다른 주소로 가기)는 안 연다
 *
 * 「이대로 좋습니다 — 끝」 · 「작업대로」는 이 창이 아니라 작업대에 둔다 — preload 가 없어 단추가 IPC 를 못 부른다.
 * 창 찍기(비교 캔버스 · 좌표 맞추기가 썼다)와 바깥 브라우저로 열기는 2026-10-08 에 이전 방식과 같이 걷었다.
 */
let win: BrowserWindow | null = null

const WIDTH = 1280
const HEIGHT = 720

/**
 * **미리보기 창 콘솔의 오류를 모은다** (2026-09-29). 9호 KOL1M08W1S3 이 검사 · 반영을 다 지나고도 빈 배경에서 멈췄는데,
 * 까닭(「해당 asset[ post ]이 존재하지않습니다」)은 창 콘솔에만 있었다. 사람은 콘솔을 안 연다 — 그래서 작업대에 옮긴다.
 * 새 주소를 열 때마다 비운다. 같은 글은 한 번만, 상한 `ISSUE_MAX`.
 * **무엇을 흠으로 셀지는 회귀 검사 창(`regress.ts`)과 한 거름이다**(`consoleIssue`, 2026-10-15) — 두 벌일 때 회귀 검사는 error 단계만 봐서
 * PixiJS 가 warn 으로 내는 「not found in the Cache」(별칭이 없어 그림이 빔)를 놓쳤다.
 */
/** 모으는 글 수 상한 — 회귀 검사 창도 같은 값을 쓴다 */
export const ISSUE_MAX = 30
const WANT = /존재하지\s*않|not found in the Cache|Failed to load|404|Uncaught|TypeError|ReferenceError/i
let issues: string[] = []
let issueUrl = ''

/** 콘솔 한 줄이 액티비티 흠인가 — 흠이면 공백을 접고 200자로 줄인 글, 아니면 null. error 단계는 다, 그 밖은 `WANT` 에 걸릴 때만 */
export function consoleIssue(level: string, message: unknown): string | null {
  const text = String(message ?? '').trim()
  if (!text || (level !== 'error' && !WANT.test(text))) return null
  // Electron 이 스스로 내는 보안 경고는 액티비티 흠이 아니다
  if (/Electron Security Warning/.test(text)) return null
  return text.replace(/\s+/g, ' ').slice(0, 200)
}

/** 같은 글은 한 번만, `max` 개까지 */
export function keepIssue(list: string[], line: string | null, max: number): void {
  if (line && !list.includes(line) && list.length < max) list.push(line)
}

function listen(one: BrowserWindow): void {
  one.webContents.on('did-start-navigation', (d) => {
    if (d.isMainFrame && !d.isSameDocument) {
      issues = []
      issueUrl = d.url
    }
  })
  one.webContents.on('console-message', (e) => keepIssue(issues, consoleIssue(e.level, e.message), ISSUE_MAX))
}

/** 지금 창에 뜬 주소와 그 주소를 연 뒤 모인 오류. 창이 없으면 빈 것 */
export function previewIssues(): { url: string; issues: string[] } {
  return win && !win.isDestroyed() ? { url: issueUrl, issues: [...issues] } : { url: '', issues: [] }
}

export function openPreview(url: string, title: string): void {
  if (win && !win.isDestroyed()) {
    if (win.webContents.getURL() !== url) void win.loadURL(url)
    win.setTitle(title)
    win.show()
    win.focus()
    return
  }
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    useContentSize: true,
    show: false,
    autoHideMenuBar: true,
    title,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  win.on('ready-to-show', () => win?.show())
  win.on('page-title-updated', (e) => e.preventDefault())
  win.on('closed', () => {
    win = null
  })
  const origin = new URL(url).origin
  listen(win)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e, to) => {
    if (new URL(to).origin !== origin) e.preventDefault()
  })
  void win.loadURL(url)
}
