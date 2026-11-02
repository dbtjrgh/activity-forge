import { useCallback, useRef, useState } from 'react'
import type { SortedInbox } from '../../../shared/forge'
import { TOUR_ANCHOR } from '../lib/anchors'

/**
 * **진행판의 기획서 놓는 칸** — 기획서 PDF 를 통째로 놓으면 1쪽을 읽어 학습코드마다 나눠 넣는다(`sortplan.ts`). 넣고 나면 진행판을 다시 읽는다.
 *
 * 2026-09-16 에 「놓는 자리는 한 곳」으로 리소스 · figma 화면 · 학습코드 폴더까지 받았는데(그때 이름 `RscSort.tsx`),
 * 이름에 학습코드가 없는 리소스와 영어가 아닌 figma 프레임은 거의 다 못 가렸다.
 * 2026-10-26 사용자 말로 기획서만 남겼다 — 「기획서는 뭐 보고 알아서 나눠서 넣어놓는건 ㅇㅈ … 대신 설명은 해놔야할듯」.
 * 그래서 무엇을 어디에 넣는지를 칸에 적어 둔다. 나머지는 작업대가 학습코드 하나씩 받는다.
 *
 * **못 가린 것은 감추지 않는다.** 안 넣고 왜 못 넣었는지 적는다 — 짐작해서 남의 학습코드에 넣는 것이 제일 나쁜 실패다.
 *
 * **진행판 결과 바깥에 둔다.** 안에 두면 다시 읽는 동안 `result` 가 잠깐 null 이라 칸이 통째로 사라지고,
 * 방금 넣은 결과와 「넣지 않은 파일」 목록이 같이 날아간다(2026-09-16 앱에서 드롭해 보고 찾음).
 */
function PlanSort({ onDone }: { onDone?: () => void }) {
  const [over, setOver] = useState(false)
  const [got, setGot] = useState<SortedInbox | null>(null)
  const [going, setGoing] = useState(false)
  // 덮어쓰기는 **같은 것을 다시 놓는 것**이라 방금 놓은 자리를 들고 있는다.
  const last = useRef<string[]>([])

  const send = useCallback(
    async (paths: string[], overwrite: boolean) => {
      if (!paths.length) return
      last.current = paths
      setGoing(true)
      try {
        const out = await window.api.forgeSort(paths, overwrite)
        setGot(out)
        if (out.papers.some((p) => p.file) && onDone) onDone()
      } finally {
        setGoing(false)
      }
    },
    [onDone]
  )

  const drop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setOver(false)
      if (going) return
      // **자리는 preload 에서만 얻는다.** Electron 32 부터 `File.path` 가 없어서 렌더러에서 읽으면 조용히 `undefined` 다.
      const paths = [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean)
      void send(paths, false)
    },
    [going, send]
  )

  // 공용 영어 기획서가 내용이 다른 것으로 이미 있을 때 — 그 까닭 글이 「덮어쓰기」를 부른다(`sortpaper.ts`)
  const replaceable = got?.ask.filter((a) => a.why.includes('「덮어쓰기」')).length ?? 0

  return (
    <div
      id={TOUR_ANCHOR.boardDrop}
      className={`drop${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <p className="drop-say">
        <span>{going ? '기획서를 읽는 중…' : '기획서 PDF를 여기에 놓으세요'}</span>
        {/* 수학 · 국어는 학습코드 리소스 폴더, 영어는 공용 기획서 폴더(`sortpaper.ts`). 누리 기획서와 리소스는 놓으면 결과 글이 작업대를 가리킨다 */}
        <span className="sub">수학, 영어, 국어 기획서를 학습코드마다 나눠 넣습니다.</span>
      </p>

      {got && (
        <div className="drop-out">
          {got.error ? (
            <p className="state error">{got.error}</p>
          ) : (
            <p className={`state ${got.papers.length ? 'done' : 'warn'}`}>{got.note}</p>
          )}

          {got.papers.length > 0 && (
            <details className="files" open>
              <summary>기획서 {got.papers.length}개</summary>
              <ul>
                {got.papers.map((p, i) => (
                  <li key={`${p.code}|${p.file}|${i}`}>
                    <span className="mono">{p.code || '공용'}</span>
                    <span className="sub">{p.note}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* 이름이 같은데 내용이 다른 것 — 덮어쓰기는 한 번 더 눌러야 한다 */}
          {replaceable > 0 && (
            <p className="row-actions">
              <button className="ghost danger" disabled={going} onClick={() => void send(last.current, true)}>
                덮어쓰기
              </button>
              <span className="sub">내용이 다른 기획서 {replaceable}개를 덮어씁니다. 기존 파일은 휴지통으로 옮깁니다.</span>
            </p>
          )}

          {/* 못 가린 것 — **묻는 자리다.** 짐작해서 넣지 않는다 */}
          {got.ask.length > 0 && (
            <details className="files" open>
              <summary>넣지 않은 기획서 {got.ask.length}개</summary>
              {/* 까닭이 같은 것은 한 번만 적는다 — 파일마다 같은 문장이 되풀이됐다 */}
              {[...new Set(got.ask.map((a) => a.why))].map((why) => (
                <div key={why}>
                  <p className="sub">{why}</p>
                  <ul>
                    {got.ask
                      .filter((a) => a.why === why)
                      .map((a) => (
                        <li key={a.from}>
                          <span className="mono">{a.name}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </details>
          )}

          {got.failed.length > 0 && (
            <details className="files" open>
              <summary>찾지 못한 것 {got.failed.length}개</summary>
              <ul>
                {got.failed.map((f) => (
                  <li key={f.from}>
                    <span className="mono">{f.name}</span>
                    <span className="sub error">{f.why}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

export default PlanSort
