import { useEffect, useState } from 'react'
import { HO_OF, type RscWait, type RscWaitRow } from '../../../../shared/forge'
import { kindClass, kindName } from '../../lib/format'
import CopyButton from '../CopyButton'
import GuideButton from '../guide/GuideButton'

/** 한 갈래의 이름표 — 영상은 서비스가 `video` 로 따로 모아 준다 */
const label = (kind: string): string => (kind === 'video' ? '영상' : kindName(kind))
const hoName = (m: string): string => HO_OF[m]?.name ?? `M${m}`

/** 더 받아야 할 파일 수 — 원본 수에서 지금 수를 뺀 것 */
export const fileCount = (r: RscWaitRow): number => r.missing.reduce((a, m) => a + (m.origin - m.here), 0)

const KIND_ORDER = ['video', 'image', 'sound', 'lottie', 'font']

/** 호 전체의 갈래별 합 — 디자인 쪽에 일감 크기를 먼저 알린다 */
function totals(rows: RscWaitRow[]): { kind: string; n: number }[] {
  const sum = new Map<string, number>()
  for (const r of rows) for (const m of r.missing) sum.set(m.kind, (sum.get(m.kind) ?? 0) + m.origin - m.here)
  const rank = (k: string): number => (KIND_ORDER.includes(k) ? KIND_ORDER.indexOf(k) : KIND_ORDER.length)
  return [...sum].map(([kind, n]) => ({ kind, n })).sort((a, b) => rank(a.kind) - rank(b.kind))
}
const totalLine = (rows: RscWaitRow[]): string => totals(rows).map((t) => `${label(t.kind)} ${t.n}`).join(', ')

/** 디자인 쪽에 보낼 글 — 학습코드마다 갈래별로. 이름은 원본이 쓰던 것(다르게 와도 된다). 여러 칸이면 맨 위에 합 한 줄 */
function asText(rows: RscWaitRow[], head?: string): string {
  const body = rows
    .filter((r) => r.missing.length)
    .map((r) =>
      [
        `${r.code} (${r.module})`,
        ...r.missing.map((m) => `- ${label(m.kind)} ${m.origin - m.here}개${m.files.length ? `: ${m.files.join(', ')}` : ''}`)
      ].join('\n')
    )
    .join('\n\n')
  return head ? `${head} (${totalLine(rows)})\n\n${body}` : body
}

/** 덜 온 칸 한 장 — 갈래마다 「지금 / 원본」과 원본 이름으로 없는 것 */
function PartCard({ r }: { r: RscWaitRow }) {
  return (
    <div className="manage-card">
      <div className="manage-card-head">
        <b className="mono">{r.code}</b>
        <span className="sub">{r.module}</span>
        <span className="manage-grow" />
        {!r.error && <GuideButton code={r.code} />}
        {r.missing.length > 0 && <CopyButton text={asText([r])}>복사</CopyButton>}
      </div>
      {r.error ? (
        <p className="state error">{r.error}</p>
      ) : (
        <ul className="manage-files">
          {r.missing.map((m) => (
            <li key={m.kind}>
              <span className={`manage-kind ${kindClass(m.kind)}`}>
                {label(m.kind)} {m.here}/{m.origin}
              </span>
              <span className="mono sub">{m.files.length ? m.files.join(', ') : '이름이 다른 파일로 들어왔습니다. 개수만 부족합니다.'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * 받을 리소스 칸 — 고른 호에서 **덜 온 칸**(카드)과 **하나도 안 온 칸**(한 줄씩). 덜 온 칸이 먼저 할 일이다.
 * 호 단추는 **다시 읽는 동안에도 남긴다** — 누르자마자 사라지면 무엇을 눌렀는지 안 보인다.
 */
function RscSection({ wait, onMonth }: { wait: RscWait | null; onMonth: (month: string) => void }) {
  const [shown, setShown] = useState<{
    months: string[]
    month: string | null
  }>({ months: [], month: null })
  useEffect(() => {
    if (wait) setShown({ months: wait.months, month: wait.month })
  }, [wait])
  const chips = shown.months.length > 1 && (
    <span className="manage-chips">
      {shown.months.map((m) => (
        <button
          key={m}
          className={`ghost${m === shown.month ? ' on' : ''}`}
          disabled={!wait}
          onClick={() => {
            setShown((s) => ({ ...s, month: m }))
            onMonth(m)
          }}
        >
          {hoName(m)}
        </button>
      ))}
    </span>
  )
  const bar = (note: React.ReactNode, copy?: RscWaitRow[]) => (
    <div className="manage-bar">
      {chips}
      {note}
      <span className="manage-grow" />
      {copy && copy.length > 0 && <CopyButton text={asText(copy, `${wait?.month ? hoName(wait.month) : ''} 받을 리소스 (학습코드 ${copy.length}개)`)}>전체 복사</CopyButton>}
    </div>
  )
  if (!wait) return bar(<span className="state">진행판을 불러오는 중… (몇 초 걸립니다)</span>)
  if (wait.error) return <p className="state error">{wait.error}</p>
  if (!wait.month) return <p className="manage-ok">진행 중인 호가 없습니다.</p>
  const ho = hoName(wait.month)
  if (!wait.rows.length) return bar(<span className="manage-ok">{ho}에 리소스를 기다리는 학습코드가 없습니다.</span>)
  const part = wait.rows.filter((r) => !r.empty)
  const empty = wait.rows.filter((r) => r.empty)
  return (
    <>
      {bar(
        <span className="sub">
          {ho}: 일부 수신 {part.length}개, 미수신 {empty.length}개
        </span>,
        wait.rows
      )}
      {/* 호 전체의 갈래별 합 — 칸마다 보기 전에 일감 크기부터 */}
      <div className="manage-totals">
        <span className="sub">이 호 전체 합계</span>
        {totals(wait.rows).map((t) => (
          <span key={t.kind} className={`manage-kind ${kindClass(t.kind)}`}>
            {label(t.kind)} {t.n}
          </span>
        ))}
      </div>
      {part.length > 0 && (
        <div className="manage-cards">
          {part.map((r) => (
            <PartCard key={r.code} r={r} />
          ))}
        </div>
      )}
      {empty.length > 0 && (
        <details className="manage-more" open={part.length === 0}>
          <summary>미수신 학습코드 {empty.length}개 (원본 기준 개수)</summary>
          <table className="run-table manage-table">
            <tbody>
              {empty.map((r) => (
                <tr key={r.code}>
                  <td className="mono">{r.code}</td>
                  <td className="sub">{r.module}</td>
                  <td className="sub manage-wrap">
                    {r.error ?? r.missing.map((m) => `${label(m.kind)} ${m.origin - m.here}`).join(', ')}
                  </td>
                  <td>{!r.error && <GuideButton code={r.code} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <p className="sub">파일 이름은 원본 기준입니다. 이름이 달라도 작업대에서 자동으로 맞춥니다.</p>
    </>
  )
}

export default RscSection
