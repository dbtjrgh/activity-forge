import type { NeedRow } from '../../../shared/forge'
import { kindClass, kindName } from '../lib/format'
import GuideButton from './guide/GuideButton'

/**
 * 원본과 견준 모자란 것 — `Resource.tsx` 에서 떼어 냄.
 * **개수만 견준다.** 이름이 맞는지는 「양산」이 보므로 그렇다고 같이 적는다.
 */
function NeedCard({ code, need, needError }: { code: string; need: NeedRow[]; needError?: string }) {
  const short = need.filter((n) => n.here < n.origin)
  return (
    <section className="card">
      <h3>부족한 리소스</h3>
      {/* 양산의 첫 손 — figma 에서 무엇을 내보낼지. 원본이 있을 때만(없으면 창도 못 그린다) */}
      {!needError && need.length > 0 && (
        <GuideButton code={code} big short={short.reduce((a, n) => a + n.origin - n.here, 0)} />
      )}
      {needError ? (
        <p className="state warn">{needError}</p>
      ) : need.length === 0 ? (
        <p className="sub">비교할 원본이 없습니다.</p>
      ) : (
        <>
          <table className="need-table">
            <thead>
              <tr>
                <th>종류</th>
                <th>원본</th>
                <th>현재</th>
                <th>부족</th>
              </tr>
            </thead>
            <tbody>
              {need.map((n) => {
                const gap = n.origin - n.here
                return (
                  <tr key={n.kind}>
                    <td>
                      <span className={`kind-chip ${kindClass(n.kind)}`}>{kindName(n.kind)}</span>
                    </td>
                    <td className="num">{n.origin}</td>
                    <td className="num">{n.here}</td>
                    <td className="num">
                      {gap > 0 ? <span className="tag warn">{gap}</span> : <span className="muted">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="sub">
            {short.length === 0
              ? '개수는 다 찼습니다. 이름은 생성할 때 확인합니다.'
              : '개수만 비교합니다. 이름은 생성할 때 확인합니다.'}
          </p>
        </>
      )}
    </section>
  )
}

export default NeedCard
