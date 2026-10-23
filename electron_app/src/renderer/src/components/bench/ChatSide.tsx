import { useEffect, useRef, useState, type ClipboardEvent } from 'react'
import { chatWaiting, type ChatTurn } from '../../../../shared/forge'
import { TARGET } from '../../lib/benchorder'
import { figmaLine } from '../../lib/figmacss'
import { bolded } from '../../lib/text'
import type { Chat } from './useChat'
import { useDraft } from './useDraft'
import './chat.css'

/**
 * 작업대 오른쪽 — **Claude 와의 대화** (2026-10-08). 주고받은 말 · 열린 질문 · 답 칸.
 * 답은 글로 쓴다(2026-10-08 사용자 결정 — 9-16 「메모 필요 없다」를 이 자리만 뒤집음).
 *
 * - **고를 답은 질문마다 하나만 고른다** — 고른 단추에 표시가 남는다. 처음에는 누르면 글 칸에 한 줄씩 덧붙였는데,
 *   글 칸이 화면 밖이라 눌러도 아무 일이 없어 보여 같은 답이 세 번 들어갔다(2026-10-08 첫 시험)
 * - **답 칸과 「답 보내기」는 늘 보인다** — 대화와 질문이 각자 굴러간다. 질문이 길어 단추가 창 밖으로 밀려 못 보냈다
 * - **대화를 시작하기 전에도 보낸다** (2026-10-13 사용자 — 「먼저 채팅으로 말도 못 걸고」). 메인이 남겨 뒀다가 첫 지시에 싣는다.
 *   기획서에 없는 인터북 어포던스 위치 · 배율을 figma 화면으로 붙이면 이닝으로 세어진다. 도는 중에는 「끝나면 보내기」로 예약해 두면 차례가 끝날 때 보낸다.
 *   figma 에서 복사한 CSS 를 붙이면 가운데 기준 좌표 한 줄로 바꿔 넣는다(`lib/figmacss.ts`).
 *   답 칸 안내는 숨은 단축키 한 줄만 둔다(2026-10-16 사용자 — 「쓸데없는 설명 문구 다 쳐내」). 상태마다 갈라 쓰던 안내 · 아래 줄은 걷었다
 * - 보낼 때 고른 답은 「1. …」로 번호를 붙이고, 글 칸의 말은 그 뒤에 붙는다. 화면을 Ctrl+V 로 붙이면 그림도 같이 보낸다(리소스 폴더 `_chat`)
 * - **`**굵게**` 는 굵게 그린다** — 기획서 오기를 끝 보고에 평범한 글로 적어 사람이 못 봤다(2026-10-08). 지시 글이 그렇게 쓰라고 한다
 * - **누가 한 말인지 한눈에** (2026-10-13 사용자 — 「깔끔하고 식별이 잘 되고 가독성 좋게」). Claude · 나 · 앱을 색 띠와 이름표로 가르고,
 *   앱 알림은 작게 둔다. 굵게 쓴 곳(사람이 꼭 볼 것)은 색으로도 띄운다. 질문은 번호를 달고 고를 답은 한 줄에 하나씩
 * - **답을 기다리면 이 칸 테두리가 깜빡인다** (2026-10-12 사용자 — 「알림오듯이 깜빡거리고, 마우스로 클릭해서 보고 있으면 없어지는 식」).
 *   이 칸을 누르거나 답 칸에 들어가면 멈추고, Claude 가 새로 말하면(차례가 늘면) 다시 깜빡인다. 이미 답 칸에 있으면 깜빡이지 않는다
 */
const WHO: Record<ChatTurn['who'], string> = { ai: 'Claude', person: '나', app: '앱' }

type Pic = { bytes: Uint8Array; url: string }

