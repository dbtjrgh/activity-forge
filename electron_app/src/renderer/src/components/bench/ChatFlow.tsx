import { useEffect, useRef, useState } from 'react'
import type { ChatState } from '../../../../shared/forge'
import { TARGET } from '../../lib/benchorder'
import type { Chat } from './useChat'
import './chat.css'

/**
 * 작업대 가운데 — **대화로 만들기의 진행** (2026-10-08). 시작 단추 · 지금 상태 · Claude 가 한 일 한 줄씩 · 앱 검사 결과.
 * 대화(질문과 답)는 오른쪽 `ChatSide`. 형편은 메인이 든다(`useChat`).
 */
const STATE: Record<ChatState, string> = {
  idle: '아직 시작하지 않았습니다.',
  running: 'Claude 가 만드는 중입니다.',
  asking: '답을 기다립니다. 오른쪽에서 답하세요.',
  checking: '리소스를 복사하고 타입 검사를 하는 중입니다.',
  done: '만들었습니다. 미리보기로 확인하세요.',
  stopped: '멈췄습니다. 오른쪽에 답을 적으면 이어서 진행합니다.',
  error: '오류로 멈췄습니다. 오른쪽에 답을 적으면 이어서 진행합니다.'
}

function useSeconds(since: number | null): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!since) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [since])
  return since ? Math.max(0, Math.round((now - since) / 1000)) : 0
}

export default function ChatFlow({ chat, canRun }: { chat: Chat; canRun: boolean }) {
  const { info, busy, sending } = chat
  const sec = useSeconds(info?.since ?? null)
  const log = useRef<HTMLOListElement>(null)
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [info?.progress.length])
  if (!info) return <p className="sub">불러오는 중…</p>
  const started = info.state !== 'idle'
  const checks = info.checks
  return (
    <section className="chat-flow">
      <div className="chat-flow-head">
        <button id={TARGET.chat} className="go" disabled={!canRun || busy || sending} onClick={() => void chat.start()}>
          {started ? '처음부터 다시 만들기' : '대화로 생성'}
        </button>
        {busy && (
          <button className="ghost" disabled={sending} onClick={() => void chat.stop()}>
            멈추기
          </button>
        )}
        {/* 대화를 버리고 앱 밖에서(손으로) 마쳤을 때 검수 완료를 다시 연다 — 기록은 휴지통으로, 호 저장소 파일은 그대로 */}
        {!busy && (started || info.turns.length > 0) && (
          <button className="ghost" disabled={sending} title="호 저장소에 쓴 파일은 그대로 둡니다." onClick={() => void chat.clear()}>
            대화 기록 지우기
          </button>
        )}
        <span className={`chat-state chat-state-${info.state}`}>
          {/* 이어 갈 대화가 없으면 답으로 이을 수 없다 */}
          {!info.sessionId && info.state === 'error' ? '진행할 수 없습니다.' : !info.sessionId && info.state === 'stopped' ? '멈췄습니다.' : STATE[info.state]}
        </span>
        {busy && <span className="sub">{Math.floor(sec / 60)}분 {sec % 60}초째</span>}
        {info.cost > 0 && <span className="sub">사용 금액 ${info.cost.toFixed(2)}</span>}
      </div>
      {info.error && <p className="state error">{info.error}</p>}
      {info.progress.length > 0 && (
        <ol className="chat-progress" ref={log}>
          {info.progress.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      )}
      {checks.tsc && (
        <div className="chat-checks">
          <p className={checks.tsc.ok ? 'state done' : 'state error'}>
            {checks.tsc.ran === false
              ? '타입 검사를 실행하지 못했습니다.'
              : checks.tsc.ok
                ? '타입 검사를 통과했습니다.'
                : `타입 오류가 ${checks.tsc.errors.length}개 있습니다.`}
          </p>
          {checks.tsc.ran === false && checks.tsc.why && <p className="sub">{checks.tsc.why}</p>}
          {checks.tsc.errors.length > 0 && <pre className="chat-pre">{checks.tsc.errors.slice(0, 20).join('\n')}</pre>}
          {checks.unread && <p className="state error">{checks.unread}</p>}
          {checks.files && (checks.files.missing.length > 0 || checks.files.failed.length > 0) && (
            <p className="state warn">
              호 저장소에 없는 파일 {checks.files.missing.length}개, 복사 실패 {checks.files.failed.length}개가 있습니다. {[...checks.files.missing, ...checks.files.failed].slice(0, 5).join(', ')}
            </p>
          )}
          {checks.spec && checks.spec.length > 0 && (
            <details className="chat-spec">
              <summary className="sub">스펙 검사에서 참고할 것 {checks.spec.length}개</summary>
              <pre className="chat-pre">{checks.spec.slice(0, 40).join('\n')}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
