/**
 * **팀 일정표 갱신** (2026-10-12, 사용자 요청) — 완료한 학습코드를 팀 일정표(엑셀 웹)에 파란색으로.
 *
 * 앱이 엑셀을 직접 고칠 길은 회사 Microsoft 365 에 앱을 등록해야 열린다(Graph). SharePoint 쿠키로 부르는 v2.0 에는
 * `/workbook` 이 없다(404, 2026-10-12 확인). 그래서 칠하는 것은 엑셀 웹의 Office Script 「스파크온 완료 칠하기」가 하고,
 * 앱은 **완료 목록을 내 컴퓨터에 잠깐 띄워 둔다** — 스크립트가 `fetch` 로 받아 간다(이 PC 크롬에서 확인).
 * 스크립트 본문과 쓰는 법은 `_document/팀일정표.md`.
 *
 * - 완료는 호 저장소 activityInfo 의 devFinished 하나로 센다 — **팀을 가리지 않는다**(일정표의 파란색은 누가 했든 「작업 완료」)
 * - 못 읽은 activityInfo(`finished: null`)는 완료로 치지 않는다
 *
 * Electron 을 import 하지 않는다(services 규칙). 일정표를 여는 것은 `ipc/forge.ts`.
 */

import type { TeamSheet } from '../../../shared/forge'
import { TEAM_SHEET_PORT, TEAM_SHEET_TTL_MS } from '../../constants'
import { toMessage } from '../../lib/errors'
import { serveJson } from '../../lib/localserve'
import { activities } from './hallwalk'
import { loadForge } from './runtime'

/** 팀 공용 일정표 — 「스파크온 개발팀 계획 일정.xlsx」 */
export const TEAM_SHEET_URL =
  'https://example.sharepoint.com/your-team-schedule'

/** 스크립트가 부르는 자리 — `_document/팀일정표.md` 의 스크립트와 같아야 한다 */
const PATH = '/sparkon/done'

export async function serveTeamSheet(): Promise<TeamSheet> {
  try {
    const { paths } = await loadForge()
    const codes = activities(paths.workRoot())
      .filter((a) => a.finished === true)
      .map((a) => a.code)
      .sort()
    if (!codes.length) return { count: 0, until: 0, error: '호 저장소에서 개발 완료인 학습코드를 찾지 못했습니다.' }
    const served = await serveJson(TEAM_SHEET_PORT, PATH, { codes, at: new Date().toISOString() }, TEAM_SHEET_TTL_MS)
    return served.ok ? { count: codes.length, until: served.until } : { count: codes.length, until: 0, error: served.error }
  } catch (error) {
    return { count: 0, until: 0, error: toMessage(error) }
  }
}
