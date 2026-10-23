/**
 * **진행판 칸마다 이 판의 형편** (2026-09-28, `_document/양산판.md` M2).
 *
 * forge 의 진행판(`boardOf`)은 배치표 · 스펙 · 리소스만 안다. 타일이 「질문 2」 · 「화면 붙이기」 ·
 * 「끝」을 말하려면 앱이 적어 둔 것을 더 봐야 한다 — 대화의 형편(`_recipe/<코드>.chat.json`), 리소스 폴더의
 * figma 화면, 호 저장소의 `activityInfo.json`.
 *
 * 2026-10-08 `run.json`(이전 방식의 남은 카드 수) 대신 대화를 본다 — 이전 방식을 앱에서 걷어 그 파일은 더 안 바뀐다.
 * 남겨 두면 옛 카드 수가 「답변 필요」로 영영 남는다(KOL2M08W2S3 은 57장이었다).
 *
 * **읽기만 한다.** 못 읽은 것은 null 로 두고 짐작하지 않는다(저장소 규칙 6).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import { shownModule, type BoardRow, type RowWork } from '../../../shared/forge'
import { chatFile, infoOf, readChat } from './chatstore'
import { keptPlanDiff } from './planmodule'
import { gapFor } from './rsccount'
import type { Forge } from './runtime'
import { shotsOf } from './shot'
import { needsShot } from './shotfirst'
import { vacationLinks } from './vacation'
import { devicesOf } from './devices'

/** 호 저장소의 그 액티비티 폴더 — 학습코드에서 호를 못 읽으면 빈 글 */
const actDirOf = (forge: Forge, code: string): string => {
  const month = /M(\d\d)/.exec(code)?.[1]
  return month ? path.join(forge.paths.workRoot(), `sparkon_m${month}`, 'src', 'activity', code) : ''
}

export function finishedOf(forge: Forge, code: string): boolean | null {
  const dir = actDirOf(forge, code)
  if (!dir) return null
  const at = path.join(dir, 'activityInfo.json')
  if (!fs.existsSync(at)) return false
  try {
    return (JSON.parse(fs.readFileSync(at, 'utf8')) as { devFinished?: boolean }).devFinished === true
  } catch {
    return null
  }
}

/** 이보다 파일이 많으면 공용만일 리가 없다고 보고 안 센다 — 공용 자리는 모듈마다 열 개 안팎이다 */
const COMMON_ONLY_MAX = 20

/**
 * **폴더에 공용 파일만 있나** (2026-09-29, M9 채비). 앱은 대화를 시작할 때 공용 파일을 리소스 자리에 채운다(`commonrsc.ts`).
 * forge 의 진행판은 파일이 하나라도 있으면 「만들 수 있음」이라, 9호 입력이 하나도 안 온 ENL1M08W1S2 가 그렇게 섰다 —
 * 누르면 8호 것만으로 9호를 만든다. 공용인가는 `common.ts` 가 완성본으로 센 것 그대로 본다(바이트까지 같은 파일).
 */
function commonOnly(forge: Forge, row: BoardRow, prints: (module: string) => Set<string>): boolean {
  if (row.stage !== '만들 수 있음' || !row.module || row.module.includes('+') || row.files > COMMON_ONLY_MAX) return false
  const got = forge.files.listFiles(row.code)
  if (!got?.exists || got.files.length === 0) return false
  const common = prints(row.module)
  if (!common.size) return false
  return got.files.every((f) => {
    const sub = f.base === 'root' ? '' : f.base
    let at = path.join(got.dir, sub, f.name)
    if (!fs.existsSync(at) && f.base === 'animations') at = path.join(got.dir, 'animation', f.name)
    const p = forge.common.printOf(at)
    return p !== null && common.has(p)
  })
}

export function withWork(forge: Forge, subject: string, rows: BoardRow[]): BoardRow[] {
  const commonPrints = new Map<string, Set<string>>()
  const prints = (module: string): Set<string> => {
    if (!commonPrints.has(module)) {
      commonPrints.set(module, new Set([...forge.common.commonFiles(subject, module).values()].map((c) => c.print)))
    }
    return commonPrints.get(module) as Set<string>
  }
  // 모듈마다 스펙을 한 번만 읽는다 — 한 호에 모듈이 수십 개라 칸마다 읽으면 느려진다
  const shotNeed = new Map<string, boolean>()
  const need = (module: string): boolean => {
    if (!module) return true
    if (!shotNeed.has(module)) shotNeed.set(module, needsShot(forge, subject, module))
    return shotNeed.get(module) as boolean
  }
  /**
   * 리소스가 들어온 칸만 기획서 소리 이름과 견준다 — 빈 칸 · 끝난 칸 · 공용만 든 칸은 셀 까닭이 없다.
   * 기획서 글은 처음 한 번만 읽고 남긴다(`plansound.ts`). 9호처럼 리소스가 막 들어오는 호에서 몇 칸뿐이다
   */
  const gap = (row: BoardRow, finished: boolean | null, waiting: boolean): number | null => {
    if (row.stage !== '만들 수 있음' || finished === true || waiting || !row.module) return null
    return gapFor(forge, row.code)
  }
  const root = forge.paths.REPO_ROOT
  // 방학호와 리소스가 거의 다 같은 짝 — 잰 자료(`_layout/vacation.json`)를 읽기만 한다
  const pairs = vacationLinks(forge)
  return rows.map((row) => {
    // 대화 파일이 없는 칸이 대부분이다 — 칸마다 읽다 실패하는 길로 보내지 않는다(진행판을 열 때 72칸)
    const c = fs.existsSync(chatFile(root, row.code)) ? infoOf(readChat(root, row.code)) : null
    const dir = forge.files.rscDir(row.code)
    const finished = finishedOf(forge, row.code)
    const waiting = commonOnly(forge, row, prints)
    // 기획서 모듈이 배치표와 다른가 — 작업대를 열 때 남긴 것만 본다(`planmodule.ts`). 다 만든 칸 · 갈린 칸은 안 본다
    const planModule = finished === true || row.verdict === '갈림' ? '' : keptPlanDiff(forge, row.code, row.module)
    // 학습할 때 켜는 카메라 · 마이크 — 다 만든 칸은 호 저장소가 쓰는 모듈과 GameData, 아니면 배치표 판정(조건은 「확인 필요」)
    const devices = devicesOf(actDirOf(forge, row.code), shownModule(row, finished), finished === true)
    const work: RowWork = {
      ...(planModule ? { planModule } : {}),
      ...(pairs.has(row.code) ? { vacation: pairs.get(row.code) } : {}),
      ...(devices ? { devices } : {}),
      // 도는 중으로 남은 옛 형편은 `readChat` 이 「멈춤」으로 바꿔 준다(앱을 껐다 켠 것)
      chat: c?.sessionId ? { state: c.state, questions: c.questions.length, cost: c.cost } : null,
      shots: dir && fs.existsSync(dir) ? shotsOf(dir).length : 0,
      needsShot: need(row.module),
      finished,
      running: c?.since != null ? Date.now() - c.since : null,
      rscGap: gap(row, finished, waiting)
    }
    // 공용만 있으면 아직 이 회차 입력이 안 온 것이다 — 「리소스 대기」로 둔다
    return { ...row, ...(waiting ? { stage: '리소스 대기' as const } : {}), work }
  })
}
