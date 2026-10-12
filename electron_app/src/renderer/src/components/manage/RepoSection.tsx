import { HO_OF, hoOrder, type HallRepo, type HallStatus } from '../../../../shared/forge'
import { formatAgo } from '../../lib/format'

/** 손볼 것이 있나 — 커밋 안 한 파일 · 뒤처짐 · 안 올린 커밋 · 못 읽음 */
export function repoTrouble(r: HallRepo): 'fail' | 'warn' | null {
  if (r.error || r.behind) return 'fail'
  if (r.dirty || r.ahead) return 'warn'
  return null
}

function remote(r: HallRepo): string {
  if (r.ahead === null || r.behind === null) return '원격 없음'
  if (!r.ahead && !r.behind) return '최신'
  return [r.behind ? `${r.behind}개 뒤처짐` : '', r.ahead ? `푸시 안 한 커밋 ${r.ahead}개` : ''].filter(Boolean).join(', ')
}

/** 호 저장소 칸 — 손볼 것이 위, 나머지는 접어 둔다 */
function RepoSection({ status }: { status: HallStatus | null }) {
  if (!status) return <p className="state">호 저장소를 불러오는 중…</p>
  if (status.error) return <p className="state error">{status.error}</p>
  const repos = [...status.repos].sort((a, b) => hoOrder(a.month) - hoOrder(b.month))
  const bad = repos.filter(repoTrouble)
  const good = repos.filter((r) => !repoTrouble(r))
  const row = (r: HallRepo) => (
    <tr key={r.name}>
      <td>
        <span className={`dot ${repoTrouble(r) ?? 'ok'}`} />
        <b>{HO_OF[r.month]?.name ?? `M${r.month}`}</b> <span className="mono sub">{r.name}</span>
      </td>
      <td className="mono">{r.branch ?? '—'}</td>
      <td className={r.dirty ? 'warn' : ''}>{r.dirty === null ? '—' : r.dirty ? `${r.dirty}개` : '없음'}</td>
      <td className={r.behind ? 'fail' : r.ahead ? 'warn' : ''}>{r.error ? '—' : remote(r)}</td>
      <td className="sub" title={r.last?.subject}>
        {r.error ?? (r.last ? `${r.last.subject} (${formatAgo(r.last.at)})` : '—')}
      </td>
      <td className="sub">{formatAgo(r.synced)}</td>
    </tr>
  )
  const head = (
    <thead>
      <tr>
        <th>호</th>
        <th>브랜치</th>
        <th>커밋하지 않은 파일</th>
        <th title="마지막 fetch 시점 기준입니다. 앱은 fetch하지 않습니다.">원격</th>
        <th>마지막 커밋</th>
        <th>마지막 fetch</th>
      </tr>
    </thead>
  )
  return (
    <>
      {bad.length === 0 ? (
        <p className="manage-ok">저장소 {status.repos.length}개 모두 정상입니다. 커밋하지 않은 파일이나 원격과 다른 커밋이 없습니다.</p>
      ) : (
        <table className="run-table manage-table">
          {head}
          <tbody>{bad.map(row)}</tbody>
        </table>
      )}
      {good.length > 0 && (
        <details className="manage-more">
          <summary>정상 저장소 {good.length}개</summary>
          <table className="run-table manage-table">
            {head}
            <tbody>{good.map(row)}</tbody>
          </table>
        </details>
      )}
      <p className="sub">앱은 fetch하지 않습니다. 「원격」은 마지막 fetch 시점 기준입니다.</p>
    </>
  )
}

export default RepoSection
