import { shownModule, statusOf, toneOf, type BoardRow } from '../../../../shared/forge'
import { deviceLine } from '../../lib/devices'
import { hoOfCode, vacationLine } from '../../lib/vacation'
import DeviceIcons from './DeviceIcons'
import './devices.css'

/**
 * **진행판 타일** (2026-09-28, M2). 표 여덟 칸 대신 칸 하나에 **상태 하나와 다음 할 일 한 마디.**
 *
 * 레벨마다 한 줄, 그 안에 주(W1~W4)마다 세 칸(S1~S3). 모듈 · 리소스 · 스펙은 올렸을 때만 보인다 —
 * 매일 보는 것은 「무엇을 해야 하나」다.
 */

const PLACE = /L(\d)M\d\dW(\d)S(\d)/

function tip(row: BoardRow): string {
  const w = row.work
  const parts = [row.code, shownModule(row) || '모듈 미정']
  // 다 만든 칸은 저장소 모듈을 적으므로 「후보 여러 개」를 안 붙인다
  if (row.verdict === '갈림' && row.work?.finished !== true) parts.push('모듈 후보 여러 개')
  parts.push(row.files ? `리소스 ${row.files}개` : '리소스 없음')
  if (w?.needsShot) parts.push(w.shots ? `화면 ${w.shots}장` : '화면 없음')
  // 대화로 만들기에 든 금액 — 작업대 가운데(`ChatFlow`)와 같은 꼴로 (2026-10-08, 옛 「AI 소요」는 이전 방식 기록이라 걷었다)
  if (w?.chat && w.chat.cost > 0) parts.push(`대화 비용 $${w.chat.cost.toFixed(2)}`)
  // 작업대를 열 때 읽어 둔 기획서 1쪽 모듈넘버가 배치표와 다르다(`planmodule.ts`) — 바꾸는 것은 작업대에서
  if (w?.planModule) parts.push(`배치표와 다른 기획서 모듈넘버 ${w.planModule}`)
  // 방학호와 리소스가 거의 다 같은 짝(`_layout/vacation.json`)
  for (const l of w?.vacation ?? []) parts.push(vacationLine(l))
  // 학습할 때 켜는 카메라 · 마이크(`services/forge/devices.ts`)
  if (w?.devices) parts.push(deviceLine(w.devices))
  return parts.join(', ')
}

/**
 * 칸 아래의 모듈 이름 — 모듈을 못 정한 칸도 같은 자리에 까닭을 적는다.
 * 개발 완료 칸은 저장소의 실제 모듈, 아니면 배치표 판정(`shownModule`)
 */
const moduleOf = (row: BoardRow): string => {
  const shown = shownModule(row)
  if (shown) return shown
  // 다 만든 칸인데 모듈이 없으면 공용 모듈 없이 따로 짠 액티비티다(EN 1호 L3W4S1 이 그렇다)
  if (row.work?.finished) return '모듈 사용 안 함'
  return row.verdict === '갈림' ? '모듈 후보 여러 개' : '모듈 미정'
}

function Tile({ row, onOpen }: { row: BoardRow; onOpen: (code: string) => void }) {
  const { status, next } = statusOf(row)
  const vac = row.work?.vacation ?? []
  return (
    <button className={`tile tone-${toneOf(status)}`} onClick={() => onOpen(row.code)} title={tip(row)}>
      {/* 방학호 짝이 있는 칸 — 위 테두리에 상대 호 이름(1~5호 칸은 「6호(방학)」, 방학호 칸은 가져온 호). 학습코드 · 비율은 툴팁과 위 목록에 */}
      {vac.length > 0 && <span className="tile-badge tile-vac">{hoOfCode(vac[0].code)}</span>}
      {/* 학습할 때 켜는 카메라 · 마이크 — 아래 테두리 왼쪽에 그림으로(칸이 좁아 글자 대신, 위는 방학호 딱지 자리) */}
      {row.work?.devices && (
        <span className="tile-badge tile-dev">
          <DeviceIcons devices={row.work.devices} />
        </span>
      )}
      {/* 학습코드를 줄이지 않는다 (2026-09-29 사용자 말 — 「헷갈리게 줄여 놓지 마」). 전에는 W1·S1 만 보였다 */}
      <span className="tile-place mono">{row.code}</span>
      <span className="tile-status">
        <span className="dot" />
        {status}
      </span>
      {/* 다음 할 일이 없는 칸도 줄을 비워 둔다 — 모듈 이름이 모든 칸에서 같은 높이에 오게 (2026-10-01 사용자 말) */}
      <span className="tile-next">{next || ' '}</span>
      {/* 고정폭 글꼴은 모듈 이름에만 — 한국어 안내(모듈 미정 등)는 글자 사이가 벌어진다 */}
      <span className={`tile-module${shownModule(row) ? ' mono' : ''}${row.work?.planModule ? ' tile-module-plan' : ''}`}>{moduleOf(row)}</span>
    </button>
  )
}

function Tiles({ rows, onOpen }: { rows: BoardRow[]; onOpen: (code: string) => void }) {
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
                  <Tile key={r.slot + r.code} row={r} onOpen={onOpen} />
                ))}
            </div>
          </section>
        ))}
    </div>
  )
}

export default Tiles
