import { statusOf, toneOf, type BoardRow } from '../../../../shared/forge'

/**
 * **진행판 타일** (2026-09-28, M2). 표 여덟 칸 대신 칸 하나에 **상태 하나와 다음 할 일 한 마디.**
 *
 * 레벨마다 한 줄, 그 안에 주(W1~W4)마다 세 칸(S1~S3). 모듈 · 리소스 · 스펙은 올렸을 때만 보인다 —
 * 매일 보는 것은 「무엇을 해야 하나」다.
 */

const PLACE = /L(\d)M\d\dW(\d)S(\d)/

function tip(row: BoardRow): string {
  const w = row.work
  const parts = [row.code, row.module || '모듈 미정']
  if (row.verdict === '갈림') parts.push('모듈 후보 여러 개')
  parts.push(row.files ? `리소스 ${row.files}개` : '리소스 없음')
  if (w?.needsShot) parts.push(w.shots ? `화면 ${w.shots}장` : '화면 없음')
  // 대화로 만들기에 든 금액 — 작업대 가운데(`ChatFlow`)와 같은 꼴로 (2026-10-08, 옛 「AI 소요」는 이전 방식 기록이라 걷었다)
  if (w?.chat && w.chat.cost > 0) parts.push(`대화 비용 $${w.chat.cost.toFixed(2)}`)
  return parts.join(', ')
}

/**
 * 칸 아래의 모듈 이름 — 모듈을 못 정한 칸도 같은 자리에 까닭을 적는다.
 * 배치표 판정이 먼저고, 없으면 저장소에 있는 액티비티가 쓰는 모듈(첫 호는 앞선 호가 없어 판정이 빈다)
 */
const moduleOf = (row: BoardRow): string => {
  if (row.module || row.usedModule) return row.module || row.usedModule || ''
  // 다 만든 칸인데 모듈이 없으면 공용 모듈 없이 따로 짠 액티비티다(EN 1호 L3W4S1 이 그렇다)
  if (row.work?.finished) return '모듈 사용 안 함'
  return row.verdict === '갈림' ? '모듈 후보 여러 개' : '모듈 미정'
}

function Tile({ row, onOpen, picked }: { row: BoardRow; onOpen: (code: string) => void; picked: boolean }) {
  const { status, next } = statusOf(row)
  return (
    <button className={`tile tone-${toneOf(status)}${picked ? ' picked' : ''}`} onClick={() => onOpen(row.code)} title={tip(row)}>
      {/* 학습코드를 줄이지 않는다 (2026-09-29 사용자 말 — 「헷갈리게 줄여 놓지 마」). 전에는 W1·S1 만 보였다 */}
      <span className="tile-place mono">{row.code}</span>
      <span className="tile-status">
        <span className="dot" />
        {status}
      </span>
      {/* 다음 할 일이 없는 칸도 줄을 비워 둔다 — 모듈 이름이 모든 칸에서 같은 높이에 오게 (2026-10-01 사용자 말) */}
      <span className="tile-next">{next || ' '}</span>
      {/* 고정폭 글꼴은 모듈 이름에만 — 한국어 안내(모듈 미정 등)는 글자 사이가 벌어진다 */}
      <span className={`tile-module${row.module || row.usedModule ? ' mono' : ''}`}>{moduleOf(row)}</span>
    </button>
  )
}

/** `picked` — 화면 모으기에서 고른 칸(M5, `ShotRound.tsx`). 그때는 `onOpen` 이 고르기다 */
function Tiles({ rows, onOpen, picked = null }: { rows: BoardRow[]; onOpen: (code: string) => void; picked?: string | null }) {
  const levels = new Map<string, BoardRow[]>()
  for (const r of rows) {
    const lv = PLACE.exec(r.code)?.[1] ?? '?'
    levels.set(lv, [...(levels.get(lv) ?? []), r])
  }
  return (
    <div className="tiles">
      {[...levels.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([lv, list]) => (
          <section key={lv} className="tile-level">
            <h3>Lv{lv}</h3>
            <div className="tile-grid">
              {list
                .slice()
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((r) => (
                  <Tile key={r.slot + r.code} row={r} onOpen={onOpen} picked={picked === r.code} />
                ))}
            </div>
          </section>
        ))}
    </div>
  )
}

export default Tiles
