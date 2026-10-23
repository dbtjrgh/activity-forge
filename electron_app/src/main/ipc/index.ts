import { join } from 'node:path'
import { app, ipcMain, shell } from 'electron'
import { IPC } from '../../shared/ipc'
import { localHttp } from '../lib/localurl'
import { mtimeOr, newerThan } from '../lib/newer'
import { RUNNING } from '../services/forge/appupdate'
import { registerChatIpc } from './chat'
import { registerFolderHandlers } from './folders'
import { registerFinishIpc } from './finish'
import { registerGuideIpc } from './guide'
import { registerManageIpc } from './manage'
import { registerForgeHandlers } from './forge'
import { registerPaperIpc } from './paper'
import { registerPreviewIpc } from './preview'
import { registerResourceIpc } from './resource'
import { registerSetupIpc } from './setup'
import { registerSyncIpc } from './sync'

/**
 * IPC 채널과 서비스를 잇는 얇은 층. **로직을 두지 않는다.**
 *
 * 채널이 19개가 되어 `ipc.ts` 한 파일에서 폴더별로 나눴다(2026-09-11).
 * 나누는 기준은 **화면 단위**다 — 채널을 하나 더 붙일 때 어느 파일인지
 * 화면 이름으로 바로 답이 나온다.
 *
 *   folders.ts  폴더 트리와 속성·권한 화면
 *   forge.ts    앱이 만든 진행판 · 작업 폴더
 *   resource.ts 작업대 (진행판에서 학습코드를 누르면 열린다)
 *   finish.ts   그 화면의 끝 단계 — 띄워 보기 · 검수 완료 · 커밋 (2026-09-18 에 resource.ts 에서 갈랐다)
 *   preview.ts  앱 안 창 (M6)
 *   chat.ts     대화로 만들기 (2026-10-08)
 *   guide.ts    받을 리소스 창 — figma 옆에 켜 두는 앞 학습코드 리소스
 *   sync.ts     진행판 맨 위 — main 에 모두 올리기 · 리소스 폴더 정리 (2026-10-14)
 *   answers.ts  (채널 아님) 렌더러가 보낸 학습코드를 거르는 신뢰 경계
 *   respond.ts  (채널 아님) 못 간 결과의 모양
 *
 * 이전 방식(만들기 · 답 · 반영 · 비교 캔버스 · 차례 줄)의 채널은 2026-10-08 에 걷었다 — 되살리려면 fb5c0d4 를 본다.
 *
 * 옛 양산 창(forge 의 api.ts 와 1:1 인 `screen.ts`)은 M8 에 걷었다 — 그 화면은 forge `ui` 명령(`forge-ui.bat`) 몫이다.
 */
export function registerIpcHandlers(): void {
  // 받은 앱 새 버전으로 떴으면 `app.getVersion()` 은 실행 파일의 판이다 — 지금 도는 코드에 박힌 판을 먼저 (`appupdate.ts`)
  ipcMain.handle(IPC.getVersion, () => RUNNING.version || app.getVersion())
  // dev 앱 — 켤 때 빌드한 메인 번들보다 늦게 고친 소스. 메인 · preload 는 다시 켜야 먹는다(`components/DevCodeBar.tsx`).
  // 공용(shared)도 본다 — 메인이 같이 묶는다. 번들 시각은 켤 때 한 번 재 둔다 — 켜 둔 사이에 누가 out/ 을 다시 빌드해도 도는 코드는 옛것이다
  const src = app.getAppPath()
  const built = app.isPackaged ? 0 : mtimeOr(join(src, 'out', 'main', 'index.js'), Date.now())
  ipcMain.handle(IPC.appCodeChanged, () => (app.isPackaged ? null : newerThan(src, ['src/main', 'src/preload', 'src/shared'], built)))
  ipcMain.handle(IPC.openPath, (_event, target: string) => shell.openPath(target))
  ipcMain.handle(IPC.openUrl, async (_event, target: unknown) => {
    const ok = localHttp(String(target ?? ''))
    if (!ok) return '이 컴퓨터의 dev 서버 주소만 열 수 있습니다.'
    await shell.openExternal(ok)
    return ''
  })

  registerFolderHandlers()
  registerForgeHandlers()
  registerResourceIpc()
  registerPaperIpc()
  registerFinishIpc()
  registerPreviewIpc()
  registerManageIpc()
  registerGuideIpc()
  registerSetupIpc()
  registerChatIpc()
  registerSyncIpc()
}
