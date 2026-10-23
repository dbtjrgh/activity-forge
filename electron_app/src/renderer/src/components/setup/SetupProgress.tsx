import { useEffect, useState } from 'react'
import type { SetupRepoDone, SetupRun, SetupStep } from '../../../../shared/forge'
import { markTourPending } from '../../lib/tour'

/**
 * 처음 설정의 끝 — 「설정 완료」(양산기 받기 · sparkon_cli 준비 · 저장소마다 브랜치 · yarn · 연결), 도는 동안 진행 줄, 저장소마다 결과(단계마다 한 줄), 「마치기」.
 * 메인 쪽은 `services/forge/setup.ts` · `setupprep.ts`. **양산기 자리는 「마치기」에서만 기억한다** — 그 전에 끄면 다음에 켤 때 처음 설정이 다시 뜨고,
 * 다시 누르면 이미 된 것은 건너뛴다. **✕ 가 있으면 「마치기」를 막는다**(! 는 마칠 수 있다). 「마치기」가 되면 화면을 새로 읽어 진행판을 연다.
 * 작업 폴더를 다시 고르면 부르는 쪽이 이 칸을 새로 그린다(`key`) — 앞 폴더의 결과로 마치지 않게
 */
const MARK: Record<SetupStep['state'], string> = { done: '✓', skip: '✓', hold: '!', fail: '✕' }
const TONE: Record<SetupStep['state'], string> = { done: 'ok', skip: 'ok', hold: 'warn', fail: 'fail' }

/** 저장소 하나 — 단계마다 한 줄(이어 붙이면 네 문장이 한 줄이 된다) */
function Done({ r }: { r: SetupRepoDone }) {
  return (
    <li className={TONE[r.state]}>
      <b>{MARK[r.state]}</b>
      <span className="mono">{r.name}</span>
      <span className="first-steps">
        {r.steps.map((s, i) => (
          <span key={i} className={`sub ${TONE[s.state]}`}>
            {s.line}
            {s.detail && <span className="first-detail">{s.detail}</span>}
          </span>
        ))}
      </span>
    </li>
  )
}

export default function SetupProgress({
  blocker,
  branch,
  follow,
  developer,
  devTeam,
  onBusy,
  onRan
}: {
  /** 「설정 완료」를 못 누르는 까닭 — 빈 글이면 누를 수 있다 */
  blocker: string
  branch: string
  follow: Set<string>
  developer: string
  devTeam: string
  onBusy: (on: boolean) => void
  /** 한 번 돈 뒤 — 점검표와 브랜치 계획을 다시 잰다 */
  onRan: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<Record<string, string>>({})
  const [run, setRun] = useState<SetupRun | null>(null)
  const [error, setError] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [done, setDone] = useState(false)

  // 진행 줄 — 저장소마다 마지막 한 줄
  useEffect(() => window.api.onSetupLine((l) => setLines((m) => ({ ...m, [l.name]: l.line }))), [])

  const start = (): void => {
    setBusy(true)
    onBusy(true)
    setLines({})
    setRun(null)
    setError('')
    void window.api
      .setupRun(branch.trim(), [...follow])
      .then((r) => {
        setRun(r)
        if (r.error) setError(r.error)
      })
      .finally(() => {
        setBusy(false)
        onBusy(false)
        onRan()
      })
  }
  const finish = (): void => {
    setFinishing(true)
    setError('')
    void window.api.setupFinish(developer, devTeam).then((r) => {
      setFinishing(false)
      if (!r.ok) return setError(r.error ?? '설정을 저장하지 못했습니다.')
      // 앱 화면이 뜨면 둘러보기가 한 번 저절로 시작한다(`lib/tour.ts`)
      markTourPending()
      setDone(true)
      // 화면을 새로 읽으면 입구(`SetupGate`)가 다시 묻고, 이번에는 앱 화면이 뜬다
      setTimeout(() => window.location.reload(), 1200)
    })
  }

  // ✕ 가 있으면 마치지 않는다 — 마치면 다음에 켤 때 처음 설정이 안 떠 고칠 자리가 없다. 메인(`finishSetup`)도 같은 것을 다시 본다
  const failed = run?.repos.some((r) => r.state === 'fail')
  const canFinish = Boolean(run?.forgeReady && run.ok) && !busy && !finishing && !done && Boolean(developer.trim() && devTeam.trim())
  return (
    <section className="first-progress">
      {busy && (
        <>
          <p className="state">호 저장소마다 몇 분 걸릴 수 있습니다.</p>
          <ul>
            {Object.entries(lines).map(([name, line]) => (
              <li key={name}>
                <span className="mono">{name}</span>
                <span className="sub">{line}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {run && run.repos.length > 0 && (
        <ul>
          {run.repos.map((r) => (
            <Done key={r.name} r={r} />
          ))}
        </ul>
      )}
      {!busy && failed && <p className="state error">✕ 표시한 것을 고친 뒤 「다시 실행」을 누르세요.</p>}
      {error && <p className="state error">{error}</p>}
      {!busy && !run && blocker && <p className="state">{blocker}</p>}
      {done && <p className="state done">설정을 저장했습니다.</p>}
      <div className="first-foot">
        <button className={run?.forgeReady ? 'ghost' : 'go'} onClick={start} disabled={Boolean(blocker) || busy || finishing || done}>
          {busy ? '설정하는 중…' : run ? '다시 실행' : '설정 완료'}
        </button>
        {run?.forgeReady && (
          <button className="go" onClick={finish} disabled={!canFinish}>
            {finishing ? '저장하는 중…' : '마치기'}
          </button>
        )}
      </div>
    </section>
  )
}
