import { useEffect, useState } from 'react'
import { CHAT_BASELINE, type RunRow } from '../../../../shared/forge'

/**
 * **학습코드별 기록** (2026-09-30, M9) — 사람 손 · AI 부름 · 값 · 캐시 읽기 · 걸린 때. 옆에 채팅 방식(8호 가운뎃값)을 둔다.
 * 「프로그램을 쓸 이유」를 숫자로 답하는 표다(`_document/차례표.md`). 읽기만 한다(`runtable.ts`).
 */
function mid(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2
}
const mega = (n: number | null): string => (n === null ? '—' : `${(n / 1_000_000).toFixed(1)}M`)
const mins = (s: number): string => (s < 60 ? `${s}초` : s < 3600 ? `${Math.round(s / 60)}분` : `${(s / 3600).toFixed(1)}시간`)

function RunTable({ subject, issue, refresh }: { subject: string; issue: string; refresh: unknown }) {
  const [rows, setRows] = useState<RunRow[]>([])
  useEffect(() => {
    let off = false
    void window.api.forgeRunTable({ subject, issue }).then((r) => !off && setRows(r))
    return () => {
      off = true
    }
  }, [subject, issue, refresh])
  if (!rows.length) return null
  const touch = mid(rows.map((r) => r.touches))
  const read = mid(rows.flatMap((r) => (r.cacheRead === null ? [] : [r.cacheRead])))
  return (
    <details className="skipped">
      <summary>
        학습코드별 기록 {rows.length}개 (중앙값: 수동 작업 {touch ?? '—'}회, 캐시 읽기 {mega(read)})
        <span className="sub"> (채팅 방식 8호: 수동 작업 {CHAT_BASELINE.touches}회, 캐시 읽기 {mega(CHAT_BASELINE.cacheRead)})</span>
      </summary>
      <table className="run-table">
        <thead>
          <tr>
            <th>학습코드</th>
            <th>수동 작업</th>
            <th>AI 호출</th>
            <th>비용</th>
            <th>캐시 읽기</th>
            <th title="처음 작업부터 마지막 작업까지의 기간입니다. 쉬는 날도 포함됩니다.">처음~마지막</th>
            <th>반영</th>
            <th>작업 내용</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td className="mono">{r.code}</td>
              <td>{r.touches}</td>
              <td>{r.calls ?? '—'}</td>
              <td>{r.cost === null ? '—' : `$${r.cost.toFixed(2)}`}</td>
              <td>{mega(r.cacheRead)}</td>
              <td>{mins(r.seconds)}</td>
              <td>{r.wrote ? '✓' : ''}</td>
              <td className="sub">{r.what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

export default RunTable
