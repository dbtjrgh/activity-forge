import { useEffect, useState, type ReactNode } from 'react'
import { SETUP_FORGE_DIR, SETUP_RSC_DIR, type BranchPlans, type SetupState, type WorkPick } from '../../../../shared/forge'
import SuggestInput from '../SuggestInput'
import SetupBranch from './SetupBranch'
import SetupChecks from './SetupChecks'
import SetupProgress from './SetupProgress'
import SetupRepos from './SetupRepos'
import './firstrun.css'

/**
 * **처음 설정 창** (2026-10-01) — 양산기 폴더를 못 찾으면 앱 화면 대신 뜬다. 메인 쪽은 `services/forge/setup.ts`.
 * 사람은 작업 폴더 하나만 고른다. 양산기 · 리소스 폴더는 그 안에 앱이 만든다(사용자 결정 — 양산기 폴더는 안 묻는다).
 * 2026-10-16 — 저장소는 사람이 git 으로 받고(점검표 `SetupRepos`), 앱은 받아 둔 저장소에 내 브랜치(`SetupBranch`) · yarn · 연결을 맞춘다(`SetupProgress`)
 */
function FirstRun({ state, onRecheck }: { state: SetupState; onRecheck: () => Promise<void> }) {
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [pick, setPick] = useState<WorkPick | null>(null)
  const [developer, setDeveloper] = useState('')
  const [devTeam, setDevTeam] = useState('')
  const [branch, setBranch] = useState('')
  const [plans, setPlans] = useState<BranchPlans | null>(null)
  const [follow, setFollow] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const work = pick && !pick.error ? pick : null
  const workDir = work?.dir ?? ''
  // 브랜치 이름이나 작업 폴더가 바뀌면 따라가기로 한 것을 지운다 — 다른 이름 · 다른 폴더의 원격 브랜치를 확인한 것이 아니다.
  // 폴더는 경로로 본다 — `work` 는 「다시 확인」 · 「다시 실행」 때마다 새 객체라, 그것을 보면 확인한 것이 아무 일 없이 지워진다
  useEffect(() => setFollow(new Set()), [branch, workDir])
  // 저장소마다 브랜치를 어떻게 할지 — 적는 동안은 잠깐 기다렸다 묻는다. 점검표를 다시 재면 같이 다시 묻는다
  useEffect(() => {
    setPlans(null)
    if (!work?.ready || !branch.trim()) return
    let off = false
    const t = setTimeout(() => void window.api.setupBranchPlan(branch.trim()).then((p) => !off && setPlans(p)), 300)
    return () => {
      off = true
      clearTimeout(t)
    }
  }, [branch, work])

  const choose = (): void => void window.api.setupPickWork().then((p) => p && setPick(p))
  const recheckRepos = async (): Promise<void> => {
    const p = await window.api.setupRecheck()
    if (p) setPick(p)
  }

  // 「설정 완료」를 못 누르는 까닭 — 위에서부터 첫 번째 하나만
  const programsOk = state.checks.filter((c) => c.required).every((c) => c.ok || confirmed.has(c.name))
  const blocker = !work
    ? '작업 폴더를 선택하세요.'
    : !work.ready
      ? work.missing
      : !developer.trim() || !devTeam.trim()
        ? '이름과 팀을 적으세요.'
        : !branch.trim()
          ? '브랜치 이름을 적으세요.'
          : !plans
            ? '브랜치를 확인하는 중입니다.'
            : plans.error
              ? '브랜치 이름을 고치세요.'
              : !programsOk
                ? '필요한 프로그램을 먼저 준비하세요.'
                : ''

  return (
    <div className="first-run">
      <div className="first-card">
        <header>
          <h1>초기 설정</h1>
        </header>

        <Step n={1} title="작업 폴더">
          <div className="first-row">
            <button className="go" onClick={choose} disabled={busy}>
              {pick ? '다시 선택' : '폴더 선택'}
            </button>
            {pick && <span className="mono first-path">{pick.dir}</span>}
          </div>
          {pick?.error && <p className="state error">{pick.error}</p>}
        </Step>

        {work ? (
          <SetupRepos pick={work} onRecheck={recheckRepos} disabled={busy} />
        ) : (
          <Step n={2} title="받아 둘 저장소">
            <p className="first-help">작업 폴더를 먼저 선택하세요.</p>
          </Step>
        )}

        <Step n={3} title="자동으로 만드는 폴더">
          <ul className="first-dirs">
            <li>
              <span className="mono">{work ? work.forgeDir : `작업 폴더\\${SETUP_FORGE_DIR}`}</span>
              {work?.forgeReady && <span className="sub">이미 있습니다.</span>}
            </li>
            <li>
              <span className="mono">{work ? work.rscDir : `작업 폴더\\${SETUP_RSC_DIR}`}</span>
              {work?.rscReady && <span className="sub">이미 있습니다.</span>}
            </li>
          </ul>
        </Step>

        <Step n={4} title="사용자 정보">
          <div className="first-row">
            <SuggestInput label="이름" value={developer} suggest={state.suggest.developer} onChange={setDeveloper} disabled={busy} />
            <SuggestInput label="팀" value={devTeam} suggest={state.suggest.devTeam} onChange={setDevTeam} disabled={busy} />
            <SuggestInput label="브랜치" value={branch} suggest={state.suggest.branch} onChange={setBranch} disabled={busy} />
          </div>
          <SetupBranch
            key={`${workDir}|${branch}`}
            plans={plans}
            follow={follow}
            disabled={busy}
            onFollow={(repo, on) =>
              setFollow((s) => {
                const next = new Set(s)
                if (on) next.add(repo)
                else next.delete(repo)
                return next
              })
            }
          />
        </Step>

        <SetupChecks
          checks={state.checks}
          confirmed={confirmed}
          onConfirm={(name) => setConfirmed((s) => new Set(s).add(name))}
          onRecheck={onRecheck}
        />

        <SetupProgress
          key={workDir}
          blocker={blocker}
          branch={branch}
          follow={follow}
          developer={developer}
          devTeam={devTeam}
          onBusy={setBusy}
          onRan={() => void recheckRepos()}
        />
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
