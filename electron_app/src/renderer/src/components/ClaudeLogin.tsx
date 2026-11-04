import { useEffect, useRef, useState } from 'react'

/** 로그인이 됐나 다시 재는 사이와 그만 잴 때 — 브라우저에서 로그인하는 데 몇 분이면 된다 */
const EVERY_MS = 3000
const GIVE_UP_MS = 5 * 60_000

/**
 * **「Claude Code 로그인」 단추** (2026-11-03) — 로그인이 풀렸다는 글(`CLAUDE_LOGIN_NOTE`) 옆에 붙는다.
 * 누르면 메인이 로그인 콘솔 창을 띄우고(`services/forge/claudelogin.ts`), 여기서 `claude auth status` 를 3초마다 다시 잰다.
 * 로그인이 되면 `done` 글을 보이고 `onDone` 을 부른다 — 처음 설정은 점검을 다시 하고, 대화 칸은 다음에 누를 것만 알린다
 */
export default function ClaudeLogin({ done, onDone }: { done: string; onDone?: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'done' | 'gave-up'>('idle')
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const stop = (): void => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])

  const open = async (): Promise<void> => {
    setError('')
    const got = await window.api.claudeLogin()
    if (!got.ok) {
      setError(got.error ?? '로그인 창을 열지 못했습니다.')
      return
    }
    setPhase('waiting')
    stop()
    const from = Date.now()
    timer.current = setInterval(() => {
      void window.api.claudeLoggedIn().then((inNow) => {
        if (!timer.current) return
        if (inNow === true) {
          stop()
          setPhase('done')
          onDone?.()
        } else if (Date.now() - from > GIVE_UP_MS) {
          stop()
          setPhase('gave-up')
        }
      })
    }, EVERY_MS)
  }

  if (phase === 'done') return <p className="state done">{done}</p>
  return (
    <p className="row-actions">
      <button className="go" onClick={() => void open()} disabled={phase === 'waiting'}>
        {phase === 'waiting' ? '로그인 기다리는 중…' : 'Claude Code 로그인'}
      </button>
      {phase === 'waiting' && <span className="sub">브라우저에서 로그인하세요. 로그인이 끝날 때까지 「Claude Code 로그인」 창을 닫지 마세요.</span>}
      {phase === 'gave-up' && <span className="sub">로그인을 확인하지 못했습니다. 로그인했으면 단추를 다시 누르세요.</span>}
      {error && <span className="sub">{error}</span>}
    </p>
  )
}
