import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardItem, BoardKey, BoardList, BoardResult } from '../../shared/forge'

function sameKey(a: BoardKey | null, b: BoardKey): boolean {
  return a !== null && a.subject === b.subject && a.issue === b.issue
}

/** 도는 칸이 있을 때 진행판을 다시 읽는 사이 — 칸의 「만드는 중 · m분」이 분 단위라 30초면 된다 */
const RUNNING_POLL_MS = 30_000

/**
 * 진행판 — 호 목록 · 고른 호 · 그 호의 칸들 (App.tsx 에서 뗌, 2026-09-29 M4).
 *
 * - **같은 호를 다시 읽을 때는 비우지 않는다** — 작업대에서 돌아옴 · 리소스를 놓음 · 도는 칸 새로 보기.
 *   비우면 「읽고 있습니다」로 한 번 깜빡이고, 그 사이 누른 칸이 사라진다
 * - **도는 칸이 있으면 저절로 다시 읽는다** — 안 그러면 작업대에서 나와도 「끝」이나 옛 상태가 그대로다
 */
export function useBoard() {
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [boardsError, setBoardsError] = useState('')
  // **마지막에 보던 호 · 과목을 기억한다** (2026-10-02) — 켤 때마다 1호 영어가 떠서 9호 국어까지 다시 눌러 들어갔다. 이 PC 만의 편의라 localStorage
  const [selected, setSelected] = useState<BoardKey | null>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('lastBoard') ?? 'null') as BoardKey | null
      return v && typeof v.subject === 'string' && typeof v.issue === 'string' ? v : null
    } catch {
      return null
    }
  })
  useEffect(() => {
    try {
      if (selected) localStorage.setItem('lastBoard', JSON.stringify({ subject: selected.subject, issue: selected.issue }))
    } catch {
      // 못 남겨도 그만이다 — 다음에 1호부터 뜰 뿐
    }
  }, [selected])
  const [result, setResult] = useState<BoardResult | null>(null)
  const [tick, setTick] = useState(0)
  const shown = useRef<BoardKey | null>(null)

  // 열 수 있는 다음 호와 그 호에 새로 만들 과목 (M7)
  const [next, setNext] = useState<{ issue: string; subjects: string[] } | null>(null)
  const take = useCallback((r: BoardList, pick?: BoardKey) => {
    setBoards(r.boards)
    setNext(r.next ? { issue: r.next, subjects: r.nextSubjects } : null)
    setBoardsError(r.error ?? '')
    setSelected((prev) =>
      pick && r.boards.some((b) => sameKey(pick, b)) ? pick : prev && r.boards.some((b) => sameKey(prev, b)) ? prev : (r.boards[0] ?? null)
    )
  }, [])
  const loadBoards = useCallback(async () => take(await window.api.forgeBoards()), [take])
  /** 그 호를 열고 새로 연 첫 과목을 고른다 */
  const openIssue = useCallback(
    async (issue: string, subject: string) => take(await window.api.forgeOpenIssue(issue), { subject, issue }),
    [take]
  )
  /** 진행판을 닫는다 — 사람이 정한 칸이 없는 것만(메인이 다시 본다) */
  const closeBoard = useCallback(async (key: BoardKey) => take(await window.api.forgeCloseBoard(key)), [take])

  useEffect(() => {
    loadBoards()
  }, [loadBoards])

  useEffect(() => {
    if (!selected) {
      setResult(null)
      return
    }
    let cancelled = false
    if (shown.current !== selected) setResult(null)
    shown.current = selected
    window.api.forgeBoard(selected).then((r) => {
      // 읽는 동안 다른 호를 골랐으면 이전 결과는 버린다.
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [selected, tick])

  const anyRunning = result?.rows.some((r) => r.work?.running != null) ?? false
  useEffect(() => {
    if (!anyRunning) return
    const t = setTimeout(() => setTick((n) => n + 1), RUNNING_POLL_MS)
    return () => clearTimeout(t)
  }, [anyRunning, tick])

  /** 고른 호를 새로 읽는다 — 화면은 안 비운다 */
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  // 폴더를 바꾸거나 스펙을 받은 뒤 — 배치표부터 다시 읽고 고른 호를 새로 읽는다.
  const reload = useCallback(async () => {
    await loadBoards()
    setResult(null)
    setSelected((prev) => prev && { ...prev })
  }, [loadBoards])

  return { boards, boardsError, next, openIssue, closeBoard, selected, setSelected, result, refresh, reload, sameKey }
}
