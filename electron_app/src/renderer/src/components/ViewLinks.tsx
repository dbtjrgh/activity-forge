import { useEffect, useState } from 'react'
import type { ViewCheck } from '../../../shared/forge'
import { hoLabel, junctionNote } from '../../../shared/forge'

/** 서버가 도는 동안 다시 재는 사이 — 정션 넷을 따라가 볼 뿐이라 가볍다 */
const EVERY_MS = 30_000

/**
 * 미리보기 칸의 **연결(정션) 목록과 바뀜 알림** (2026-10-14, `ViewPanel.tsx` 에서 떼어 냄).
 * `sparkon_common/node_modules` 는 호 하나만 가리키는 전역 상태라, 다른 호 작업대에서 「연결」을 누르면 떠 있는 서버가
 * 소리 없이 그 호 코드를 띄운다. 서버가 도는 동안 30초마다 · 창으로 돌아올 때 다시 재서 알린다.
 * **다시 잰 값은 여기만 든다** — 미리보기 칸의 `check` 를 덮으면 그 칸이 「연결 안 됨」 쪽으로 바뀌어 「서버 끄기」가 숨는다
 */
export default function ViewLinks({ code, check, running }: { code: string; check: ViewCheck; running: boolean }) {
  const [now, setNow] = useState<ViewCheck | null>(null)
  useEffect(() => {
    setNow(null)
    if (!running) return
    let alive = true
    const ask = async (): Promise<void> => {
      try {
        const got = await window.api.forgeViewCheck(code)
        if (alive) setNow(got)
      } catch {
        // 못 쟀으면 다음 차례에 다시 잰다
      }
    }
    const t = setInterval(() => void ask(), EVERY_MS)
    const onFocus = (): void => void ask()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [code, running])

  const shown = now ?? check
  const note = running && now ? junctionNote(now) : ''
  return (
    <>
      {note && <p className="state warn">{note}</p>}
      {/* 정션 넷을 그대로 보여 준다 — 무엇이 안 걸렸는지 짚을 수 있게 */}
      <details className="files">
        <summary>
          미리보기 연결 {shown.links.filter((l) => l.ok).length}/{shown.links.length}
          {shown.linkedMonth && ` (연결된 호: ${hoLabel(shown.linkedMonth)})`}
        </summary>
        <ul>
          {shown.links.map((l) => (
            <li key={l.at}>
              <span className={`tag ${l.ok ? 'done' : 'error'}`}>{l.ok ? '연결됨' : '없음'}</span>
              <span className="mono">{l.name}</span>
              <span className="sub">{l.target || l.at}</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  )
}
