import { statusOf, type BoardResult } from '../../../shared/forge'
import { TOUR_ANCHOR } from '../lib/anchors'
import LayoutPicks from './board/LayoutPicks'
import NowList from './board/NowList'
import RunTable from './board/RunTable'
import StatusBar from './board/StatusBar'
import Tiles from './board/Tiles'
import VacationList from './board/VacationList'
import './board/board.css'

/**
 * 진행판 — **한 호가 어디까지 왔나와, 다음에 무엇을 해야 하나** (2026-09-28, M2 에서 표를 타일로).
 *
 * 전에는 표 여덟 칸(차시 · 학습코드 · 모듈 · 스펙 · 리소스 · 상태 · 만든 때 · 단추)이었다. 매일 보는 것은
 * 「무엇을 해야 하나」라서, 칸마다 상태 하나와 다음 할 일 한 마디만 남기고 나머지는 올렸을 때 보인다.
 * 상태 이름은 `shared/forge/status.ts` 한 표를 쓴다.
 */
function Board({
  result,
  onForge,
  onChanged
}: {
  result: BoardResult
  onForge: (code: string) => void
  /** 칸의 형편이 바뀌었다(배치표를 골랐다) — 진행판을 다시 읽는다 */
  onChanged: () => void
}) {
  const done = result.rows.filter((r) => statusOf(r).status === '개발 완료').length

  return (
    <div className="board">
      <div className="board-head">
        <h2>
          {result.subject}
          {result.issue}
        </h2>
        {result.rows.length > 0 && (
          <p className="count">
            개발 완료 <strong>{done}</strong> / {result.rows.length}
            {result.skipped.slots.length > 0 && `, 제외 ${result.skipped.slots.length}`}
          </p>
        )}
      </div>

      {result.error && <p className="state error">{result.error}</p>}

      {result.rows.length > 0 && (
        <>
          <StatusBar rows={result.rows} />
          {done < result.rows.length && <NowList rows={result.rows} onOpen={onForge} />}
          <LayoutPicks subject={result.subject} issue={result.issue} rows={result.rows} onChanged={onChanged} />
          {/* 방학호와 리소스가 거의 다 같은 짝 — 1~5호 · 6호(방학)에만 있다 */}
          <VacationList rows={result.rows} onOpen={onForge} />
          <div id={TOUR_ANCHOR.boardTiles}>
            <Tiles rows={result.rows} onOpen={onForge} />
          </div>
          <RunTable subject={result.subject} issue={result.issue} refresh={result.rows} />

          {result.skipped.slots.length > 0 && (
            <details className="skipped">
              <summary>
                이번 호에서 제외된 학습코드 {result.skipped.slots.length}개
                {result.skipped.note && ` (${result.skipped.note})`}
              </summary>
              <ul>
                {result.skipped.slots.map((s) => (
                  <li key={s.slot}>
                    <span className="mono">{s.slot}</span> {s.why}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}

export default Board
