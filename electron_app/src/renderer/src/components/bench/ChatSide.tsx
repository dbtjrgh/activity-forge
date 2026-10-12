import { useEffect, useRef, useState, type ClipboardEvent } from 'react'
import type { ChatTurn } from '../../../../shared/forge'
import { TARGET } from '../../lib/benchorder'
import { bolded } from '../../lib/text'
import type { Chat } from './useChat'
import './chat.css'

/**
 * 작업대 오른쪽 — **Claude 와의 대화** (2026-10-08). 주고받은 말 · 열린 질문 · 답 칸.
 * 답은 글로 쓴다(2026-10-08 사용자 결정 — 9-16 「메모 필요 없다」를 이 자리만 뒤집음).
 *
 * - **고를 답은 질문마다 하나만 고른다** — 고른 단추에 표시가 남는다. 처음에는 누르면 글 칸에 한 줄씩 덧붙였는데,
 *   글 칸이 화면 밖이라 눌러도 아무 일이 없어 보여 같은 답이 세 번 들어갔다(2026-10-08 첫 시험)
 * - **답 칸과 「답 보내기」는 늘 보인다** — 대화와 질문이 각자 굴러간다. 질문이 길어 단추가 창 밖으로 밀려 못 보냈다
 * - 보낼 때 고른 답은 「1. …」로 번호를 붙이고, 글 칸의 말은 그 뒤에 붙는다. 화면을 Ctrl+V 로 붙이면 그림도 같이 보낸다(리소스 폴더 `_chat`)
 * - **`**굵게**` 는 굵게 그린다** — 기획서 오기를 끝 보고에 평범한 글로 적어 사람이 못 봤다(2026-10-08). 지시 글이 그렇게 쓰라고 한다
 */
const WHO: Record<ChatTurn['who'], string> = { ai: 'Claude', person: '나', app: '앱' }

type Pic = { bytes: Uint8Array; url: string }

/** 미리보기 그림 — CSP 가 blob: 을 막아 data URL 로(img-src 'self' data:) */
const dataUrl = (f: File): Promise<string> =>
  new Promise((done) => {
    const r = new FileReader()
    r.onload = () => done(String(r.result))
    r.readAsDataURL(f)
  })

export default function ChatSide({ chat }: { chat: Chat }) {
  const { info, busy, sending } = chat
  const [text, setText] = useState('')
  const [pics, setPics] = useState<Pic[]>([])
  // 질문 글 → 고른 답. 질문이 바뀌면 그 질문 글이 없으니 저절로 안 쓰인다
  const [picks, setPicks] = useState<Record<string, string>>({})
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [info?.turns.length])
  if (!info) return null

  const open = info.state === 'asking' ? info.questions : []
  const chosen = open.map((q, i) => (picks[q.text] ? `${i + 1}. ${picks[q.text]}` : '')).filter(Boolean)
  const canSend = Boolean(info.sessionId) && !busy && !sending && (chosen.length > 0 || text.trim() !== '' || pics.length > 0)
  // 못 보냈으면(오류 글이 오면) 적은 답을 그대로 둔다 — 다시 적게 하지 않는다
  const send = async (): Promise<void> => {
    if (!canSend) return
    if (!(await chat.reply([...chosen, text.trim()].filter(Boolean).join('\n'), pics.map((p) => p.bytes)))) return
    setText('')
    setPics([])
    setPicks({})
  }
  const paste = async (e: ClipboardEvent<HTMLTextAreaElement>): Promise<void> => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    e.preventDefault()
    const got = await Promise.all(files.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), url: await dataUrl(f) })))
    setPics((p) => [...p, ...got].slice(0, 4))
  }
  const pick = (q: string, option: string): void =>
    setPicks((p) => {
      const next = { ...p }
      if (next[q] === option) delete next[q]
      else next[q] = option
      return next
    })

  return (
    <section className="chat-side">
      <h3>대화</h3>
      {info.turns.length === 0 && <p className="sub">「대화로 생성」을 누르면 Claude 가 만들기 시작합니다. 모르는 것은 여기서 묻습니다.</p>}
      <ol className="chat-turns" ref={list}>
        {info.turns.map((t, i) => (
          <li key={i} className={`chat-turn chat-by-${t.who}`}>
            <span className="chat-who">{WHO[t.who]}</span>
            <p className="chat-text">{bolded(t.text)}</p>
            {t.images?.length ? <span className="sub">그림 {t.images.length}장</span> : null}
          </li>
        ))}
      </ol>
      {open.length > 0 && (
        <ol className="chat-questions">
          {open.map((q, i) => (
            <li key={i}>
              <p className="chat-text">{bolded(q.text)}</p>
              {q.options.length > 0 && (
                <span className="row-actions">
                  {q.options.map((o) => (
                    <button key={o} className={`ghost chat-pick${picks[q.text] === o ? ' on' : ''}`} onClick={() => pick(q.text, o)}>
                      {o}
                    </button>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="chat-input" id={TARGET.answer}>
        {chosen.length > 0 && <p className="sub">고른 답: {chosen.join(' / ')}</p>}
        <textarea
          value={text}
          placeholder={
            info.sessionId
              ? '고를 답이 없는 질문은 여기에 적으세요. 화면을 Ctrl+V 로 붙일 수 있습니다. Ctrl+Enter 로 보냅니다.'
              : '대화를 시작하면 답할 수 있습니다.'
          }
          disabled={!info.sessionId || busy}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => void paste(e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) void send()
          }}
        />
        {pics.length > 0 && (
          <span className="chat-pics">
            {pics.map((p, i) => (
              <button key={i} className="ghost" title="누르면 뺍니다." onClick={() => setPics((xs) => xs.filter((_, j) => j !== i))}>
                <img src={p.url} alt="" />
              </button>
            ))}
          </span>
        )}
        <span className="chat-send">
          <span className="sub">새로 넣은 리소스, figma 화면, 기획서는 앱이 함께 알립니다.</span>
          <button className="go" disabled={!canSend} onClick={() => void send()}>
            답 보내기
          </button>
        </span>
      </div>
    </section>
  )
}
