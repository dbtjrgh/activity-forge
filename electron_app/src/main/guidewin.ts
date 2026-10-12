import { BrowserWindow, screen, type WebContents } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { devIcon } from './window'

/**
 * **받을 리소스 창** (2026-09-30) — figma 옆에 켜 두는 좁은 창. 앞 학습코드가 쓴 리소스를 그림으로 보인다.
 *
 * - 메인 창과 **같은 렌더러 · 같은 preload** 다(`?guide=<코드>` 로 갈린다). 우리 화면이라 IPC 를 막을 까닭이 없다
 * - **메인 창의 자식으로 두지 않는다** — 자식 창은 메인 창을 내리면 같이 내려간다. figma 를 보려고
 *   앱을 내리면 이 창까지 사라진다. 대신 메인 창이 닫힐 때 같이 닫는다(`index.ts`)
 * - 한 창만 둔다. 다른 학습코드를 열면 그 창의 주소만 바꾼다(`preview.ts` 와 같은 꼴)
 * - 자리는 작업 영역의 **오른쪽 끝** — 메인 창(가운데 80%)과 figma 를 덜 가린다
 * - 「항상 위」는 사람이 켠다 — figma 를 누르면 이 창이 뒤로 숨는다
 */
let win: BrowserWindow | null = null

const WIDTH = 480
const TALL_SHARE = 0.9

function place(): { x: number; y: number; width: number; height: number } {
  const { workArea } = screen.getPrimaryDisplay()
  const width = Math.min(WIDTH, workArea.width)
  const height = Math.round(workArea.height * TALL_SHARE)
  return {
    x: workArea.x + workArea.width - width,
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height
  }
}

function load(one: BrowserWindow, code: string): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void one.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?guide=${encodeURIComponent(code)}`)
  } else {
    void one.loadFile(join(__dirname, '../renderer/index.html'), { query: { guide: code } })
  }
}

export function openGuide(code: string): void {
  if (win && !win.isDestroyed()) {
    load(win, code)
    if (win.isMinimized()) win.restore()
    win.focus()
    return
  }
  const one = new BrowserWindow({
    ...place(),
    minWidth: 360,
    minHeight: 400,
    show: false,
    autoHideMenuBar: true,
    title: '받을 리소스',
    icon: devIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  one.on('ready-to-show', () => one.show())
  one.on('closed', () => {
    win = null
  })
  one.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  if (is.dev) {
    one.webContents.on('console-message', (event) => {
      console.log(`[guide:${event.level}] ${event.message}`)
    })
  }
  win = one
  load(one, code)
}

/**
 * 「항상 위」 — **이 창이 부른 것만** 듣는다. 메인 창이 불러도 메인 창을 띄워 두지 않는다.
 * `on` 이 null 이면 묻기만 한다 — 다른 학습코드를 열면 화면은 새로 뜨는데 창은 켜 둔 그대로라 단추가 틀린다
 */
export function setGuideTop(sender: WebContents, on: boolean | null): boolean {
  if (!win || win.isDestroyed() || win.webContents !== sender) return false
  if (on !== null) win.setAlwaysOnTop(on)
  return win.isAlwaysOnTop()
}

export function closeGuide(): void {
  if (win && !win.isDestroyed()) win.close()
}
