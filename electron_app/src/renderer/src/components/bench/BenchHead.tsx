import { useEffect, useState } from 'react'
import type { HallFolder, Prepare } from '../../../../shared/forge'
import type { Order } from '../../lib/benchorder'
import OrderBar from './OrderBar'

/**
 * 작업대 **머리줄과 작업 순서 막대** — `Bench.tsx` 에서 뗌 (2026-10-01, 200줄을 넘어서).
 * 머리줄은 어느 칸을 보든 늘 같은 자리 — 학습코드 · 모듈 · 원본 · 폴더 열기.
 * 폴더 열기는 2026-10-20 사용자 말(「실제 리소스폴더랑 액티비티폴더 여는 버튼」, 「최상단 어디에 이쁘게」) — 리소스 폴더 · 호 저장소의 리소스 · 액티비티 폴더.
 */
function BenchHead({
  data,
  busy,
  order,
  onBack,
  onReload,
  onOpenRsc
}: {
  data: Prepare
  busy: boolean
  order: Order
  onBack: () => void
  onReload: () => void
  onOpenRsc: () => void
}) {
  const { layout, rsc } = data
  // 호 저장소 폴더를 못 열었을 때의 까닭 — 다시 읽거나(새로고침 · 다른 학습코드) 다른 단추를 누르면 지운다
  const [note, setNote] = useState('')
  useEffect(() => setNote(''), [data])
  // 리소스 자리를 안 정한 PC 는 리소스 폴더가 곧 호 저장소 `public/sparklab/<코드>` 다 — 같은 폴더 단추 둘을 안 보인다
  const inHall = /[\\/]public[\\/]sparklab[\\/][^\\/]+$/.test(rsc.dir)
  const openHall = async (kind: HallFolder, label: string): Promise<void> => {
    const r = await window.api.forgeHallFolder(data.code, kind)
    setNote(r.ok ? '' : `${label}: ${r.error}`)
  }
  const openRsc = (): void => {
    setNote('')
    onOpenRsc()
  }
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
        {/* 폴더 열기 — 리소스 폴더는 왼쪽 「리소스 폴더」 칸과 같은 길(없으면 만든다), 호 저장소 두 자리는 만들지 않는다 */}
        <span className="bench-folders">
          <button className="ghost" onClick={openRsc} title={rsc.dir}>
            {rsc.exists ? '리소스 폴더' : '리소스 폴더 만들기'}
          </button>
          {!inHall && (
            <button className="ghost" onClick={() => void openHall('public', '저장소 리소스 폴더')} title={`public/sparklab/${data.code}`}>
              저장소 리소스 폴더
            </button>
          )}
          <button className="ghost" onClick={() => void openHall('activity', '액티비티 폴더')} title={`src/activity/${data.code}`}>
            액티비티 폴더
          </button>
        </span>
        <button className="ghost" onClick={onReload} disabled={busy}>
          {busy ? '불러오는 중' : '새로고침'}
        </button>
      </header>
      {data.error && <p className="state error">{data.error}</p>}
      {note && <p className="state warn">{note}</p>}
      <OrderBar order={order} />
    </>
  )
}

export default BenchHead
