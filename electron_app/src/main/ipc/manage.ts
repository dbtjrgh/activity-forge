import { ipcMain } from 'electron'
import type { GateResult, HallStatus, RscWait, TeamTally } from '../../shared/forge'
import { IPC } from '../../shared/ipc'
import { lastGate, runGate } from '../services/forge/gatecheck'
import { hallStatus } from '../services/forge/hallstatus'
import { rscWait } from '../services/forge/rscwait'
import { teamTally } from '../services/forge/teamtally'

/** 「관리」 화면 — 받는 인자는 받을 리소스의 M 번호 하나뿐이다. 서비스가 오류를 결과에 담아 돌려준다 */
export function registerManageIpc(): void {
  ipcMain.handle(IPC.manageRepos, (): Promise<HallStatus> => hallStatus())
  // M 번호 두 자리만 받는다 — 아니면 기본(지금 만드는 호)
  ipcMain.handle(IPC.manageRsc, (_e, month: unknown): Promise<RscWait> =>
    rscWait(typeof month === 'string' && /^\d\d$/.test(month) ? month : undefined)
  )
  ipcMain.handle(IPC.manageGate, (): Promise<GateResult> => lastGate())
  ipcMain.handle(IPC.manageGateRun, (): Promise<GateResult> => runGate())
  ipcMain.handle(IPC.manageTeams, (): Promise<TeamTally> => teamTally())
}
