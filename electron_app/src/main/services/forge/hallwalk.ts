/**
 * **호 저장소를 훑는다** — 작업 폴더의 `sparkon_mNN` 과, 그 안 액티비티마다 activityInfo.json (2026-09-30, 「관리」 화면).
 *
 * 완성본 점검과 팀별 셈이 같은 목록을 본다 — 둘이 따로 훑으면 「점검은 841, 팀별은 840」처럼 갈린다(저장소 규칙 3).
 * **읽기만 한다.** 못 읽은 activityInfo 는 안 끝난 것으로 치지 않고 `finished: null` 로 둔다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO = /^sparkon_m(\d\d)$/
const CODE = /^[A-Z]{2}L\dM\d\dW\dS\d$/

export type HallDir = { name: string; month: string; dir: string }

/** 작업 폴더의 호 저장소 — M 번호 차례 */
export function hallDirs(workRoot: string): HallDir[] {
  if (!existsSync(workRoot)) return []
  return readdirSync(workRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ m: REPO.exec(e.name), name: e.name }))
    .filter((x): x is { m: RegExpExecArray; name: string } => x.m !== null)
    .map((x) => ({
      name: x.name,
      month: x.m[1] as string,
      dir: join(workRoot, x.name)
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export type Activity = {
  code: string
  month: string
  /** 개발 완료인가. 파일을 못 읽었으면 null */
  finished: boolean | null
  team: string
  developer: string
}

/** 모든 호의 액티비티 폴더 — activityInfo 가 없는 폴더도 안 끝난 것으로 싣는다 */
export function activities(workRoot: string): Activity[] {
  const out: Activity[] = []
  for (const hall of hallDirs(workRoot)) {
    const root = join(hall.dir, 'src', 'activity')
    if (!existsSync(root)) continue
    for (const e of readdirSync(root, { withFileTypes: true })) {
      if (!e.isDirectory() || !CODE.test(e.name)) continue
      const { info, finished } = infoAt(join(root, e.name))
      out.push({
        code: e.name,
        month: hall.month,
        finished,
        team: typeof info.devTeam === 'string' ? info.devTeam : '',
        developer: typeof info.developer === 'string' ? info.developer : ''
      })
    }
  }
  return out
}

type Info = { devFinished?: unknown; devTeam?: unknown; developer?: unknown }

/** 액티비티 폴더 하나의 activityInfo — 없으면 안 끝난 것, 못 읽으면 `finished: null` */
function infoAt(actDir: string): { info: Info; finished: boolean | null } {
  const at = join(actDir, 'activityInfo.json')
  if (!existsSync(at)) return { info: {}, finished: false }
  try {
    const info = JSON.parse(readFileSync(at, 'utf8')) as Info
    return { info, finished: info.devFinished === true }
  } catch {
    return { info: {}, finished: null }
  }
}

/** 개발 완료인가 — 폴더 하나만 볼 때(대화가 열 완성본 고르기 `chatothers.ts`). 셈은 `activities` 와 같다 */
export const finishedAt = (actDir: string): boolean | null => infoAt(actDir).finished

/** forge `layout.scanCells` 의 칸 하나 → 학습코드(`L3W3S3` · `05` → `MAL3M05W3S3`) */
export const cellCode = (subject: string, c: { slot: string; issue: string }): string =>
  `${subject}${c.slot.slice(0, 2)}M${c.issue}${c.slot.slice(2)}`
