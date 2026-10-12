import { STATUSES, statusOf, type BoardRow, type Status } from '../../../../shared/forge'

/**
 * **쌓은 막대 하나** — 이 호가 어디까지 왔나를 한눈에 (2026-09-28, M2).
 * 색만 다르고 글자는 아래 한 줄에 — 색을 못 가리는 사람도 읽게 수를 같이 적는다.
 */
function StatusBar({ rows }: { rows: BoardRow[] }) {
  const count = new Map<Status, number>()
  for (const r of rows) {
    const s = statusOf(r).status
    count.set(s, (count.get(s) ?? 0) + 1)
  }
  const shown = STATUSES.filter((s) => count.get(s.status))
  const total = rows.length || 1
  return (
    <div className="status-bar">
      <div className="status-track" role="img" aria-label={shown.map((s) => `${s.status} ${count.get(s.status)}`).join(', ')}>
        {shown.map((s) => (
          <span
            key={s.status}
            className={`seg tone-${s.tone}`}
            style={{ width: `${((count.get(s.status) ?? 0) / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="status-legend">
        {shown.map((s) => (
          <li key={s.status}>
            <span className={`dot tone-${s.tone}`} />
            {s.status} <strong>{count.get(s.status)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default StatusBar
