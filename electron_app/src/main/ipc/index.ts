import { app, ipcMain, shell } from 'electron'
import { IPC } from '../../shared/ipc'
import { localHttp } from '../lib/localurl'
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
}
