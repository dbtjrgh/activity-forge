import { statusOf, toneOf, wantsShot, type BoardRow, type Status } from '../../../../shared/forge'
import './nowlist.css'

/**
 * **지금 바로 할 수 있는 학습코드** (2026-10-01 사용자 요청) — 진행판 맨 위에 모아 보인다.
 *
 * 남을 기다리지 않고 지금 손댈 수 있는 것만: 질문 답변 · 검수 · 생성 · figma 화면 붙이기.
 * 리소스 · 스펙 · 모듈을 기다리는 칸은 넣지 않는다 — 지금 눌러도 할 일이 없다.
 * **완료에 가까운 것부터** — 답변 · 검수를 먼저 끝내야 개발 완료 수가 는다.
 */

/** `has` 가 있으면 상태 대신 그것으로 고른다 — 화면 붙이기는 「화면 연속 붙여넣기」와 같은 셈(`wantsShot`) */
const GROUPS: { key: string; title: string; status: Status; has?: (row: BoardRow) => boolean }[] = [
  { key: 'ask', title: '질문 답변', status: '답변 필요' },
  { key: 'view', title: '미리보기와 검수', status: '검수 대기' },
  { key: 'ready', title: '생성', status: '생성 대기' },
  { key: 'shot', title: 'figma 화면 붙이기', status: '입력 필요', has: wantsShot }
]

function NowList({ rows, onOpen }: { rows: BoardRow[]; onOpen: (code: string) => void }) {
  const groups = GROUPS.map((g) => ({
    ...g,
    rows: rows
      .filter((r) => (g.has ? g.has(r) : statusOf(r).status === g.status))
      .sort((a, b) => a.code.localeCompare(b.code))
  })).filter((g) => g.rows.length > 0)
  const total = groups.reduce((n, g) => n + g.rows.length, 0)

  if (total === 0) {
    return <p className="now-none">지금 바로 할 수 있는 학습코드가 없습니다. 리소스나 스펙이 들어오면 여기에 나옵니다.</p>
  }
  return (
    <section className="now-list">
      <h3>
        지금 바로 할 수 있는 학습코드 <strong>{total}</strong>개
      </h3>
      {groups.map((g) => (
        <div key={g.key} className={`now-group tone-${toneOf(g.status)}`}>
          <span className="now-title">
            {g.title} <b>{g.rows.length}</b>
          </span>
          <span className="now-codes">
            {g.rows.map((r) => (
              <button key={r.code} className="now-code" onClick={() => onOpen(r.code)} title={statusOf(r).next}>
                <span className="mono">{r.code}</span>
                <span className="now-module mono">{r.module || r.usedModule || ''}</span>
              </button>
            ))}
          </span>
        </div>
      ))}
    </section>
  )
}

export default NowList
