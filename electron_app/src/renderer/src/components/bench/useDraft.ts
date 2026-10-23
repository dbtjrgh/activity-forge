import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * **대화 답 칸에 쓰던 글** (2026-10-14) — 학습코드마다 이 PC 에 둔다(localStorage). 다른 학습코드나 진행판에 다녀오거나
 * 앱을 다시 켜면 길게 적던 답이 사라졌다. 보내면 칸이 비므로 저절로 지워진다. 붙인 그림은 크기가 커서 넣지 않는다 — 글만.
 * 못 읽고 못 적어도(사생활 창 · 막힌 저장소) 칸은 평소처럼 쓴다.
 * 글과 그 학습코드를 한 덩이로 든다 — 학습코드가 바뀌는 그 차례에 앞 학습코드의 글이 새 학습코드 자리에 적히지 않게
 */
const keyOf = (code: string): string => `chatDraft:${code}`

function load(code: string): string {
  try {
    return localStorage.getItem(keyOf(code)) ?? ''
  } catch {
    return ''
  }
}

function save(code: string, text: string): void {
  try {
    if (text.trim()) localStorage.setItem(keyOf(code), text)
    else localStorage.removeItem(keyOf(code))
  } catch {
    // 못 적으면 다음에 켤 때 빈 칸일 뿐이다
  }
}

/** `code` 가 아직 없으면(대화 형편을 읽기 전) 빈 글이고 남기지 않는다 */
export function useDraft(code: string | undefined): [string, Dispatch<SetStateAction<string>>] {
  const [draft, setDraft] = useState({ code: '', text: '' })
  useEffect(() => {
    if (code) setDraft({ code, text: load(code) })
  }, [code])
  useEffect(() => {
    if (draft.code) save(draft.code, draft.text)
  }, [draft])
  const setText = useCallback<Dispatch<SetStateAction<string>>>(
    (next) => setDraft((d) => ({ ...d, text: typeof next === 'function' ? next(d.text) : next })),
    []
  )
  return [draft.code === code ? draft.text : '', setText]
}
