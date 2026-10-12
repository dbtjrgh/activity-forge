import { useCallback, useEffect, useRef, useState } from 'react'
import type { InboxResult } from '../../../shared/forge'
import Bay from './Bay'
import { useDropped } from '../lib/dropbus'

/**
 * 리소스를 **끌어다 놓는 자리** (4단계).
 *
 * 여태는 「리소스 폴더에 넣으세요」라고만 하고, 그 폴더를 사람이 탐색기로
 * 찾아 들어가 갈래별로 나눠 넣어야 했다. 놓으면 들어간다.
 *
 * **넣은 뒤에 양산이 저절로 돈다** — 리소스가 들어왔다는 것은 「이제 다시
 * 해 볼 수 있다」는 뜻이라, 또 누르게 할 까닭이 없다(3단계와 같은 결).
 *
 * **안 들어간 것을 감추지 않는다.** 갈래를 못 가린 것·다른 차시 이름이
 * 붙은 것·이름이 같은데 내용이 다른 것은 그대로 두고 목록으로 보인다.
 * 덮어쓰기는 사람이 한 번 더 눌러야 한다.
 */
function RscDrop({
  code,
  busy,
  files,
  onDone
}: {
  code: string
  busy: boolean
  /** 지금 폴더에 들어 있는 리소스 수 — 칸 머리에 그대로 보인다 */
  files: number
  /** 무엇이든 들어갔을 때. 화면을 다시 읽고 양산을 다시 돌린다 */
  onDone: () => void
}) {
  const [got, setGot] = useState<InboxResult | null>(null)
  const [going, setGoing] = useState(false)
  // 덮어쓰기는 **같은 것을 다시 놓는 것**이라 방금 놓은 자리를 들고 있는다.
  const last = useRef<string[]>([])

  const send = useCallback(
    async (paths: string[], overwrite: boolean) => {
      if (!paths.length) return
      last.current = paths
      setGoing(true)
      try {
        const out = await window.api.forgeInbox(code, paths, overwrite)
        setGot(out)
        if (out.took.length) onDone()
      } finally {
        setGoing(false)
      }
    },
    [code, onDone]
  )

  // **화면 어디에 놓아도 여기로 온다** (2026-09-23, `DropAll.tsx`). 이 칸이 따로 받지 않는다 —
  // 둘이 받으면 한 번 놓은 것이 두 번 들어간다.
  // **도는 중이면 받아 두었다가 끝나면 넣는다.** 전에는 말없이 버렸다 — 놓았는데 아무 일이 없었다.
  const pending = useRef<string[]>([])
  const take = useCallback(
    (paths: string[]) => {
      if (busy || going) {
        pending.current = [...pending.current, ...paths]
        return
      }
      void send(paths, false)
    },
    [busy, going, send]
  )
  useDropped('rsc', take)
  useEffect(() => {
    if (busy || going || !pending.current.length) return
    const paths = pending.current
    pending.current = []
    void send(paths, false)
  }, [busy, going, send])

  return (
    <Bay
      icon="rsc"
      title={going ? '리소스 넣는 중…' : '리소스'}
      hint="파일을 화면 아무 곳에나 놓으세요."
      count={files}
      busy={busy || going}
    >

      {got && (
        <div className="drop-out">
          {got.error ? (
            <p className="state error">{got.error}</p>
          ) : (
            <p className={`state ${got.took.length ? 'done' : 'warn'}`}>{got.note}</p>
          )}

          {got.took.length > 0 && (
            <details className="files">
              <summary>넣은 파일 {got.took.length}개</summary>
              <ul>
                {got.took.map((t) => (
                  <li key={t.rel}>
                    <span className="mono">{t.rel}</span>
                    <span className="sub">{t.bytes.toLocaleString()}B</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* 이름이 같은데 내용이 다른 것 — 덮어쓰기는 한 번 더 눌러야 한다 */}
          {got.clash.length > 0 && (
            <>
              <details className="files" open>
                <summary>이름은 같고 내용이 다른 파일 {got.clash.length}개</summary>
                <ul>
                  {got.clash.map((c) => (
                    <li key={c.rel}>
                      <span className="mono">{c.rel}</span>
                      <span className="sub">
                        현재 {c.mine.toLocaleString()}B → 새 파일 {c.theirs.toLocaleString()}B
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
              <p className="row-actions">
                <button
                  className="ghost danger"
                  disabled={busy || going}
                  onClick={() => void send(last.current, true)}
                >
                  덮어쓰기
                </button>
                <span className="sub">폴더에 있던 기존 파일은 삭제됩니다.</span>
              </p>
            </>
          )}

          {/* 못 가린 것 — **묻는 자리다.** 짐작해서 넣지 않는다 */}
          {got.ask.length > 0 && (
            <details className="files" open>
              <summary>넣지 않은 파일 {got.ask.length}개</summary>
              <ul>
                {got.ask.map((a) => (
                  <li key={a.from}>
                    <span className="mono">{a.name}</span>
                    <span className="sub">{a.why}</span>
                  </li>
                ))}
              </ul>
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
    </Bay>
  )
}

export default RscDrop
