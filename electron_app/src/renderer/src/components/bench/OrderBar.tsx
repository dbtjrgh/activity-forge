import { useEffect } from 'react'
import type { Order } from '../../lib/benchorder'
import { spot } from '../../lib/spot'
import './orderbar.css'

const MARK = { done: '✓', now: '●', run: '…', todo: '' } as const

/**
 * **작업 순서 막대** (2026-10-01) — 작업대 맨 위. 끝난 단계는 초록, 지금 할 단계 하나만 강조하고 그 칸에도 테두리를 둔다.
 * 단계를 누르면 그 칸으로 가서 빛나고, 입력 칸이 있으면 커서가 간다(`lib/spot.ts`). 셈은 `lib/benchorder.ts`.
 */
function OrderBar({ order }: { order: Order }) {
  // 지금 할 일의 칸에 계속 테두리 — 막대만 강조하면 그 칸이 화면 어디인지 다시 찾아야 한다
  useEffect(() => {
    const el = order.target ? document.getElementById(order.target) : null
    el?.classList.add('spot-now')
    return () => el?.classList.remove('spot-now')
  }, [order.target])

  return (
    <div className={`order-bar${order.blocked ? ' blocked' : ''}`}>
      {order.steps.length > 0 && (
        <ol className="order-steps">
          {order.steps.map((s, i) => (
            <li key={s.key}>
              <button className={`order-step ${s.state}`} onClick={() => spot(s.target)} title="눌러서 해당 칸으로 이동">
                <span className="order-mark">{MARK[s.state] || i + 1}</span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      )}
      <button className="order-say" onClick={() => order.target && spot(order.target)} disabled={!order.target}>
        <b>
          {order.blocked
            ? '진행할 수 없음'
            : order.steps.some((s) => s.state === 'run')
              ? '진행 중'
              : order.target
                ? '지금 할 일'
                : '완료'}
        </b>{' '}
        {order.say}
      </button>
    </div>
  )
}

export default OrderBar
