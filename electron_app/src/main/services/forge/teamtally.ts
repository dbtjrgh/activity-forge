/**
 * **팀별 현황** — M 번호마다 어느 팀이 몇 칸을 끝냈나 (2026-09-30, 「관리」 화면).
 *
 * activityInfo 의 `devFinished` · `devTeam` 만 읽는다. **쓰지 않는다.** 팀이 안 적힌 완료는 「(팀 없음)」으로 따로 센다 —
 * 어느 팀에 짐작해 붙이지 않는다. 폴더 수에는 빈 뼈대(9호 이후)도 들어간다 — 그것도 아직 안 끝난 칸이 맞다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { TeamRow, TeamTally } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { activities } from './hallwalk'
import { loadForge } from './runtime'

export const NO_TEAM = '(팀 없음)'

export async function teamTally(): Promise<TeamTally> {
  try {
    const { paths } = await loadForge()
    const all = activities(paths.workRoot())
    const months = [...new Set(all.map((a) => a.month))].sort()
    const folders: Record<string, number> = {}
    const open: Record<string, number> = {}
    const teams = new Map<string, TeamRow>()
    for (const a of all) {
      folders[a.month] = (folders[a.month] ?? 0) + 1
      if (a.finished !== true) {
        open[a.month] = (open[a.month] ?? 0) + 1
        continue
      }
      const name = a.team || NO_TEAM
      const row = teams.get(name) ?? { team: name, byMonth: {}, total: 0 }
      row.byMonth[a.month] = (row.byMonth[a.month] ?? 0) + 1
      row.total += 1
      teams.set(name, row)
    }
    return {
      months,
      teams: [...teams.values()].sort((a, b) => b.total - a.total),
      folders,
      open
    }
  } catch (error) {
    return {
      months: [],
      teams: [],
      folders: {},
      open: {},
      error: toMessage(error)
    }
  }
}
