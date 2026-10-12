import { useCallback, useEffect, useState } from 'react'
import { BUTTON, type CommitResult, type DoneResult } from '../../../../shared/forge'

/**
 * **「검수 완료」 · 「양산 완료 커밋」** (2026-09-29, M7 · 2026-09-30) — 앱 안 창에서 보고 누른다. 앞 단추는 호 저장소의
 * activityInfo.json 을 devFinished:true · 오늘 날짜 · 내 이름으로(`done.ts`), 뒤 단추는 그 학습코드만 `<코드> 양산 완료` 로
 * 커밋 · 푸시한다(`hallcommit.ts`). main 에 올리는 것은 그 뒤에 켜지는 「main에 올리기」가 따로 한다 (2026-10-02 사용자 말).
 * **액티비티는 다시 만들지 않는다** — 본 그대로가 끝이다.
 *
 * 앱 안 창에는 preload 가 없어 거기 단추를 못 둔다 — 그래서 작업대에 둔다(M6 판단).
 */
/**
 * `wait` — 막는 까닭 한 줄. 대화로 만드는 중이면 파일이 반쯤 쓰인 채라 검수 완료 · 커밋을 막는다 (2026-10-08 첫 시험에서 켜져 있었다)
 */
export default function DoneCard({ code, wrote, dummy, wait = '', onDone }: { code: string; wrote: boolean; dummy: boolean; wait?: string; onDone: () => void }) {
  const [there, setThere] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [got, setGot] = useState<DoneResult | null>(null)
  const [pushed, setPushed] = useState<CommitResult | null>(null)
  const [toMain, setToMain] = useState<CommitResult | null>(null)

  useEffect(() => {
    let off = false
    void window.api.forgeViewCheck(code).then((c) => !off && setThere(c.activity))
    return () => {
      off = true
    }
  }, [code, wrote])

  const done = useCallback(async () => {
    setBusy(true)
    try {
      const r = await window.api.forgeDone(code)
      setGot(r)
      if (r.ok) onDone()
    } finally {
      setBusy(false)
    }
  }, [code, onDone])

  const commit = useCallback(async () => {
    setBusy(true)
    try {
      setPushed(await window.api.forgeCommit(code))
      setToMain(null)
    } finally {
      setBusy(false)
    }
  }, [code])

  // 커밋 · 푸시가 된 뒤에만. 갈 것은 커밋 결과가 먼저 보인다 — 「양산 완료」가 아닌 커밋은 목록을 보이고 단추 이름에 그 수를 넣는다.
  // 누른 단추가 본 목록(해시)을 같이 보낸다 — 그 사이 새 커밋이 생겼으면 메인이 안 올리고 새 목록을 돌려준다(`hallcommit.ts`)
  const plan = toMain?.toMain ?? pushed?.toMain
  const mainReady = Boolean(pushed?.ok && plan?.state === 'ready' && !toMain?.ok)
  const extra = plan?.state === 'ready' ? plan.extra : []
  const main = useCallback(async () => {
    setBusy(true)
    try {
      setToMain(await window.api.forgePushMain(code, extra.map((e) => e.sha)))
    } finally {
      setBusy(false)
    }
  }, [code, extra])

  return (
    <section className="card">
      <h3>검수</h3>
      <p className="row-actions">
        <button className="go" onClick={() => void done()} disabled={busy || !there || dummy || Boolean(wait)}>
          {busy ? '처리 중…' : BUTTON.done}
        </button>
        <button onClick={() => void commit()} disabled={busy || !there || dummy || Boolean(wait)}>
          {BUTTON.commit}
        </button>
        <button
          className={extra.length ? 'danger' : undefined}
          onClick={() => void main()}
          disabled={busy || !mainReady}
          title="「양산 완료 커밋」을 한 뒤 누를 수 있습니다. 「<학습코드> 양산 완료」가 아닌 커밋이 있으면 아래 목록을 확인한 뒤 누르세요."
        >
          {mainReady && extra.length ? `다른 커밋 ${extra.length}개 포함해 ${BUTTON.main}` : BUTTON.main}
        </button>
        {/* 할 일 차례는 작업 순서 막대가 말한다 — 못 누를 때 까닭 한 줄만 (2026-10-01) */}
        {wait ? (
          <span className="sub">{wait}</span>
        ) : dummy || there === false ? (
          <span className="sub">대화로 생성한 뒤 누를 수 있습니다.</span>
        ) : null}
      </p>
      {got?.error && <p className="state error">{got.error}</p>}
      {got?.ok && <p className="state done">{got.note}</p>}
      {pushed?.error && <p className="state error">{pushed.error}</p>}
      {pushed && (pushed.done.length > 0 || pushed.note) && (
        <p className={pushed.ok ? 'state done' : 'sub'}>{[...pushed.done, pushed.note].filter(Boolean).join(', ')}</p>
      )}
      {mainReady && extra.length > 0 && (
        <ul className="sub main-extra">
          {extra.map((e) => (
            <li key={e.sha} className="mono">
              {e.why}
            </li>
          ))}
        </ul>
      )}
      {toMain?.error && <p className="state error">{toMain.error}</p>}
      {toMain?.ok && <p className="state done">{[...toMain.done, toMain.note].filter(Boolean).join(', ')}</p>}
    </section>
  )
}