/** 말한 시각 — 시:분. 못 읽으면 비운다 */
const clock = (at: string): string => {
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 미리보기 그림 — CSP 가 blob: 을 막아 data URL 로(img-src 'self' data:) */
const dataUrl = (f: File): Promise<string> =>
  new Promise((done) => {
    const r = new FileReader()
    r.onload = () => done(String(r.result))
    r.readAsDataURL(f)
  })

export default function ChatSide({ chat }: { chat: Chat }) {
  const { info, busy, sending } = chat
  // 쓰던 글은 학습코드마다 이 PC 에 남는다 — 보내면 비워져 같이 지워진다(`useDraft.ts`). 그림은 안 남긴다
  const [text, setText] = useDraft(info?.code)
  const [pics, setPics] = useState<Pic[]>([])
  // 질문 글 → 고른 답. 질문이 바뀌면 그 질문 글이 없으니 저절로 안 쓰인다
  const [picks, setPicks] = useState<Record<string, string>>({})
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [info?.turns.length])
  // 기다리는 일 하나를 가리키는 열쇠 — 본 열쇠(`seen`)와 다르면 깜빡인다
  const waitKey = info && chatWaiting(info) ? `${info.state}|${info.turns.length}` : ''
  const [seen, setSeen] = useState('')
  const box = useRef<HTMLElement>(null)
  useEffect(() => {
    if (waitKey && box.current?.contains(document.activeElement)) setSeen(waitKey)
  }, [waitKey])
  // 도는 중에 「끝나면 보내기」를 눌러 둔 답 — 차례가 끝나면 바로 보낸다(2026-10-13). 다른 학습코드로 넘어가면 접는다
  const [queued, setQueued] = useState(false)
  const sendLater = useRef<() => Promise<void>>(async () => {})
  useEffect(() => setQueued(false), [info?.code])
  useEffect(() => {
    if (busy || !queued) return
    setQueued(false)
    void sendLater.current()
  }, [busy, queued])
  if (!info) return null

  const open = info.state === 'asking' ? info.questions : []
  const chosen = open.map((q, i) => (picks[q.text] ? `${i + 1}. ${picks[q.text]}` : '')).filter(Boolean)
  // 대화를 시작하기 전에도 보낸다 — 메인이 Claude 를 안 부르고 남겨 뒀다가 첫 지시에 싣는다(`chatNote`)
  const before = !info.sessionId
  const filled = chosen.length > 0 || text.trim() !== '' || pics.length > 0
  const canSend = !busy && !sending && filled
  // 못 보냈으면(오류 글이 오면) 적은 답을 그대로 둔다 — 다시 적게 하지 않는다
  const send = async (): Promise<void> => {
    if (!canSend) return
    if (!(await chat.reply([...chosen, text.trim()].filter(Boolean).join('\n'), pics.map((p) => p.bytes)))) return
    setText('')
    setPics([])
    setPicks({})
  }
  sendLater.current = send
  // 도는 중이면 보내지 않고 예약만 — 한 번 더 누르면 푼다
  const press = (): void => {
    if (busy) setQueued((q) => filled && !q)
    else void send()
  }
  const paste = async (e: ClipboardEvent<HTMLTextAreaElement>): Promise<void> => {
    // figma 「CSS 복사」 글이면 가운데 기준 좌표 한 줄로 바꿔 넣는다(`figmacss.ts`) — 못 읽는 꼴은 그대로 붙는다
    const line = figmaLine(e.clipboardData.getData('text/plain'))
    if (line) {
      e.preventDefault()
      setText((t) => (t.trim() ? `${t.trimEnd()}\n${line}` : line))
      return
    }
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
    <section
      ref={box}
      className={`chat-side${waitKey && seen !== waitKey ? ' chat-blink' : ''}`}
      onPointerDown={() => setSeen(waitKey)}
      onFocus={() => setSeen(waitKey)}
    >
      <h3>대화</h3>
      <ol className="chat-turns" ref={list}>
        {info.turns.map((t, i) => (
          <li key={i} className={`chat-turn chat-by-${t.who}`}>
            <span className="chat-who">
              <b>{WHO[t.who]}</b>
              <time>{clock(t.at)}</time>
            </span>
            <p className="chat-text">{bolded(t.text)}</p>
            {t.images?.length ? <span className="chat-note">그림 {t.images.length}장</span> : null}
          </li>
        ))}
      </ol>
      {open.length > 0 && (
        <div className="chat-questions">
          <p className="chat-q-head">Claude 의 질문 {open.length}개</p>
          <ol>
            {open.map((q, i) => (
              <li key={i}>
                <p className="chat-text">{bolded(q.text)}</p>
                {q.options.length > 0 && (
                  <div className="chat-options">
                    {q.options.map((o) => (
                      <button key={o} className={`ghost chat-pick${picks[q.text] === o ? ' on' : ''}`} onClick={() => pick(q.text, o)}>
                        {o}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="chat-input" id={TARGET.answer}>
        {chosen.length > 0 && <p className="sub">고른 답: {chosen.join(' / ')}</p>}
        <textarea
          value={text}
          placeholder="Ctrl+V 로 그림을 붙이고 Ctrl+Enter 로 보냅니다."
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => void paste(e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) press()
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
          {/* 비어 있어도 둔다 — `.chat-send` 가 space-between 이라 이 칸이 없으면 단추가 왼쪽으로 간다 */}
          <span className="sub">{busy && queued ? '지금 차례가 끝나면 바로 보냅니다.' : ''}</span>
          <button className={busy && queued ? 'ghost' : 'go'} disabled={busy ? !filled : !canSend} onClick={press}>
            {busy ? (queued ? '보내기 취소' : '끝나면 보내기') : before ? '남기기' : '답 보내기'}
          </button>
        </span>
      </div>
    </section>
  )
}
