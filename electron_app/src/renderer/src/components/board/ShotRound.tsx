import { useCallback, useEffect, useMemo, useState } from 'react'
import { wantsShot, type BoardRow } from '../../../../shared/forge'

/**
 * **진행판에서 화면 모으기** (2026-09-29, M5) — 칸을 고르고 Ctrl+V 하면 그 칸에 들어가고, 화면이 모자란 다음 칸으로 넘어간다.
 *
 * 전에는 칸마다 작업대를 열고 붙이고 닫고를 36번 했다. 켠 동안만 칸 누르기가 「열기」 대신 「고르기」다 —
 * 늘 고르기로 두면 가장 흔한 일(칸 열기)이 두 번 누르기가 된다. 붙이는 길은 작업대와 같은 채널이라
 * 1x 판정(`ipc/shots.ts` oneX)도 같다. **붙이기만 하고 돌리지 않는다** — AI 는 「만들기」만 부른다(M2).
 */
export function useShotRound(rows: BoardRow[], onChanged: () => void) {
  const [on, setOn] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [note, setNote] = useState('')
  // 이 판에서 붙인 칸 — 진행판을 다시 읽기 전에도 「다음 칸」에서 뺀다
  const [done, setDone] = useState<string[]>([])
  const order = useMemo(() => rows.slice().sort((a, b) => a.code.localeCompare(b.code)), [rows])
  const need = useMemo(() => order.filter((r) => wantsShot(r) && !done.includes(r.code)), [order, done])

  const start = useCallback(() => {
    setOn(true)
    setDone([])
    setPicked(need[0]?.code ?? null)
    setNote(need.length ? '' : '화면이 필요한 학습코드가 없습니다. 학습코드를 눌러 선택하세요.')
  }, [need])
  const stop = useCallback(() => {
    setOn(false)
    setPicked(null)
    setNote('')
  }, [])

  const pasteNow = useCallback(async () => {
    if (!picked) return
    const got = await window.api.forgePasteShot(picked, 'figma')
    if (got.error) {
      setNote(`${picked}: ${got.error}`)
      return
    }
    const left = need.filter((r) => r.code !== picked)
    // 고른 칸 **다음**부터 찾는다 — 앞쪽 칸으로 되돌아가면 사람이 보던 자리를 잃는다
    const next = left.find((r) => r.code > picked) ?? left[0]
    setDone((d) => [...d, picked])
    setPicked(next?.code ?? null)
    setNote(`${picked}에 붙여 넣었습니다. ${got.note}` + (next ? ` 다음 학습코드: ${next.code}` : ' 모든 학습코드에 화면을 붙여 넣었습니다.'))
    onChanged()
  }, [picked, need, onChanged])

  useEffect(() => {
    if (!on) return
    const onPaste = (e: ClipboardEvent): void => {
      // 글을 붙여넣은 것은 우리 일이 아니다 — 그림일 때만 가로챈다(`ShotPaste.tsx` 와 같다)
      if (![...(e.clipboardData?.items ?? [])].some((i) => i.type.startsWith('image/'))) return
      e.preventDefault()
      void pasteNow()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') stop()
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKey)
    }
  }, [on, pasteNow, stop])

  return { on, picked, pick: setPicked, note, need: need.length, start, stop }
}

export type ShotRound = ReturnType<typeof useShotRound>

/** 진행판 머리의 한 줄 — 켜고 끄기 · 지금 고른 칸 · 방금 한 일 */
export function ShotRoundBar({ round }: { round: ShotRound }) {
  return (
    <div className={`shot-round${round.on ? ' on' : ''}`}>
      {round.on ? (
        <>
          <span>
            {round.picked ? (
              <>
                <strong className="mono">{round.picked}</strong>: figma 프레임을 <kbd>Ctrl</kbd>+<kbd>V</kbd>로 붙여 넣으세요
              </>
            ) : (
              '학습코드를 눌러 선택하세요'
            )}
          </span>
          <button className="ghost" onClick={round.stop}>
            닫기 (Esc)
          </button>
        </>
      ) : (
        <>
          <span className="sub">화면이 필요한 학습코드 {round.need}개</span>
          <button className="ghost" onClick={round.start}>
            화면 연속 붙여넣기
          </button>
        </>
      )}
      {round.note && <span className="sub shot-round-note">{round.note}</span>}
    </div>
  )
}
