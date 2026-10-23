import { join } from 'node:path'
import { app, BrowserWindow, dialog, nativeImage, shell, type MessageBoxOptions } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { configureTrash } from './lib/trash'
import { configureHome } from './services/forge/home'
import { configureResizer } from './services/forge/imgsize'
import { preferBundledPoppler } from './services/forge/poppler'
import { refreshToolPath } from './services/forge/toolpath'
import { configureAppUpdate } from './services/forge/appupdate'
import { configureForge } from './services/forge/runtime'
import { stopServer } from './services/forge/view'
import { stopRegress } from './services/forge/regress'
import { stopAllSessions } from './services/forge/aisession'
import { busyWork } from './services/forge/busy'
import { stopAllProcs } from './lib/proc'
import { closeGuide } from './guidewin'
import { createWindow } from './window'

/**
 * **대화가 도는 중이면 끄기 전에 묻는다** (2026-10-14). 끄면 `will-quit` 이 claude 를 내려(`stopAllSessions`) 그 차례가 버려진다.
 * 창 닫기(X · Alt+F4)는 `close`, 앱 끝내기는 `before-quit` 으로 둘 다 여기 온다. 「끄기」를 고르면 `leaving` 을 켜고 다시 끝내서,
 * 그 뒤에 오는 `before-quit` · `close` 는 다시 묻지 않는다. 묻는 창이 떠 있는 동안 또 누르면 창을 하나 더 띄우지 않는다(`asking`).
 * 동기 대화상자(`showMessageBoxSync`)는 메인 스레드를 붙잡아 도는 대화의 진행 줄까지 멈추므로 쓰지 않는다.
 * 업데이트 뒤 다시 켜기(`app.exit`)는 이 둘을 안 지난다 — 그 길은 `update.ts` · `ipc/forge.ts` 가 따로 막는다
 */
let leaving = false
let asking = false
/** 묻는 창을 띄울 자리 — 미리보기 · 받을 리소스 창이 아니라 메인 창 앞에 */
let mainWin: BrowserWindow | undefined
function holdIfBusy(e: { preventDefault: () => void }, win: BrowserWindow | undefined): void {
  if (leaving) return
  const busy = busyWork()
  if (!busy.length) return
  e.preventDefault()
  if (asking) return
  asking = true
  const opts: MessageBoxOptions = {
    type: 'warning',
    title: '스파크온 매니지먼트',
    message: `하던 일이 있습니다: ${busy.join(', ')}. 그래도 끌까요?`,
    // 하던 일은 위 줄이 이름으로 말한다 — 대화 · 올리기 · 회귀 검사 가운데 무엇이든 맞게 한 문장으로
    detail: '끄면 위 작업이 중간에 멈춥니다.',
    buttons: ['끄기', '취소'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  }
  const shown = win && !win.isDestroyed() ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts)
  void shown
    .then(({ response }) => {
      if (response !== 0) return
      leaving = true
      app.quit()
    })
    .catch(() => undefined)
    .finally(() => {
      asking = false
    })
}

/** 메인 창 — 닫을 때 도는 대화를 묻는다. 받을 리소스 창은 메인 창의 자식이 아니다(`guidewin.ts`) — 메인 창이 닫히면 같이 닫아야 앱이 끝난다 */
function openMain(): BrowserWindow {
  const win = createWindow()
  win.on('close', (e) => holdIfBusy(e, win))
  win.on('closed', closeGuide)
  return win
}

// **한 번만 켠다** (2026-10-01) — 켜 둔 채 바로가기를 또 누르면 두 번째가 9222 · 설정 파일을 두고 부딪혀 오류 창이 떴다.
// 두 번째는 바로 끝내고, 켜 둔 **메인 창**을 앞으로 띄운다 — `getAllWindows()` 의 차례는 정해져 있지 않아
// 회귀 검사의 숨긴 창(`regress.ts`)이 [0] 이면 그 창이 화면에 떴다
const primary = app.requestSingleInstanceLock()
if (!primary) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = mainWin
    if (!win || win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
}

