import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

/**
 * **끌어서 칸 너비를 바꾸는 손잡이** (2026-09-29 사용자 말 — 「각자 세로바 조절할 수 있게」).
 * 옆줄과 작업대의 왼쪽 · 오른쪽 칸이 같이 쓴다. 너비는 **이 PC 에만** 기억한다(`localStorage`) — 사람마다 모니터가 다르다.
 * 두 번 누르면 처음 너비로 돌아간다.
 */

/** 기억해 둔 너비 — 못 읽으면(처음 · 막힘) 처음 너비. 최소 · 최대 안으로만 */
export function useWidth(key: string, initial: number, min: number, max: number): [number, (w: number) => void, () => void] {
  const clamp = useCallback((w: number) => Math.round(Math.min(max, Math.max(min, w))), [min, max])
  const [w, setW] = useState(() => {
    try {
      const got = Number(localStorage.getItem(key))
      return got ? clamp(got) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, String(w))
    } catch {
      // 못 적으면 다음에 처음 너비로 뜰 뿐이다
    }
  }, [key, w])
  return [w, (n: number) => setW(clamp(n)), () => setW(initial)]
}

export default function Splitter({
  width,
  onWidth,
  onReset,
  grow = 1,
  className = '',
  label
}: {
  width: number
  onWidth: (w: number) => void
  onReset: () => void
  /** 오른쪽으로 끌면 커지나(1 — 왼쪽 칸), 작아지나(-1 — 오른쪽 칸) */
  grow?: 1 | -1
  className?: string
  label: string
}) {
  const from = useRef<{ x: number; w: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const down = (e: PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId)
    from.current = { x: e.clientX, w: width }
    setDragging(true)
  }
  const move = (e: PointerEvent<HTMLDivElement>): void => {
    if (from.current) onWidth(from.current.w + (e.clientX - from.current.x) * grow)
  }
  const up = (): void => {
    from.current = null
    setDragging(false)
  }
  return (
    <div
      className={`splitter${dragging ? ' dragging' : ''} ${className}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={`${label}: 끌어서 너비를 조절하세요. 두 번 누르면 처음 너비로 돌아갑니다.`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={onReset}
    />
  )
}
