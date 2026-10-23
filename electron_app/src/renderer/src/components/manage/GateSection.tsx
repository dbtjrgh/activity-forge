import type { GateResult } from '../../../../shared/forge'
import { formatAgo } from '../../lib/format'

/**
 * 완성본 점검 칸 — 개발 완료를 전부 스펙 검사에 넣어 막는 에러가 난 것.
 * **고치는 단추는 없다.** 걸린 것은 대개 그 완성본 쪽 흠(없는 이름을 부름)이고, 남의 팀 저장소다.
 * 아래에는 스펙을 맞춘 뒤 바뀐 공용 모듈(`drift`)을 접어 둔다 (2026-10-14). 다시 재는 까닭(`stale`)은 안 보인다 — 저절로 다시 잰다.
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
        <p className="manage-ok">{gate.passed}개 모두 통과했습니다.</p>
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
      {gate.driftNote && <p className="sub">{gate.driftNote}</p>}
      {(gate.drift?.length ?? 0) > 0 && (
        <details className="manage-more">
          <summary>스펙을 맞춘 뒤 바뀐 모듈 {gate.drift?.length}개</summary>
          <ul className="manage-files">
            {gate.drift?.map((d) => (
              <li key={d.module}>
                <span className="mono">{d.module}</span> <span className="sub">{d.note}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {gate.unmeasured.length > 0 && (
        <details className="manage-more">
          <summary>점검하지 못한 항목 {gate.unmeasured.length}개</summary>
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
