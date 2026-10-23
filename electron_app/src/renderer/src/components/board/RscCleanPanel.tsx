import { useCallback, useEffect, useState } from 'react'
import { rscCleanKeys, type RscCleanAll, type RscCleanAllDone } from '../../../../shared/forge'
import { formatBytes } from '../../lib/format'

/**
 * **「리소스 폴더 정리」 펼친 칸** (2026-10-14, `rsccleanall.ts`) — 작업대 검수 칸에 학습코드마다 있던 단추(2026-10-12)를 진행판으로 모았다.
 * 열리면 정리할 수 있는 학습코드와 옮길 크기를 보이고, 못 하는 학습코드는 까닭과 함께 접어 둔다.
 * 「휴지통으로 옮기기」가 두 번째 누름이다 — 메인은 학습코드마다 다시 재고 여기 보인 항목만 옮긴다.
 */
const sizeOf = (entries: { size: number }[]): number => entries.reduce((n, e) => n + e.size, 0)

export default function RscCleanPanel({ onBusy, onClose }: { onBusy: (on: boolean) => void; onClose: () => void }) {
  const [plan, setPlan] = useState<RscCleanAll | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<RscCleanAllDone | null>(null)

  useEffect(() => {
    let off = false
    void window.api.forgeRscCleanAll().then((p) => !off && setPlan(p))
    return () => {
      off = true
    }
  }, [])

  const run = useCallback(async () => {
    if (!plan) return
    setBusy(true)
    onBusy(true)
    try {
      setDone(await window.api.forgeRscCleanAllRun(rscCleanKeys(plan)))
    } finally {
      setBusy(false)
      onBusy(false)
    }
  }, [plan, onBusy])

  if (!plan) {
    return (
      <div className="board-top-panel">
        <p className="state">리소스 폴더를 확인하는 중입니다.</p>
      </div>
    )
  }
  const total = plan.ready.reduce((n, r) => n + sizeOf(r.entries), 0)
  const moved = done?.rows.reduce((n, r) => n + r.moved, 0) ?? 0
  const failed = done?.rows.filter((r) => r.error || r.failed.length) ?? []
  return (
    <div className="board-top-panel">
      <p className="board-top-title">리소스 폴더 정리</p>
      {plan.error && <p className="state error">{plan.error}</p>}
      {!plan.error && !done && (
        <>
          {plan.ready.length ? (
            <>
              <p className="board-top-group">
                정리할 수 있는 학습코드 {plan.ready.length}개, 모두 {formatBytes(total)}
              </p>
              <ul className="board-top-list">
                {plan.ready.map((r) => (
                  <li key={r.code}>
                    <span className="mono">{r.code}</span>{' '}
                    <span className="sub">
                      {r.entries.length}개, {formatBytes(sizeOf(r.entries))}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="state">지금 정리할 수 있는 학습코드가 없습니다.</p>
          )}
          {/* 비어 있는 까닭 — 다 정리해서 비었으면 그렇다고 말한다 */}
          {!plan.ready.length && plan.clean > 0 && <p className="sub">이미 정리한 학습코드 {plan.clean}개는 목록에서 뺐습니다.</p>}
          {plan.blocked.length > 0 && (
            <details className="board-top-more">
              <summary>정리할 수 없는 학습코드 {plan.blocked.length}개</summary>
              <ul className="board-top-list board-top-skip">
                {plan.blocked.map((b) => (
                  <li key={b.code}>
                    <span className="mono">{b.code}</span> <span className="sub">{b.why}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {plan.ready.length > 0 && <p className="board-top-hint">영어만 기획서(_plan)를 남기고, 정리한 뒤 다시 만들려면 리소스와 기획서를 다시 넣어야 합니다.</p>}
        </>
      )}
      {done?.error && <p className="state error">{done.error}</p>}
      {done && !done.error && (
        <p className="state done">
          학습코드 {done.rows.length}개에서 {moved}개를 휴지통으로 옮겼습니다.
        </p>
      )}
      {failed.length > 0 && (
        <ul className="board-top-list board-top-skip">
          {failed.map((r) => (
            <li key={r.code}>
              <span className="mono">{r.code}</span>{' '}
              <span className="sub">{r.error ?? `옮기지 못한 것 ${r.failed.length}개: ${r.failed.map((f) => `${f.rel}(${f.why})`).join(', ')}`}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="board-top-actions">
        {!done && (
          <button className="go" disabled={busy || !plan.ready.length} onClick={() => void run()}>
            {busy ? '옮기는 중…' : '휴지통으로 옮기기'}
          </button>
        )}
        <button className="ghost" disabled={busy} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
