import { ipcMain } from 'electron'
import type { GateResult, HallStatus, RegressChanged, RegressResult, RegressState, RscWait, TeamTally } from '../../shared/forge'
import { IPC } from '../../shared/ipc'
import { runRegressPage } from '../regress'
import { lastGate, runGate } from '../services/forge/gatecheck'
import { hallStatus } from '../services/forge/hallstatus'
import { lastRegress, regressProgress, runRegress } from '../services/forge/regress'
import { MAX_NAMES, regressChanged } from '../services/forge/regresspick'
import { rscWait } from '../services/forge/rscwait'
import { teamTally } from '../services/forge/teamtally'

/** 회귀 검사 이름 칸의 한 이름은 이만큼만 받는다 — 넘는 것은 잘라도 어느 폴더와도 안 맞아 「찾지 못함」으로 알린다 */
const NAME_MAX = 80

/**
 * 「관리」 화면 — 받는 인자는 받을 리소스의 M 번호, 회귀 검사의 모듈 이름뿐이다. 서비스가 오류를 결과에 담아 돌려준다.
 * 회귀 검사의 창은 Electron 이 있어야 해서 여기서 `main/regress.ts` 를 넘긴다.
 * 모듈 이름은 글자인지 · 길이만 본다 — 실제 폴더 이름과 맞추고 못 찾은 이름을 알리는 것은 서비스다(`regresspick.ts` `keysOfNames`).
 * 이름은 폴더 목록과 견주기만 하고 경로로 쓰지 않는다. 여기서 꼴로 거르면 잘못 적은 이름이 말없이 빠졌다
 */
export function registerManageIpc(): void {
  ipcMain.handle(IPC.manageRepos, (): Promise<HallStatus> => hallStatus())
  // M 번호 두 자리만 받는다 — 아니면 기본(지금 만드는 호)
  ipcMain.handle(IPC.manageRsc, (_e, month: unknown): Promise<RscWait> =>
    rscWait(typeof month === 'string' && /^\d\d$/.test(month) ? month : undefined)
  )
  ipcMain.handle(IPC.manageGate, (): Promise<GateResult> => lastGate())
  ipcMain.handle(IPC.manageGateRun, (): Promise<GateResult> => runGate())
  ipcMain.handle(IPC.manageTeams, (): Promise<TeamTally> => teamTally())

  ipcMain.handle(IPC.manageRegressChanged, (): Promise<RegressChanged> => regressChanged())
  ipcMain.handle(IPC.manageRegress, async (): Promise<RegressState> => ({ last: await lastRegress(), progress: regressProgress() }))
  // 도는 동안 진행 줄을 누른 창에만 민다 — 수십 개면 몇 분 걸린다
  ipcMain.handle(IPC.manageRegressRun, (event, names: unknown): Promise<RegressResult> => {
    const list = Array.isArray(names)
      ? names
          .filter((n): n is string => typeof n === 'string')
          .map((n) => n.trim().slice(0, NAME_MAX))
          .filter(Boolean)
          // 하나 더 받아 서비스가 상한에 걸렸음을 알린다 — 그보다 많이 받으면 거절 글이 끝없이 길어진다
          .slice(0, MAX_NAMES + 1)
      : []
    return runRegress(list, runRegressPage, (p) => {
      if (!event.sender.isDestroyed()) event.sender.send(IPC.manageRegressEvent, p)
    })
  })
}
