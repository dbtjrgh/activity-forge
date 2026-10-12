import type { Prepare } from '../../../../shared/forge'
import type { Order } from '../../lib/benchorder'
import OrderBar from './OrderBar'

/**
 * 작업대 **머리줄과 작업 순서 막대** — `Bench.tsx` 에서 뗌 (2026-10-01, 200줄을 넘어서).
 * 머리줄은 어느 칸을 보든 늘 같은 자리 — 학습코드 · 모듈 · 원본.
 */
function BenchHead({
  data,
  busy,
  order,
  onBack,
  onReload
}: {
  data: Prepare
  busy: boolean
  order: Order
  onBack: () => void
  onReload: () => void
}) {
  const { layout } = data
  return (
    <>
      <header className="bench-head">
        <button className="ghost" onClick={onBack}>
          ← 진행판
        </button>
        <h2 className="mono">{data.code}</h2>
        <span className="bench-chips">
          {layout.module && <span className="tag">{layout.module}</span>}
          {layout.origin && <span className="sub mono">원본 {layout.origin}</span>}
        </span>
        <button className="ghost" onClick={onReload} disabled={busy}>
          {busy ? '불러오는 중' : '새로고침'}
        </button>
      </header>
      {data.error && <p className="state error">{data.error}</p>}
      <OrderBar order={order} />
    </>
  )
}

export default BenchHead
