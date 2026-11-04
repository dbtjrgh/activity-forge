import { useEffect, useRef, useState } from 'react'
import { BUTTON, isClaudeLoginNote, type ChatState } from '../../../../shared/forge'
import { TARGET } from '../../lib/benchorder'
import { formatDate } from '../../lib/format'
import ClaudeLogin from '../ClaudeLogin'
import type { Chat } from './useChat'
import './chat.css'

/**
 * 작업대 가운데 — **대화로 만들기의 진행** (2026-10-08). 시작 단추 · 지금 상태 · Claude 가 한 일 한 줄씩 · 앱 검사 결과.
 * 대화(질문과 답)는 오른쪽 `ChatSide`. 형편은 메인이 든다(`useChat`).
 */
const STATE: Record<ChatState, string> = {
  idle: '아직 시작하지 않았습니다.',
  running: 'Claude 가 만드는 중입니다.',
  asking: '답을 기다립니다.',
  checking: '검사하는 중입니다.',
  done: '만들었습니다.',
  stopped: '멈췄습니다.',
  error: '오류로 멈췄습니다.'
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

/**
 * `lock` — 남이 끝낸 학습코드라 시작을 막는 까닭(작업대 「그래도 고치기」 전). `force` — 푼 뒤라 메인에 그렇게 부른다.
 * `noShot` — 화면을 받아야 하는 모듈인데 figma 화면이 0장. 첫 누름에는 무엇으로 대신하는지 보이고 한 번 더 눌러야 시작한다 (2026-10-14)
 */
export default function ChatFlow({ chat, canRun, lock, force, noShot }: { chat: Chat; canRun: boolean; lock: string; force: boolean; noShot: boolean }) {
  const { info, busy, sending } = chat
  const sec = useSeconds(info?.since ?? null)
  const log = useRef<HTMLOListElement>(null)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [info?.progress.length])
  // 다른 학습코드로 가거나 화면을 붙이면 다시 묻는다
  useEffect(() => setArmed(false), [info?.code, noShot])
  if (!info) return <p className="sub">불러오는 중…</p>
  const started = info.state !== 'idle'
  const checks = info.checks
  const common = checks.tsc?.common ?? []
  const go = (): void => {
    if (noShot && !armed) return setArmed(true)
    setArmed(false)
    void chat.start(force)
  }
  return (
    <section className="chat-flow">
      <div className="chat-flow-head">
        <button id={TARGET.chat} className="go" disabled={!canRun || busy || sending || Boolean(lock)} onClick={go}>
          {started ? BUTTON.chatAgain : BUTTON.chat}
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
          {!info.sessionId && info.state === 'error' ? '진행할 수 없습니다.' : STATE[info.state]}
        </span>
        {busy && <span className="sub">{Math.floor(sec / 60)}분 {sec % 60}초째</span>}
        {info.cost > 0 && <span className="sub">사용 금액 ${info.cost.toFixed(2)}</span>}
      </div>
      {armed && <p className="state warn">figma 화면이 없습니다. 그대로 시작하려면 한 번 더 누르세요.</p>}
      {info.error && <p className="state error">{info.error}</p>}
      {/* 로그인이 풀렸으면 이 칸에서 로그인한다 — 첫 차례에 막혔으면 이어 갈 대화가 없어 다시 시작해야 한다 */}
      {isClaudeLoginNote(info.error) && (
        <ClaudeLogin done={info.sessionId ? '로그인되었습니다. 답을 보내면 대화를 이어 갑니다.' : '로그인되었습니다. 다시 시작하세요.'} />
      )}
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
          {/* 찍어 둔 결과다 — 스펙 · 코드를 고친 뒤에도 옛 결과가 보여서 잰 때를 같이 적는다 */}
          {checks.at && <p className="sub">{formatDate(Date.parse(checks.at))}에 검사한 결과입니다.</p>}
          {checks.tsc.ran === false && checks.tsc.why && <p className="sub">{checks.tsc.why}</p>}
          {checks.tsc.errors.length > 0 && <pre className="chat-pre">{checks.tsc.errors.slice(0, 20).join('\n')}</pre>}
          {/* 공용 모듈 오류는 막지 않는다 — 남의 모듈일 수 있어 Claude 에게도 안 맡긴다. 배포 빌드는 이것으로 실패한다 */}
          {common.length > 0 && (
            <>
              <p className="state warn">공용 모듈에 타입 오류가 {common.length}개 있어 배포 빌드가 실패합니다.</p>
              <pre className="chat-pre">{common.slice(0, 5).join('\n')}</pre>
            </>
          )}
          {checks.unread && <p className="state error">{checks.unread}</p>}
          {/* 학습코드가 폴더와 다르면 학습 기록이 다른 학습코드로 간다 — 막는 검사(`chatident.ts`) */}
          {checks.ident?.ok === false && <p className="state error">{checks.ident.lines.join(' ')}</p>}
          {checks.files && (checks.files.missing.length > 0 || checks.files.failed.length > 0) && (
            <p className="state warn">
              호 저장소에 없는 파일 {checks.files.missing.length}개, 복사 실패 {checks.files.failed.length}개가 있습니다. {[...checks.files.missing, ...checks.files.failed].slice(0, 5).join(', ')}
            </p>
          )}
          {/* 막지 않는다 — 빠뜨린 이펙트 · 소리일 수 있어 보인다(9호 MAL2M08W1S3 의 새 정답 파티클이 그렇게 빠졌다) */}
          {checks.files?.unused && checks.files.unused.length > 0 && (
            <p className="state warn">
              리소스 폴더에 받았는데 쓰지 않은 파일이 {checks.files.unused.length}개 있습니다. {checks.files.unused.slice(0, 6).join(', ')}
            </p>
          )}
          {/* 막지 않는다 — 원본에서 그대로 가져온 다른 호 전용 녹음일 수 있다(`chatforeign.ts`) */}
          {checks.foreign && checks.foreign.length > 0 && (
            <p className="state warn">
              다른 호에서만 쓰던 녹음이 {checks.foreign.length}개 있습니다. 이번 호 공유 폴더에 같은 역할의 녹음이 있는지 들어 보세요. {checks.foreign.join(', ')}
            </p>
          )}
          {checks.spec && checks.spec.length > 0 && (
            <details className="chat-spec">
              <summary className="sub">스펙 검사 결과 {checks.spec.length}개</summary>
              <pre className="chat-pre">{checks.spec.slice(0, 40).join('\n')}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
