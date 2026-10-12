import { useCallback, useEffect, useState } from 'react'
import type { BoardRow, LayoutAsk, LayoutAsks } from '../../../../shared/forge'

/**
 * **배치표가 갈린 칸 한 장** (2026-09-29, M7) — 진행판 위에서 칸마다 모듈을 고른다. 칸마다 작업대를 열지 않는다.
 *
 * - 후보는 앞선 호가 실제로 쓴 것뿐이다(작업대 모듈 카드와 같은 셈). **까닭을 적어야** 배치표에 남는다
 * - EN 은 앞선 호 같은 칸 기획서의 「호별 사용 유형」 쪽을 붙인다. 못 찾으면 그렇다고 적는다 — 짐작으로 고르지 않는다
 * - 메뉴 이름표(`ActivityData.ts`)를 한 줄로 보인다. 이름표를 고치는 것은 사람 몫이다
 */
export default function LayoutPicks({ subject, issue, rows, onChanged }: { subject: string; issue: string; rows: BoardRow[]; onChanged: () => void }) {
  // 이미 끝난 칸은 빼고 센다 — 판정만 갈림으로 남은 완성본(EN07 ENL2M07W3S3)이 섰다
  const split = rows.filter((r) => r.stage === '모듈 못 정함' && !r.work?.finished).length
  const [got, setGot] = useState<LayoutAsks | null>(null)

  const load = useCallback(async () => setGot(await window.api.forgeLayoutAsks({ subject, issue })), [subject, issue])
  useEffect(() => {
    if (split) void load()
    else setGot(null)
  }, [split, load])

  if (!split) return null
  const list = got?.rows ?? []
  // 칸마다 까닭이 같으면(9호 기획서가 아직 없음) 위에 한 번만 — 여덟 줄에 같은 글이 서면 안 읽힌다
  const whys = [...new Set(list.filter((r) => !r.plan).map((r) => r.planWhy))]
  const once = whys.length === 1 && list.every((r) => !r.plan) ? (whys[0] ?? '') : ''
  return (
    <details className="layout-picks card" open={split <= 8}>
      <summary>
        모듈 선택이 필요한 학습코드 <strong>{split}</strong>개
      </summary>
      {!got && <p className="sub">불러오는 중…</p>}
      {got?.error && <p className="state error">{got.error}</p>}
      {once && <p className="sub">{once}</p>}
      {list.map((r) => (
        <PickRow key={r.code} row={r} quiet={Boolean(once)} onPicked={() => void load().then(onChanged)} />
      ))}
    </details>
  )
}

function PickRow({ row, quiet, onPicked }: { row: LayoutAsk; quiet: boolean; onPicked: () => void }) {
  const [pick, setPick] = useState('')
  const [why, setWhy] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async (): Promise<void> => {
    setBusy(true)
    try {
      const r = await window.api.forgeLayoutPick(row.code, pick, why)
      setNote(r.note)
      if (r.ok) onPicked()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pick-row">
      <div className="pick-head">
        <span className="mono">{row.code}</span>
        {row.label && <span className="tag">{row.label}</span>}
        <span className="sub">{row.ask.desc}</span>
      </div>
      <div className="pick-body">
        <div className="pick-choose">
          {row.ask.options.map((o) => (
            <label key={o.value} className={pick === o.value ? 'on' : ''} title={o.why}>
              <input type="radio" name={row.code} checked={pick === o.value} onChange={() => setPick(o.value)} />
              <span className="mono">{o.value}</span> <span className="sub">{o.why}</span>
            </label>
          ))}
          <input className="pick-why" placeholder="선택 이유 (예: 기획서 '호별 사용 유형'에 09호 룰렛)" value={why} onChange={(e) => setWhy(e.target.value)} />
          <p className="row-actions">
            <button className="go" onClick={() => void send()} disabled={busy || !pick || !why.trim()}>
              배치표에 저장
            </button>
            {row.plan && (
              <button className="ghost" onClick={() => void window.api.openPath(row.plan?.file ?? '')}>
                기획서 열기
              </button>
            )}
            {note && <span className="sub">{note}</span>}
          </p>
        </div>
        {row.plan?.image ? (
          <figure className="pick-plan">
            <img src={row.plan.image} alt="" />
            <figcaption className="sub">기획서 {row.plan.page}쪽, 호별 사용 유형</figcaption>
          </figure>
        ) : quiet ? null : (
          <p className="sub pick-plan">{row.planWhy}</p>
        )}
      </div>
    </div>
  )
}
