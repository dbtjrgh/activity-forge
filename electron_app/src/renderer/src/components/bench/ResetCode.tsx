import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { resetKeys, type CodeReset } from '../../../../shared/forge'
import { formatBytes } from '../../lib/format'
import './reset.css'

/**
 * **학습코드 초기화** (2026-10-13, `reset.ts`) — 리소스 폴더 칸 맨 아래. 다른 학습코드의 리소스를 넣고 대화까지 돌렸을 때 처음으로 돌린다.
 * 누르면 옮길 것을 먼저 보이고, 한 번 더 눌러야 옮긴다(확인 창은 CDP 를 멈추게 해서 안 쓴다).
 * 메인은 누른 때 다시 재고 여기 보인 항목만 옮긴다. 끝나면 작업대를 다시 읽는다(`onDone`).
 * 항목마다 「휴지통」 · 「되돌림」 표를 붙여 무엇이 어떻게 되는지 한눈에 보이게 한다(2026-10-13 「식별이 잘 되고」)
 */
function Row({ tag, children }: { tag: 'trash' | 'restore'; children: ReactNode }) {
  return (
    <li>
      <span className={`reset-tag reset-tag-${tag}`}>{tag === 'trash' ? '휴지통' : '되돌림'}</span>
      <span className="reset-what">{children}</span>
    </li>
  )
}

/**
 * `lock` — 남이 끝낸 학습코드라 막는 까닭(작업대 「그래도 고치기」 전). `force` — 푼 뒤라 잴 때 · 옮길 때 그렇게 부른다(2026-10-14).
 * 메인이 같은 판단(`owner.ts`)으로 다시 막는다 — 내가 끝내 커밋한 것은 풀어도 안 한다
 */
export default function ResetCode({ code, lock = '', force = false, onDone }: { code: string; lock?: string; force?: boolean; onDone: () => void }) {
  const [plan, setPlan] = useState<CodeReset | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')

  // 다른 학습코드로 넘어가거나 잠금을 풀면 앞 목록을 바로 버린다 — 앞 학습코드의 항목 · 풀기 전에 잰 까닭을 보내지 않게
  useEffect(() => {
    setPlan(null)
    setSaid('')
  }, [code, force])

  const look = useCallback(async () => {
    setSaid('')
    setBusy(true)
    try {
      setPlan(await window.api.forgeResetPlan(code, force))
    } finally {
      setBusy(false)
    }
  }, [code, force])

  const run = useCallback(async () => {
    if (!plan) return
    setBusy(true)
    try {
      const r = await window.api.forgeReset(code, resetKeys(plan), force)
      setSaid(
        r.error ??
          `${r.moved.length}개를 휴지통으로 옮기거나 되돌려 초기화했습니다.` +
            (r.failed.length ? ` 처리하지 못한 것 ${r.failed.length}개: ${r.failed.map((f) => `${f.rel}(${f.why})`).join(', ')}` : '')
      )
      setPlan(null)
      onDone()
    } finally {
      setBusy(false)
    }
  }, [code, plan, onDone, force])

  if (!plan) {
    return (
      <div className="reset-code">
        <button className="ghost" disabled={busy || Boolean(lock)} onClick={() => void look()}>
          학습코드 초기화
        </button>
        {said && <p className="reset-hint">{said}</p>}
      </div>
    )
  }
  const n = resetKeys(plan).length
  const ready = !busy && n > 0 && !plan.why && !plan.error
  return (
    <div className="reset-code reset-open">
      <p className="reset-title">{code} 초기화</p>
      {plan.error ? (
        <p className="state error">{plan.error}</p>
      ) : n === 0 ? (
        <p className="reset-hint">초기화할 것이 없습니다.</p>
      ) : (
        <>
          {(plan.rsc || plan.recipe.length > 0) && (
            <>
              <p className="reset-group">양산기</p>
              <ul className="reset-list">
                {plan.rsc && (
                  <Row tag="trash">
                    리소스 폴더 전체, 파일 {plan.rsc.files}개({formatBytes(plan.rsc.size)})
                  </Row>
                )}
                {plan.recipe.length > 0 && (
                  <Row tag="trash">
                    대화와 입력 기록 {plan.recipe.length}개
                    <span className="mono reset-path">{plan.recipe.join(', ')}</span>
                  </Row>
                )}
              </ul>
            </>
          )}
          {plan.hall.length > 0 && (
            <>
              <p className="reset-group">호 저장소에서 커밋하지 않은 변경 {plan.hall.length}개</p>
              <ul className="reset-list">
                {plan.hall.map((h) => (
                  <Row key={h.rel} tag={h.how === 'restore' ? 'restore' : 'trash'}>
                    {/* 파일 이름을 앞에, 폴더는 아래 작게 — 긴 경로가 이름 가운데서 끊겨 읽기 어려웠다 */}
                    <span className="mono">{h.rel.split('/').pop()}</span>
                    <span className="mono reset-path">{h.rel.split('/').slice(0, -1).join('/')}</span>
                  </Row>
                ))}
              </ul>
              <p className="reset-hint">「되돌림」은 지금 파일을 휴지통에 둔 뒤 마지막 커밋으로 되돌립니다.</p>
            </>
          )}
        </>
      )}
      {plan.why && <p className="state error">{plan.why}</p>}
      <div className="reset-actions">
        <button className="reset-go" disabled={!ready} onClick={() => void run()}>
          {busy ? '초기화하는 중…' : '휴지통으로 옮기고 초기화'}
        </button>
        <button className="ghost" disabled={busy} onClick={() => setPlan(null)}>
          그만두기
        </button>
      </div>
      <p className="reset-hint">배치표의 원본 선택은 그대로 둡니다.</p>
    </div>
  )
}
