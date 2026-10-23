import { useCallback, useEffect, useState } from 'react'
import type { PlanModule } from '../../../../shared/forge'
import './planmodule.css'

/**
 * **기획서 모듈넘버가 배치표와 다를 때** (2026-10-14, `services/forge/planmodule.ts`) — 작업대 머리줄 바로 아래와 받을 리소스 창 머리.
 * 9호 MAL3M08W2S1 은 배치표가 M30, 기획서가 M30_3 이었는데 앱 어디에도 말이 없었다 — 대화 속 Claude 가 기획서를 읽고서야 물었다.
 *
 * - `onChanged` 가 있으면(작업대) 「기획서대로 바꾸기」를 보인다. **두 번 눌러야 바꾼다** — 확인 창은 CDP 를 멈추게 해서 안 쓴다(`ResetCode.tsx` 와 같은 꼴)
 * - 없으면(받을 리소스 창) 한 줄만 — 바꾸는 것은 작업대에서 한다
 * - `seen` 이 바뀌면 다시 읽는다 — 작업대는 다시 읽은 형편(`Prepare`), 받을 리소스 창은 모듈 이름. 메인은 기획서를 처음 한 번만 읽는다
 * - 다르지 않아도 알릴 것(판 이름 `M30_1` · 다른 학습코드 기획서)은 흐린 한 줄로
 */
export default function PlanModuleNotice({ code, seen, onChanged }: { code: string; seen: unknown; onChanged?: () => void }) {
  const [got, setGot] = useState<PlanModule | null>(null)
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')

  // 다른 학습코드로 넘어가면 앞 것을 바로 버린다 — 앞 학습코드의 단추를 누르지 않게
  useEffect(() => {
    setGot(null)
    setArmed(false)
    setSaid('')
  }, [code])

  useEffect(() => {
    let live = true
    void window.api.forgePlanModule(code).then((r) => {
      if (live) setGot(r)
    })
    return () => {
      live = false
    }
  }, [code, seen])

  const use = useCallback(async () => {
    if (!armed) {
      setArmed(true)
      return
    }
    setBusy(true)
    try {
      const r = await window.api.forgePlanModuleUse(code)
      setGot(r)
      setSaid(r.said ?? r.error ?? '')
      setArmed(false)
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }, [armed, code, onChanged])

  if (!got || got.code !== code) return null
  if (!got.differs) {
    const line = said || got.note
    return line ? <p className="planmod-note">{line}</p> : null
  }
  const to = got.planModule
  return (
    <div className="planmod-warn" role="alert" title={got.plan ? `기획서 파일 ${got.plan}` : undefined}>
      <p className="planmod-say">
        기획서 모듈넘버는 <b className="mono">{to}</b>인데 배치표는 <b className="mono">{got.layoutModule}</b>입니다.
      </p>
      {onChanged ? (
        <>
          <div className="planmod-actions">
            <button className="planmod-go" disabled={busy} onClick={() => void use()}>
              {busy ? '바꾸는 중…' : `기획서대로 ${to} 모듈로 바꾸기`}
            </button>
            {armed && !busy && (
              <button className="ghost" onClick={() => setArmed(false)}>
                그만두기
              </button>
            )}
          </div>
          {armed && !busy && <p className="planmod-sub planmod-confirm">한 번 더 누르면 배치표를 {to} 모듈로 바꿉니다.</p>}
        </>
      ) : (
        <p className="planmod-sub">작업대에서 배치표를 바꾸세요.</p>
      )}
      {said && <p className="planmod-sub">{said}</p>}
    </div>
  )
}
