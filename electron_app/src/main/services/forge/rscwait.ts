/**
 * **받을 리소스** — 고른 호에서 아직 덜 온 학습코드마다 무엇이 없나 (2026-09-30, 「관리」 화면).
 *
 * 디자인 쪽에 「무엇을 몇 개」 보낼지 적으려고 둔다 — 전에는 사람이 폴더를 뒤져 셌다.
 * 09-30 에는 원본과 개수로 쟀다. 그 셈은 다 넣은 완성본에도 절반이 「부족」이라(`rsccount.ts` 머리) 10-14 에 바꿨다 —
 * **기획서에 적혔는데 없는 소리 이름**이 확실한 것이고, 그림 · 로티는 같은 모듈 완성본 가운데 가장 적은 것보다도 적을 때만 참고로 싣는다.
 * 영상만 빠진 ENL1M08W1S2 처럼 파일이 조금 온 칸도 범위 아래면 목록에 남는다.
 * 호를 다 그리면 호 하나에 몇 초라, **한 호씩** 본다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { hoOrder, type RscWait, type RscWaitRow } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { board, listBoards } from './board'
import { countFor } from './rsccount'
import { loadForge, type Forge } from './runtime'

/** 받을 것이 남았을 수 있는 칸 — 만들었거나 모듈부터 정해야 하는 칸은 뺀다 */
const WAITING = new Set(['리소스 대기', '만들 수 있음'])

function missingOf(forge: Forge, code: string, module: string, empty: boolean): RscWaitRow {
  const row: RscWaitRow = { code, module, empty, need: [], plan: { names: 0, note: '' } }
  try {
    const counted = countFor(forge, code, module)
    // 확실한 것(없는 소리)과, 같은 모듈 완성본 가운데 가장 적은 것보다도 적은 종류만 — 범위 안이면 그 학습코드는 그만큼 쓰는 것일 수 있다
    const need = counted.rows.filter((r) => r.missing.length || (r.range && r.here < r.range.min))
    return { ...row, need, plan: counted.plan }
  } catch (error) {
    return { ...row, error: toMessage(error) }
  }
}

/**
 * `want` 를 안 주면 **아직 안 끝난 호 가운데 가장 앞 호** — 지금 만드는 호다. 「가장 새로 연 호」로 고르면
 * 입력이 하나도 안 온 11호가 잡혀 칸 108개가 다 뜨고 17초가 걸렸다. 호 차례로 센다(M11 은 6호다)
 */
export async function rscWait(want?: string): Promise<RscWait> {
  try {
    const forge = await loadForge()
    const list = await listBoards()
    if (list.error && !list.boards.length) return { month: null, months: [], rows: [], error: list.error }
    const open = (m: string): boolean => list.boards.some((b) => b.issue === m && b.done !== null && b.done < b.total)
    const months = [...new Set(list.boards.map((b) => b.issue))].filter(open).sort((a, b) => hoOrder(a) - hoOrder(b))
    const month = want && months.includes(want) ? want : (months[0] ?? null)
    if (!month) return { month, months, rows: [] }
    const rows: RscWaitRow[] = []
    for (const b of list.boards.filter((x) => x.issue === month)) {
      const got = await board({ subject: b.subject, issue: b.issue })
      for (const r of got.rows) {
        if (r.work?.finished === true || !WAITING.has(r.stage)) continue
        const row = missingOf(forge, r.code, r.module, r.stage === '리소스 대기')
        if (row.empty || row.error || row.need.length) rows.push(row)
      }
    }
    return { month, months, rows }
  } catch (error) {
    return { month: null, months: [], rows: [], error: toMessage(error) }
  }
}
