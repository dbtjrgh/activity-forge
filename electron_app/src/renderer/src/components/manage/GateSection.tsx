import type { GateResult } from '../../../../shared/forge'
import { formatAgo } from '../../lib/format'

/**
 * 완성본 점검 칸 — 개발 완료를 전부 스펙 검사에 넣어 막는 에러가 난 것.
 * **고치는 단추는 없다.** 걸린 것은 대개 그 완성본 쪽 흠(없는 이름을 부름)이고, 남의 팀 저장소다.
 */
function GateSection({ gate, measuring, onMeasure }: { gate: GateResult | null; measuring: boolean; onMeasure: () => void }) {
  if (!gate) return <p className="state">지난 결과를 불러오는 중…</p>
  const bar = (
    <div className="manage-bar">
      <span className="sub">
        {gate.at
          ? `${formatAgo(gate.at)} 점검, 개발 완료 ${gate.finished}개, ${(gate.took / 1000).toFixed(1)}초 소요`
          : '아직 점검한 적이 없습니다.'}
      </span>
      <button className="ghost" disabled={measuring} onClick={onMeasure}>
        {measuring ? '점검 중…' : gate.at ? '다시 점검' : '점검'}
      </button>
    </div>
  )
  if (gate.error) {
    return (
      <>
        {bar}
        <p className="state error">{gate.error}</p>
      </>
    )
  }
  if (!gate.at) return bar
  return (
    <>
      {bar}
      {gate.failed.length === 0 ? (
        <p className="manage-ok">점검한 {gate.passed}개가 모두 스펙을 통과했습니다.</p>
      ) : (
        <table className="run-table manage-table">
          <thead>
            <tr>
              <th>학습코드</th>
              <th>모듈</th>
              <th>팀</th>
              <th>에러</th>
              <th>문제 항목</th>
            </tr>
          </thead>
          <tbody>
            {gate.failed.map((r) => (
              <tr key={r.code}>
                <td className="mono">{r.code}</td>
                <td>{r.module}</td>
                <td>{r.team || '—'}</td>
                <td className="fail">{r.count}</td>
                <td className="mono sub manage-wrap">{r.issues.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {gate.unmeasured.length > 0 && (
        <details className="manage-more">
          <summary>점검하지 못한 항목 {gate.unmeasured.length}개 (스펙이 없거나 모듈을 읽지 못함)</summary>
          <ul className="manage-files">
            {gate.unmeasured.map((u) => (
              <li key={u.code}>
                <span className="mono">{u.code}</span> <span className="sub">{u.why.slice(0, 120)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

export default GateSection
