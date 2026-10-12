/**
 * **배치표가 갈린 칸을 진행판에서 한 장으로** (2026-09-29, M7). 9호 EN 은 8칸, MA 는 31칸이 앞선 호마다 모듈이 달라 기계가 못 고른다.
 * 칸마다 작업대를 열어 고르게 하지 않고 진행판 위 카드 한 장에 모은다.
 *
 * - 후보 · 근거는 작업대 카드와 **같은 셈**이다(`askmodule.ts` `moduleAsk` — 앞선 호가 실제로 쓴 것만)
 * - 고르면 사람 답과 같은 길로 배치표에 남는다(`carry.ts`) — 까닭을 꼭 받는다
 * - **EN 은 기획서 「호별 사용 유형」 쪽을 그림으로 붙인다.** 그 쪽은 01호부터 호마다 어느 유형(룰렛 · 슬롯머신 …)인지 표로 적어 둔다 —
 *   8호 기획서 한 장으로 9호 칸도 가린다. 찾는 자리는 **앞선 호 같은 칸**의 `_plan` 이다(메뉴 이름과 기획서 제목이 달라 이름으로는 못 찾는다).
 *   못 찾으면 그렇다고 말한다. **짐작으로 고르지 않는다**
 * - MA 는 이 카드 대신 9호 기획서 1쪽의 모듈넘버가 채운다(`layoutfill.ts`) — 진행판에 놓을 때(`sortpaper.ts`)와 작업대를 열 때(`prepare.ts`).
 *   여기는 기획서가 없거나 아직 작업대를 안 연 칸이 남는다
 *
 * 그림은 파일 경로로 낸다(data URL 은 `ipc/` 가). Electron 을 import 하지 않는다(services 규칙).
 */

import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BoardKey, Carried, LayoutAsk, LayoutAsks } from '../../../shared/forge'
import { MODULE_PATH } from '../../../shared/forge'
import { carryAnswers } from './carry'
import { toMessage } from '../../lib/errors'
import { moduleAsk } from './askmodule'
import { pagePng, pageText, poppler } from './poppler'
import { loadForge, type Forge } from './runtime'
import { plansOf } from './shot'

/** 「호별 사용 유형」 쪽을 찾아볼 앞쪽 쪽수 — 표지 · 차례 다음에 온다(8호 Word Spark 는 3쪽) */
const PAGES = 8
const TYPE_PAGE = /호별\s*사용\s*유형/

/** 앞선 호 같은 칸의 기획서에서 「호별 사용 유형」 쪽 — 없으면 까닭 */
function typePage(forge: Forge, code: string): { plan: LayoutAsk['plan']; why: string } {
  // 기획서가 이미 폴더에 있어도 여기는 안 채운다 — 31칸마다 pdftotext 를 돌리면 진행판이 멈춘다. 작업대가 열 때 채운다(`prepare.ts`)
  if (code.startsWith('MA')) return { plan: null, why: '기획서를 넣은 뒤 작업대를 열면 1쪽의 모듈넘버로 채웁니다.' }
  if (!code.startsWith('EN')) return { plan: null, why: '앞선 호에서 쓴 모듈을 보고 고르세요.' }
  if (!poppler().tools.length) return { plan: null, why: poppler().why }
  const m = /^(EN)L(\d)M(\d\d)W(\d)S(\d)$/.exec(code)
  if (!m) return { plan: null, why: '학습코드를 읽지 못했습니다.' }
  for (let n = Number(m[3]) - 1; n >= 1; n--) {
    const before = `ENL${m[2]}M${String(n).padStart(2, '0')}W${m[4]}S${m[5]}`
    const dir = forge.files.rscDir(before)
    if (!dir) continue
    for (const f of plansOf(dir)) {
      const file = join(dir, f)
      for (let p = 1; p <= PAGES; p++) {
        const got = pageText(file, p)
        if ('why' in got) break
        if (!TYPE_PAGE.test(got.text)) continue
        const out = join(forge.paths.REPO_ROOT, '_recipe', '_planpage')
        mkdirSync(out, { recursive: true })
        const png = pagePng(file, p, join(out, `${before}-${p}`))
        return png ? { plan: { file, page: p, image: png }, why: '' } : { plan: null, why: `${before} 기획서 ${p}쪽을 그림으로 열지 못했습니다. 「기획서 열기」로 확인하세요.` }
      }
    }
  }
  return { plan: null, why: '앞선 호 기획서가 없습니다. 기획서의 「호별 사용 유형」 쪽을 보고 고르세요.' }
}

/** 호 저장소의 그 학습코드가 개발 끝인가 */
function finished(forge: Forge, code: string): boolean {
  const month = /M(\d\d)/.exec(code)?.[1]
  try {
    const at = join(forge.paths.workRoot(), `sparkon_m${month}`, 'src', 'activity', code, 'activityInfo.json')
    return (JSON.parse(readFileSync(at, 'utf8')) as { devFinished?: unknown }).devFinished === true
  } catch {
    return false
  }
}

export async function layoutAsks(key: BoardKey): Promise<LayoutAsks> {
  const out: LayoutAsks = { ...key, rows: [] }
  try {
    const forge = await loadForge()
    for (const row of forge.layout.boardOf(key.subject, key.issue)) {
      const at = forge.layout.placementFor(row.code)
      if (!at || at.verdict !== '갈림') continue
      // **이미 끝난 칸은 안 묻는다** — EN07 은 36/36 끝인데 배치표 판정만 갈림으로 남아 카드에 섰다. 더미도 Activity.ts 가 있어
      // 「만들었음」으로는 못 가린다 — 개발 끝 표시(`activityInfo.json`)로 가린다
      if (finished(forge, row.code)) continue
      const { plan, why } = typePage(forge, row.code)
      out.rows.push({ code: row.code, slot: at.slot, label: at.wbs?.title ?? '', ask: moduleAsk(at, ''), plan, planWhy: why })
    }
  } catch (error) {
    out.error = toMessage(error)
  }
  return out
}


/** 그 칸의 모듈을 고른다 — 사람 답과 같은 길(`carry.ts`)로 배치표에. 까닭은 `ipc/` 가 비었는지 봤다 */
export async function pickModule(code: string, module: string, why: string): Promise<Carried> {
  try {
    const forge = await loadForge()
    const [done] = await carryAnswers(code, [{ path: MODULE_PATH, value: module, carry: { why } }], forge)
    return done ?? { path: MODULE_PATH, ok: false, file: '', note: '배치표에 저장하지 못했습니다.' }
  } catch (error) {
    return { path: MODULE_PATH, ok: false, file: '', note: toMessage(error) }
  }
}
