import { useEffect, useState, type ReactNode } from 'react'
import { SETUP_FORGE_DIR, SETUP_RSC_DIR, type SetupState, type WorkPick } from '../../../../shared/forge'
import SuggestInput from '../SuggestInput'
import './firstrun.css'

/**
 * **처음 설정 창** (2026-10-01) — 양산기 폴더를 못 찾으면 앱 화면 대신 뜬다. 메인 쪽은 `services/forge/setup.ts`.
 * 사람은 작업 폴더 하나만 고른다. 양산기 · 리소스 폴더는 그 안에 앱이 만든다(사용자 결정 — 양산기 폴더는 안 묻는다)
 */
function FirstRun({ state, onRecheck }: { state: SetupState; onRecheck: () => Promise<void> }) {
  const [checking, setChecking] = useState(false)
  const [pick, setPick] = useState<WorkPick | null>(null)
  const [developer, setDeveloper] = useState('')
  const [devTeam, setDevTeam] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const gitOk = state.checks.find((c) => c.name === 'git')?.ok !== false
  const ready = Boolean(pick && !pick.error) && gitOk && !busy && !done

  const choose = (): void => {
    setError('')
    void window.api.setupPickWork().then((p) => p && setPick(p))
  }
  const finish = (): void => {
    setBusy(true)
    setError('')
    void window.api.setupRun(developer, devTeam).then((r) => {
      setBusy(false)
      if (r.ok) {
        setDone(true)
        // 화면을 새로 읽으면 입구(`SetupGate`)가 다시 묻고, 이번에는 앱 화면이 뜬다
        setTimeout(() => window.location.reload(), 1200)
      } else setError(r.error ?? '설정하지 못했습니다.')
    })
  }

  return (
    <div className="first-run">
      <div className="first-card">
        <header>
          <h1>초기 설정</h1>
          <p className="sub">처음 실행할 때 한 번만 설정합니다. 작업 폴더를 선택하면 그 안에 양산기 폴더와 리소스 폴더를 만듭니다.</p>
        </header>

        <Step n={1} title="작업 폴더">
          <p className="first-help">
            호 저장소 폴더(<span className="mono">sparkon_m01</span>부터 <span className="mono">sparkon_m11</span>까지)가 들어 있는 폴더를 선택하세요.
            <br />예: <span className="mono">D:\Work</span>
          </p>
          <div className="first-row">
            <button className="go" onClick={choose} disabled={busy || done}>
              {pick ? '다시 선택' : '폴더 선택'}
            </button>
            {pick && <span className="mono first-path">{pick.dir}</span>}
          </div>
          {pick?.error && <p className="state error">{pick.error}</p>}
          {pick && !pick.error && (
            <p className="state done">
              호 저장소 {pick.repos.length}개를 찾았습니다: {pick.repos.join(', ')}
            </p>
          )}
        </Step>

        <Step n={2} title="자동으로 만드는 폴더">
          <p className="first-help">작업 폴더 안에 아래 두 폴더를 만듭니다. 따로 선택하지 않아도 됩니다.</p>
          <ul className="first-dirs">
            <li>
              <span className="mono">{pick && !pick.error ? pick.forgeDir : `작업 폴더\\${SETUP_FORGE_DIR}`}</span>
              <span className="sub">
                {pick?.forgeReady
                  ? '이미 있습니다. 그대로 씁니다.'
                  : '양산기 자료(스펙, 배치표)를 git.example.com에서 내려받는 폴더입니다. 업데이트도 이 폴더로 받습니다.'}
              </span>
            </li>
            <li>
              <span className="mono">{pick && !pick.error ? pick.rscDir : `작업 폴더\\${SETUP_RSC_DIR}`}</span>
              <span className="sub">{pick?.rscReady ? '이미 있습니다. 그대로 씁니다.' : '학습코드별 그림, 소리, 영상을 넣는 폴더입니다.'}</span>
            </li>
          </ul>
        </Step>

        <Step n={3} title="사용자 정보">
          <p className="first-help">「검수 완료」를 누를 때 activityInfo.json에 기록되는 이름과 팀입니다. 나중에 설정에서 바꿀 수 있습니다.</p>
          <div className="first-row">
            <SuggestInput label="이름" value={developer} suggest={state.suggest.developer} onChange={setDeveloper} disabled={busy || done} />
            <SuggestInput label="팀" value={devTeam} suggest={state.suggest.devTeam} onChange={setDevTeam} disabled={busy || done} />
          </div>
        </Step>

        <section className="first-checks">
          <h2>
            필요한 프로그램
            {state.checks.some((c) => !c.ok) && (
              <button
                className="ghost"
                disabled={checking}
                onClick={() => {
                  setChecking(true)
                  void onRecheck().finally(() => setChecking(false))
                }}
              >
                {checking ? '확인 중…' : '다시 확인'}
              </button>
            )}
          </h2>
          <ul>
            {state.checks.map((c) => (
              <li key={c.name} className={c.ok ? 'ok' : c.required ? 'fail' : 'warn'}>
                <b>{c.ok ? '✓' : c.required ? '✕' : '!'}</b> {c.name}
                {c.required && <span className="sub">(필수)</span>}
                <span className="sub">{c.note}</span>
                {c.install && (
                  <button className="ghost" onClick={() => void window.api.setupOpenInstall(c.name)}>
                    설치 페이지 열기
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {error && <p className="state error">{error}</p>}
        {busy && <p className="state">양산기를 내려받는 중입니다. 몇 분 걸릴 수 있습니다. 로그인 창이 뜨면 git.example.com 계정으로 로그인하세요.</p>}
        {done && <p className="state done">설정을 저장했습니다. 잠시 후 진행판을 엽니다.</p>}
        <div className="first-foot">
          <button className="go" onClick={finish} disabled={!ready}>
            설정 완료
          </button>
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="first-step">
      <h2>
        <span className="first-n">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

/** 앱 입구 — 처음 설정이 필요한지 먼저 묻고, 필요 없으면 앱 화면 */
export function SetupGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SetupState | null>(null)
  useEffect(() => {
    void window.api.setupState().then(setState)
  }, [])
  if (!state) return null
  if (!state.needed) return <>{children}</>
  return <FirstRun state={state} onRecheck={async () => setState(await window.api.setupState())} />
}

export default FirstRun
