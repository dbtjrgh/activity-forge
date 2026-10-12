/**
 * **받을 리소스** — 고른 호에서 아직 덜 온 칸마다, 갈래별로 원본보다 모자란 수 (2026-09-30, 「관리」 화면).
 *
 * 디자인 쪽에 「무엇을 몇 개」 보낼지 적으려고 둔다 — 전에는 사람이 폴더를 뒤져 셌다.
 * **모자람은 개수로 잰다.** 파일은 이름이 바뀌어 오므로 이름만 견주면 온 것도 없다고 나온다. 처음엔 「리소스 대기」 칸만
 * 이름으로 봤는데, 그러면 영상만 빠진 ENL1M08W1S2(파일 9개가 와서 「만들 수 있음」)가 목록에서 아예 빠졌다.
 * 원본 이름으로 없는 것은 **실마리로만** 싣는다 — 개수가 모자란 갈래에서만.
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
  const row: RscWaitRow = { code, module, origin: '', empty, missing: [] }
  const counted = countFor(forge, code)
  if (typeof counted === 'string') return { ...row, error: counted }
  return { ...row, origin: counted.origin, missing: counted.rows.filter((r) => r.here < r.origin) }
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
        if (row.empty || row.error || row.missing.length) rows.push(row)
      }
    }
    return { month, months, rows }
  } catch (error) {
    return { month: null, months: [], rows: [], error: toMessage(error) }
  }
}
