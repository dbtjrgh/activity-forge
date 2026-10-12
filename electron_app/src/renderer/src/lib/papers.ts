/**
 * **붙여넣은 것을 화면에서 다루는 셈** — figma 화면과 기획서가 같이 쓴다.
 *
 * 둘은 받는 길이 다르다(화면은 Ctrl+V, 기획서는 끌어다 놓기·단추) — 그래서
 * 컴포넌트는 둘이다. 하지만 **읽고·한 개 지우고·통째로 지우는 셈은 같다.**
 * 그것을 두 벌로 두면 한쪽만 고쳐진다(저장소 규칙 3).
 *
 * 화면에 보이는 모양·형식이라 `renderer/src/lib/` 에 둔다.
 */

import { useCallback, useEffect, useState } from 'react'
import type { Shot } from '../../../shared/forge'

export type Paper = 'figma' | 'plan'

export interface Papers {
  items: Shot[]
  /** 사람에게 보일 한 줄 (받았습니다 · 지웠습니다 · 오류) */
  note: string
  setNote: (note: string) => void
  reload: () => Promise<void>
  dropOne: (file: string) => Promise<void>
  clear: () => Promise<void>
  /** 한 칸 앞(-1) · 뒤(+1)로 — figma 화면은 붙인 차례가 이닝 차례다 */
  move: (file: string, step: -1 | 1) => Promise<void>
}

export function usePapers(code: string, kind: Paper): Papers {
  const [items, setItems] = useState<Shot[]>([])
  const [note, setNote] = useState('')

  /** 붙어 있는 것을 다시 읽는다. **넣은 뒤·지운 뒤에 늘 부른다.** */
  const reload = useCallback(async (): Promise<void> => {
    const got = await window.api.forgeShots(code, kind)
    setItems(got.shots)
    if (got.error) setNote(got.error)
  }, [code, kind])

  useEffect(() => {
    setNote('')
    setItems([])
    void reload()
  }, [code, kind, reload])

  const dropOne = useCallback(
    async (file: string): Promise<void> => {
      const got = await window.api.forgeDropShot(code, file, kind)
      setNote(got.error || got.note)
      await reload()
    },
    [code, kind, reload]
  )

  const clear = useCallback(async (): Promise<void> => {
    const got = await window.api.forgeClearShot(code, kind)
    setNote(got.error || got.note)
    await reload()
  }, [code, kind, reload])

  const move = useCallback(
    async (file: string, step: -1 | 1): Promise<void> => {
      const got = await window.api.forgeMoveShot(code, file, step, kind)
      setNote(got.error || got.note)
      await reload()
    },
    [code, kind, reload]
  )

  return { items, note, setNote, reload, dropOne, clear, move }
}