app.whenReady().then(() => {
  // quit 을 불러도 ready 는 올 수 있다 — 두 번째는 창을 만들지 않는다
  if (!primary) return
  electronApp.setAppUserModelId('com.example.activityforge')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 양산기 폴더를 찾을 출발점. services 는 Electron 을 모르므로 여기서 넘긴다.
  // **기억해 둔 자리를 먼저 읽을 수 있게 `configureHome` 이 앞선다** — zip 으로
  // 받은 앱은 옆에 저장소가 없어 그 값이 유일한 실마리다 (`services/forge/home.ts`).
  // **초기 설정 해 보기** (`SPARKON_FIRST_RUN=1`, 2026-10-01) — dev 는 위로 올라가며 저장소의 forge 를 찾아 초기 설정이 안 뜬다.
  // 켜면 그 찾기를 끈다. userData 는 `boot.ts` 가 켤 때마다 새 임시 폴더로 옮겨 두었다 — 늘 처음 켠 사람처럼 시작하고, 평소 설정은 안 건드린다.
  // 고른 작업 폴더 안에 만든 SparkOn-양산기 · SparkOn-리소스 는 남는다
  const firstRun = process.env['SPARKON_FIRST_RUN'] === '1'
  configureHome(app.getPath('userData'))
  configureForge(firstRun ? '' : app.getAppPath())
  // 실행 파일에 넣어 둔 poppler 를 먼저 쓴다 — 따로 설치하지 않아도 기획서를 읽는다(`scripts/vendor-poppler.mjs`)
  // git · Claude Code 가 PATH 에 없어도 깔린 자리에서 찾는다(`services/forge/toolpath.ts`)
  refreshToolPath()
  // 앱 새 버전을 받아 둘 자리 — 입구(`boot.ts`)가 보는 자리와 같아야 한다(초기 설정 해 보기 때는 둘 다 임시 폴더)
  configureAppUpdate(app.getPath('userData'), app.isPackaged)
  // 개발 모드도 저장소에 받아 둔 것(`vendor/poppler/bin`)을 — Git Bash 에서 띄우면 Git 의 mingw 판이 PATH 맨 앞에 와서 기획서를 못 읽었다(2026-10-08)
  preferBundledPoppler(app.isPackaged ? join(process.resourcesPath, 'poppler', 'bin') : join(app.getAppPath(), 'vendor', 'poppler', 'bin'))
  // 스펙이 크기를 정한 그림(영상 썸네일)을 줄이는 도구. services 는 Electron 을 모르므로
  // 여기서 넘긴다 (`services/forge/imgsize.ts`).
  configureResizer((file, w, h) => {
    const img = nativeImage.createFromPath(file)
    return img.isEmpty() ? null : img.resize({ width: w, height: h, quality: 'best' }).toPNG()
  })

  // 지우는 것은 휴지통으로 (`lib/trash.ts`). 안 넘기면 services 는 지우지 않는다
  configureTrash((file) => shell.trashItem(file))

  registerIpcHandlers()
  mainWin = openMain()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWin = openMain()
  })
})

app.on('before-quit', (e) => holdIfBusy(e, mainWin))

// 「띄워 보기」가 올린 dev 서버는 자식 프로세스다. **앱이 꺼질 때 같이 내린다** —
// 안 내리면 포트를 쥔 채 남아, 다음에 띄울 때 다른 포트로 올라가고 사람은
// 어느 창이 어느 것인지 못 짚는다.
app.on('will-quit', () => {
  stopServer()
  // 회귀 검사가 호마다 띄운 vite 도 같은 까닭으로(`regress.ts`)
  stopRegress()
  // 대화로 만들기의 claude 도 — 셸 아래에 떠서 앱과 같이 안 죽고 값이 계속 나간다(`aisession.ts`)
  stopAllSessions()
  // 처음 설정의 yarn · sparkon 명령도(`lib/proc.ts`) — cmd 아래 yarn 은 앱과 같이 안 죽는다
  stopAllProcs()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
