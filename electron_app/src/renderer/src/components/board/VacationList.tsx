import type { BoardRow } from '../../../../shared/forge'
import { vacationGroups } from '../../lib/vacation'
import './markcard.css'
import './vacation.css'

/**
 * **방학호와 겹치는 학습코드** (2026-10-20 사용자 말 — 「방학호랑 겹치는 원본 호의 학습코드들 따로 표기해놔 보기좋게」).
 * 1~5호 진행판에는 6호(방학)에 그대로 쓰인 학습코드를, 6호(방학) 진행판에는 앞선 호에서 가져온 학습코드를 상대 호마다 모아 보인다.
 * 짝은 칸이 같지 않아 두 학습코드를 다 적는다. 자료는 forge `tool/vacation.ts` 가 잰 `_layout/vacation.json` 이다.
 * 짝이 없는 호(7호부터)는 아무것도 안 그린다.
 */
function VacationList({ rows, onOpen }: { rows: BoardRow[]; onOpen: (code: string) => void }) {
  const groups = vacationGroups(rows)
  const total = groups.reduce((n, g) => n + g.pairs.length, 0)
  if (total === 0) return null
  // 방학호 진행판이면 짝이 모두 「가져옴」이다
  const isVacation = rows.some((r) => r.work?.vacation?.some((l) => l.side === 'from'))
  return (
    <section className="mark-list">
      <h3>
        {isVacation ? '앞선 호에서 그대로 가져온 학습코드' : '6호(방학)에 그대로 쓰인 학습코드'} <strong>{total}</strong>개
      </h3>
      <p className="mark-desc">리소스 파일이 거의 다 같은 학습코드끼리 짝지었습니다.</p>
      {groups.map((g) => (
        <div key={g.month} className="mark-group">
          <span className="mark-title">
            {g.name} <b>{g.pairs.length}</b>
          </span>
          <span className="mark-items">
            {g.pairs.map((p) => (
              <span key={p.from + p.to} className="vac-pair" title={`파일 ${p.same}/${p.total}개가 같습니다.`}>
                <button className={`mark-code mono${p.from === p.mine ? ' mine' : ''}`} onClick={() => onOpen(p.from)}>
                  {p.from}
                </button>
                <span className="vac-arrow">→</span>
                <button className={`mark-code mono${p.to === p.mine ? ' mine' : ''}`} onClick={() => onOpen(p.to)}>
                  {p.to}
                </button>
                <span className="vac-pct">{Math.round((100 * p.same) / p.total)}%</span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </section>
  )
}

export default VacationList
