/**
 * **MA 기획서의 「모듈넘버」로 배치표를 채운다** (2026-09-29, M7). 9호 MA 는 36칸 중 31칸을 기계가 못 정한다 —
 * 앞선 호마다 모듈이 달라서다. 그런데 기획서 1쪽에 `모듈넘버: M05` 가 적혀 온다. 그것이 곧 답이다.
 *
 * - **배치표가 이미 정한 칸은 안 건드린다.** 다르면 기획서를 안 넣고 말한다(`sortpaper.ts`)
 * - 남기는 길은 사람 답과 같다(`carry.ts` → `_layout/<과목><호>.json`, 까닭에 「기획서 1쪽 모듈넘버」) — 길을 둘로 두지 않는다
 * - **스펙이 없는 모듈이면**(예: M02) 배치표에는 남기되 「9호 끝 기준 밖」이라고 같이 말한다 — 만들 수가 없다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { MODULE_PATH } from '../../../shared/forge'
import { carryAnswers } from './carry'
import { pageText } from './poppler'
import type { Forge } from './runtime'
import { plansOf } from './shot'

/** 기획서 1쪽 글에서 「모듈넘버: M05」 — 없으면 빈 글 */
export function moduleOnPage(text: string): string {
  return /모듈\s*넘버\s*[:：]\s*([A-Z]+\d+(?:_\d+)?)/i.exec(text)?.[1]?.toUpperCase() ?? ''
}

/**
 * 그 학습코드 `_plan` 에 이미 놓인 기획서로 채운다 — 배치표를 못 정해 작업대를 열었는데 기획서가 먼저 와 있을 때(`prepare.ts`).
 * 2026-10-08 까지는 이전 방식의 `run.ts` 가 불렀다. 채웠으면 한 줄, 아니면 빈 글.
 */
export async function fillFromPlans(forge: Forge, code: string): Promise<string> {
  const dir = forge.files.rscDir(code)
  if (!dir || !code.startsWith('MA')) return ''
  for (const f of plansOf(dir)) {
    const file = join(dir, f)
    const read = pageText(file, 1)
    if ('why' in read) continue
    const note = await fillFromPlan(forge, code, moduleOnPage(read.text), file)
    if (note) return note
  }
  return ''
}

/** 채웠으면 한 줄, 채울 것이 아니면 빈 글 */
export async function fillFromPlan(forge: Forge, code: string, module: string, file: string): Promise<string> {
  if (!module) return ''
  const pick = forge.api.layoutFor(code)
  if (pick.ok) return ''
  const [done] = await carryAnswers(
    code,
    [{ path: MODULE_PATH, value: module, carry: { why: `기획서 1쪽 모듈넘버 ${module} (${basename(file)})` } }],
    forge
  )
  if (!done) return ''
  if (!done.ok) return `배치표에 저장하지 못했습니다: ${done.note}`
  const spec = existsSync(forge.spec.specPath(code.slice(0, 2), module))
  return done.note + (spec ? '' : ` ${module} 모듈은 스펙이 없어 생성할 수 없습니다.`)
}
