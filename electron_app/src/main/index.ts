import { join } from 'node:path'
import { app, BrowserWindow, nativeImage, shell } from 'electron'
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
import { stopAllSessions } from './services/forge/aisession'
import { closeGuide } from './guidewin'
import { createWindow } from './window'

// **한 번만 켠다** (2026-10-01) — 켜 둔 채 바로가기를 또 누르면 두 번째가 9222 · 설정 파일을 두고 부딪혀 오류 창이 떴다.
// 두 번째는 바로 끝내고, 켜 둔 창을 앞으로 띄운다
const primary = app.requestSingleInstanceLock()
if (!primary) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
}

app.whenReady().then(() => {
  // quit 을 불러도 ready 는 올 수 있다 — 두 번째는 창을 만들지 않는다
  if (!primary) return
  electronApp.setAppUserModelId('dev.sparkon.manager')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 양산기 폴더를 찾을 출발점. services 는 Electron 을 모르므로 여기서 넘긴다.
  // **기억해 둔 자리를 먼저 읽을 수 있게 `configureHome` 이 앞선다** — zip 으로
  // 받은 앱은 옆에 저장소가 없어 그 값이 유일한 실마리다 (`services/forge/home.ts`).
  // **초기 설정 해 보기** (`SPARKON_FIRST_RUN=1`, 2026-10-01) — dev 는 위로 올라가며 저장소의 forge 를 찾아 초기 설정이 안 뜬다.
  // 켜면 그 찾기를 끄고 앱 설정을 켤 때마다 새 임시 폴더에 둔다 — 늘 처음 켠 사람처럼 시작하고, 평소 설정은 안 건드린다.
  // 고른 작업 폴더 안에 만든 SparkOn-양산기 · SparkOn-리소스 는 남는다
  const firstRun = process.env['SPARKON_FIRST_RUN'] === '1'
  configureHome(firstRun ? join(app.getPath('temp'), `sparkon-first-run-${Date.now()}`) : app.getPath('userData'))
  configureForge(firstRun ? '' : app.getAppPath())
  // 실행 파일에 넣어 둔 poppler 를 먼저 쓴다 — 따로 설치하지 않아도 기획서를 읽는다(`scripts/vendor-poppler.mjs`)
  // git · Claude Code 가 PATH 에 없어도 깔린 자리에서 찾는다(`services/forge/toolpath.ts`)
  refreshToolPath()
  // 앱 새 버전을 받아 둘 자리 — 입구(`boot.ts`)가 보는 자리와 같아야 해서 초기 설정 해 보기 때도 평소 userData 다
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
  // 받을 리소스 창은 메인 창의 자식이 아니다(`guidewin.ts`) — 메인 창이 닫히면 같이 닫아야 앱이 끝난다
  createWindow().on('closed', closeGuide)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 「띄워 보기」가 올린 dev 서버는 자식 프로세스다. **앱이 꺼질 때 같이 내린다** —
// 안 내리면 포트를 쥔 채 남아, 다음에 띄울 때 다른 포트로 올라가고 사람은
// 어느 창이 어느 것인지 못 짚는다.
app.on('will-quit', () => {
  stopServer()
  // 대화로 만들기의 claude 도 — 셸 아래에 떠서 앱과 같이 안 죽고 값이 계속 나간다(`aisession.ts`)
  stopAllSessions()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
