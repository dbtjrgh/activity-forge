import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

/**
 * 개발 중에만 창 아이콘을 파일에서 지정한다.
 * 패키징하면 exe 자체에 아이콘이 박혀 Windows 가 알아서 쓰므로 지정할 필요가 없고,
 * 지정하려면 아이콘 파일을 앱 번들에 따로 넣어야 한다.
 */
export const devIcon = is.dev ? join(__dirname, '../../build/icon.png') : undefined

/**
 * 처음 켰을 때의 창 크기 — **화면에 보이는 자리(작업 영역)에 맞춘다.**
 *
 * 1100×740 으로 고정해 두었더니 리소스 화면이 잘려 나왔다. 걸음·요구 카드·
 * 만들어 본 글이 세로로 길게 이어지는 화면이라 세로가 특히 모자랐다.
 *
 * **작업 영역(`workArea`)을 쓴다** — 화면 전체(`size`)를 쓰면 작업 표시줄 뒤로
 * 창 밑동이 들어가 단추가 가린다. 시작 자리도 그 영역 안에서 가운데로 맞춘다
 * (모니터가 여럿이면 주 모니터의 원점이 0,0 이 아닐 수 있다).
 *
 * **모자랐던 것은 가로다.** 사이드바 220 + 글 칸 900(`.resource`) + 여백이
 * 1100 을 넘어서 리소스 화면 오른쪽이 잘렸다. 세로는 그대로도 괜찮았다
 * (2026-09-16 사용자 확인) — 그래서 가로만 넓히고 세로는 알맞게 둔다.
 *
 * 화면이 작으면 **작업 영역을 넘지 않는다.** 넘기면 창 밑동이 작업 표시줄
 * 뒤로 들어가 단추가 가린다.
 *
 * **가로는 작업 영역의 80% 로 — 1440 보다 좁게는 안 한다** (2026-09-30). 2560 화면에서 1440 은
 * 절반을 조금 넘어 작업대 세 칸이 좁았다(사용자 말 — 「양산할 때 너무 창이 좁은데」).
 * 최대화는 부담스럽다고 해서 안 한다 — 옆에 다른 창을 둘 자리를 남긴다.
 */
const WIDE = 1440
const WIDE_SHARE = 0.8
const TALL = 960

function firstSize(): { x: number; y: number; width: number; height: number } {
  const { workArea } = screen.getPrimaryDisplay()
  const width = Math.min(Math.max(WIDE, Math.round(workArea.width * WIDE_SHARE)), workArea.width)
  const height = Math.min(TALL, workArea.height)
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height
  }
}

export function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    ...firstSize(),
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    title: '스파크온 매니지먼트',
    icon: devIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 개발 중에는 렌더러 콘솔 출력을 터미널로 전달
  if (is.dev) {
    mainWindow.webContents.on('console-message', (event) => {
      console.log(`[renderer:${event.level}] ${event.message}`)
    })
  }

  // 앱 안에서 새 창을 띄우지 않고 외부 링크는 기본 브라우저로 넘긴다.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 개발 시에는 Vite dev server, 프로덕션에서는 빌드된 HTML 로드
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
