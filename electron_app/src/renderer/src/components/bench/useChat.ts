import { useCallback, useEffect, useRef, useState } from 'react'
import { chatWaiting, type ChatInfo, type ChatState } from '../../../../shared/forge'

/**
 * **대화로 만들기의 형편** (2026-10-08, 메인 `chat.ts`) — 열 때 한 번 읽고, 그 뒤로는 메인이 미는 소식을 받는다.
 * 대화는 메인이 들고 있어 작업대를 떠났다 와도 이어 보인다. 가운데(진행) · 오른쪽(대화)이 같이 본다.
 *
 * - **늦게 온 것은 버린다**(`rev`) — 차례가 곧바로 끝나면 미는 소식이 invoke 의 답보다 먼저 와서, 늦게 온 「만드는 중」이 끝난 형편을 덮었다
 * - 차례가 끝나면(`onSettled`) 작업대가 다시 읽는다 — Claude 가 호 저장소에 썼으니 반영 · 모자란 리소스가 바뀐다
 */
export function useChat(code: string, onSettled?: () => unknown) {
  const [info, setInfo] = useState<ChatInfo | null>(null)
  const [sending, setSending] = useState(false)
  const take = useCallback((next: ChatInfo) => setInfo((p) => (p && p.code === next.code && next.rev < p.rev ? p : next)), [])

  useEffect(() => {
    let off = false
    setInfo(null)
    void window.api.forgeChatGet(code).then((i) => !off && take(i))
    const stop = window.api.onForgeChat((i) => {
      if (i.code === code) take(i)
    })
    return () => {
      off = true
      stop()
    }
  }, [code, take])

  const settled = useRef(onSettled)
  useEffect(() => {
    settled.current = onSettled
  })
  const was = useRef<ChatState | null>(null)
  useEffect(() => {
    const st = info?.state ?? null
    const before = was.current
    was.current = st
    if ((before === 'running' || before === 'checking') && st !== null && st !== 'running' && st !== 'checking') void settled.current?.()
  }, [info?.state])

  /** 보내고 받은 형편을 보인다 — 잘 됐으면 true(오류 글이 없을 때). 화면은 그때만 적은 답을 비운다 */
  const call = useCallback(
    async (body: () => Promise<ChatInfo>): Promise<boolean> => {
      setSending(true)
      try {
        const next = await body()
        take(next)
        return !next.error
      } catch (error) {
        setInfo((p) => p && { ...p, error: error instanceof Error ? error.message : String(error) })
        return false
      } finally {
        setSending(false)
      }
    },
    [take]
  )

  const start = useCallback(() => call(() => window.api.forgeChatStart(code)), [call, code])
  const reply = useCallback((text: string, images: Uint8Array[]) => call(() => window.api.forgeChatReply(code, text, images)), [call, code])
  const stop = useCallback(() => call(() => window.api.forgeChatStop(code)), [call, code])
  const clear = useCallback(() => call(() => window.api.forgeChatClear(code)), [call, code])

  const busy = info?.state === 'running' || info?.state === 'checking'
  // 끝나지 않은 대화가 있으면 호 저장소 폴더가 반쯤 쓰인 채다 — 검수 완료 · 커밋을 막는다(`chatWaiting`)
  const wait = busy || chatWaiting(info) ? '대화로 만들기를 마치거나 대화 기록을 지운 뒤 누를 수 있습니다.' : ''
  return { info, sending, busy, wait, start, reply, stop, clear }
}

export type Chat = ReturnType<typeof useChat>
