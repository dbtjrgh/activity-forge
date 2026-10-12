import { useCallback, useRef, useState } from 'react'
import type { SortedInbox } from '../../../shared/forge'

/**
 * **놓는 자리는 한 곳** — 통째로 놓으면 도구가 차시별로 가른다 (2026-09-16).
 *
 * 옆의 `RscDrop` 은 **차시 화면마다** 있는 받이라, 사람이 먼저 차시를 고르고
 * 놓아야 했다. 디자이너가 주는 것은 한 차시가 아니라 한 묶음이므로, 그걸
 * 차시 수만큼 나눠 놓는 일이 사람 몫으로 남아 있었다.
 *
 * 여기는 **진행판에 하나만** 있다. 받은 것을 통째로 놓으면 된다.
 * 어느 차시인지는 폴더 이름과 파일 이름에서 도구가 가린다(`sort.ts`).
 *
 * **못 가린 것은 감추지 않는다.** 안 넣고 왜 못 넣었는지 적는다 — 짐작해서
 * 남의 차시에 남의 파일을 넣는 것이 제일 나쁜 실패다.
 *
 * **여기가 잘하는 것은 이름에 학습코드가 든 것이다** (2026-09-29 사용자와 정함) — 기획서(1쪽 제목) · figma 화면(프레임 이름) ·
 * 학습코드 폴더. figma 에서 받은 `Mask group (2).png` 같은 낱개 리소스는 여기서 못 가리니 작업대로 보낸다고 적는다.
 * 여기서 학습코드를 골라 넣는 칸도 만들어 봤다가 걷었다 — 그 일은 작업대가 이미 한다.
 */
function RscSort({ onDone }: { onDone?: () => void }) {
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
        if (out.lessons.length && onDone) onDone()
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
      // **자리는 preload 에서만 얻는다.** Electron 32 부터 `File.path` 가
      // 없어서 렌더러에서 읽으면 조용히 `undefined` 다.
      const paths = [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean)
      void send(paths, false)
    },
    [going, send]
  )

  const clash = got?.lessons.flatMap((l) => l.result.clash) ?? []
  // 공용 EN 기획서가 판이 다른 것으로 이미 있을 때 — 그 까닭 글이 「덮어쓰기」를 부른다(`sortpaper.ts`)
  const replaceable = got?.ask.filter((a) => a.why.includes('「덮어쓰기」')).length ?? 0

  return (
    <div
      className={`drop${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <p className="drop-say">
        {going ? '분류하는 중…' : '기획서, figma 화면, 학습코드 폴더를 여기에 놓으세요'}
        <span className="sub">
          학습코드별로 나눠 넣습니다. 이름에 학습코드가 없는 리소스는 해당 학습코드의 작업대에 넣으세요.
        </span>
      </p>

      {got && (
        <div className="drop-out">
          {got.error ? (
            <p className="state error">{got.error}</p>
          ) : (
            <p className={`state ${got.lessons.length || got.papers.length ? 'done' : 'warn'}`}>{got.note}</p>
          )}

          {/* figma 화면 · 기획서 — 프레임 이름 · 1쪽 제목으로 가려 제 자리에 넣은 것 (M5, `sortpaper.ts`) */}
          {got.papers.length > 0 && (
            <details className="files" open>
              <summary>figma 화면과 기획서 {got.papers.length}개</summary>
              <ul>
                {got.papers.map((p, i) => (
                  <li key={`${p.code}|${p.file}|${i}`}>
                    <span className="tag">{p.kind === 'figma' ? 'figma 화면' : '기획서'}</span>
                    <span className="mono">{p.code || '공용'}</span>
                    <span className="sub">{p.note}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {got.lessons.length > 0 && (
            <details className="files" open>
              <summary>학습코드 {got.lessons.length}개</summary>
              <ul>
                {got.lessons.map((l) => (
                  <li key={l.code}>
                    <span className="mono">{l.code}</span>
                    <span className="sub">
                      {l.result.took.length}개 넣음
                      {l.result.same.length ? `, 이미 있음 ${l.result.same.length}개` : ''}
                      {l.result.clash.length ? `, 내용 다름 ${l.result.clash.length}개` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* 이름이 같은데 내용이 다른 것 — 덮어쓰기는 한 번 더 눌러야 한다 */}
          {(clash.length > 0 || replaceable > 0) && (
            <p className="row-actions">
              <button className="ghost danger" disabled={going} onClick={() => void send(last.current, true)}>
                덮어쓰기
              </button>
              <span className="sub">
                이름은 같고 내용이 다른 파일 {clash.length + replaceable}개를 덮어씁니다. 기존 파일은 삭제됩니다.
              </span>
            </p>
          )}

          {/* 못 가린 것 — **묻는 자리다.** 짐작해서 넣지 않는다 */}
          {got.ask.length > 0 && (
            <details className="files" open>
              <summary>넣지 않은 파일 {got.ask.length}개</summary>
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
              <summary>넣기 실패 {got.failed.length}개</summary>
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

export default RscSort
