import { useCallback, useEffect, useState } from 'react'
import { syncHasWork, syncKeys, type SyncPlan, type SyncRepo, type SyncRepoDone, type SyncResult } from '../../../../shared/forge'

/**
 * **「main 에 모두 올리기」 펼친 칸** (2026-10-14, `hallsyncall.ts`). 열리면 계획을 재고(받아 오지 않는다) 저장소마다 할 일 · 제외 · 막힐 것을 보인다.
 * 「이대로 올리기」가 두 번째 누름이다 — 화면에 보인 열쇠(`syncKeys`)를 보내고, 메인은 누른 때 다시 재어 그 열쇠와 겹치는 것만 커밋한다.
 * 도는 동안 메인이 미는 진행 줄을 저장소마다 마지막 몇 줄만 보인다.
 */
const SHOW_FILES = 8

/** 파일 목록 — 많으면 앞 몇 개와 남은 수 */
function Files({ files }: { files: string[] }) {
  if (!files.length) return null
  return (
    <ul className="board-top-files mono">
      {files.slice(0, SHOW_FILES).map((f) => (
        <li key={f}>{f}</li>
      ))}
      {files.length > SHOW_FILES && <li>외 {files.length - SHOW_FILES}개</li>}
    </ul>
  )
}

/** 저장소 하나의 계획 */
function RepoPlan({ r }: { r: SyncRepo }) {
  return (
    <div className="board-top-repo">
      <p className="board-top-repo-name">
        <span className="mono">{r.name}</span>
        {r.branch && <span className="sub"> {r.branch} 브랜치</span>}
      </p>
      {r.error && <p className="state error">{r.error}</p>}
      {r.blocked && <p className="state error">{r.blocked}</p>}
      {r.commits.length > 0 && (
        <>
          <p className="board-top-group">새로 할 커밋 {r.commits.length}개</p>
          <ul className="board-top-list">
            {r.commits.map((c) => (
              <li key={c.key}>
                「{c.subject}」 <span className="sub">파일 {c.files.length}개</span>
                <Files files={c.files} />
              </li>
            ))}
          </ul>
        </>
      )}
      {r.ahead.length > 0 && (
        <>
          <p className="board-top-group">이미 커밋했고 main 에 없는 커밋 {r.ahead.length}개</p>
          <ul className="board-top-list">
            {r.ahead.map((a) => (
              <li key={a.sha}>
                <span className="mono">{a.sha.slice(0, 7)}</span> {a.subject}
              </li>
            ))}
          </ul>
        </>
      )}
      {r.skipped.length > 0 && (
        <>
          <p className="board-top-group">제외 {r.skipped.length}개</p>
          <ul className="board-top-list board-top-skip">
            {r.skipped.map((s) => (
              <li key={s.what}>
                <span className="mono">{s.what}</span> <span className="sub">파일 {s.files.length}개, {s.why}</span>
                <Files files={s.files} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** 저장소 하나를 실행한 결과 */
function RepoDone({ r }: { r: SyncRepoDone }) {
  return (
    <div className="board-top-repo">
      <p className="board-top-repo-name mono">{r.name}</p>
      {r.done.length > 0 && (
        <ul className="board-top-list">
          {r.done.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {r.ok ? <p className="state done">완료했습니다.</p> : <p className="state error">{r.stopped}</p>}
      <Files files={r.files ?? []} />
      <Files files={r.tscErrors ?? []} />
    </div>
  )
}

export default function SyncPanel({ onBusy, onClose }: { onBusy: (on: boolean) => void; onClose: () => void }) {
  const [plan, setPlan] = useState<SyncPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Record<string, string[]>>({})
  const [result, setResult] = useState<SyncResult | null>(null)

  useEffect(() => {
    let off = false
    void window.api.forgeSyncPlan().then((p) => !off && setPlan(p))
    return () => {
      off = true
    }
  }, [])

  // 진행 줄 — 저장소마다 마지막 네 줄
  useEffect(() => window.api.onForgeSync((l) => setProgress((m) => ({ ...m, [l.name]: [...(m[l.name] ?? []), l.line].slice(-4) }))), [])

  const run = useCallback(async () => {
    if (!plan) return
    setBusy(true)
    onBusy(true)
    setProgress({})
    try {
      setResult(await window.api.forgeSyncRun(syncKeys(plan)))
    } finally {
      setBusy(false)
      onBusy(false)
    }
  }, [plan, onBusy])

  if (!plan) {
    return (
      <div className="board-top-panel">
        <p className="state">저장소마다 올릴 것을 확인하는 중입니다.</p>
      </div>
    )
  }
  const work = plan.repos.filter(syncHasWork)
  // 공용이 멈추면 호도 안 한다(`hallsyncall.ts`) — 누르기 전에 그렇다고 말하고 단추를 끈다
  const common = work.find((r) => r.kind === 'common' && (r.blocked || r.error))
  return (
    <div className="board-top-panel">
      <p className="board-top-title">main 에 모두 올리기</p>
      {plan.error && <p className="state error">{plan.error}</p>}
      {!plan.error && !work.length && <p className="state">올릴 것이 없습니다.</p>}
      {!result && plan.repos.map((r) => <RepoPlan key={r.name} r={r} />)}
      {busy &&
        Object.entries(progress).map(([name, ls]) => (
          <p key={name} className="sub">
            <span className="mono">{name}</span> {ls[ls.length - 1]}
          </p>
        ))}
      {result?.error && <p className="state error">{result.error}</p>}
      {result?.repos.map((r) => <RepoDone key={r.name} r={r} />)}
      {common && <p className="state error">공용 저장소를 올릴 수 없어 호 저장소도 올리지 않습니다.</p>}
      {!result && work.length > 0 && <p className="board-top-hint">목록은 원격에서 받기 전 기준이고, 누르면 저장소마다 원격 main 과 먼저 합치고 커밋한 뒤 main 에 올립니다.</p>}
      <div className="board-top-actions">
        {!result && (
          <button className="go" disabled={busy || !work.length || Boolean(common)} onClick={() => void run()}>
            {busy ? '올리는 중…' : '이대로 올리기'}
          </button>
        )}
        <button className="ghost" disabled={busy} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
