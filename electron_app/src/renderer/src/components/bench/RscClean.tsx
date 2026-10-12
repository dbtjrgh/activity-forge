import { useCallback, useEffect, useState } from 'react'
import type { RscClean as Plan } from '../../../../shared/forge'
import { formatBytes } from '../../lib/format'

/**
 * **「검수」 칸 맨 아래 — 완료 뒤 리소스 폴더 정리** (2026-10-12, `rscclean.ts`). 기획서(`_plan`)만 남기고 나머지를 휴지통으로.
 * 개발 완료 표시가 없거나 옮길 것이 없으면 아무것도 안 그린다. 옮길 수 없으면 단추를 끄고 까닭을 옆에 적는다.
 * `refresh` 가 바뀌면(검수 완료 · 커밋 뒤) 다시 잰다. 옮길 것은 메인이 누른 때 다시 재고, 여기 보인 항목과 겹치는 것만 옮긴다.
 */
export default function RscClean({ code, refresh }: { code: string; refresh: string }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')

  const load = useCallback(async () => setPlan(await window.api.forgeRscCleanPlan(code)), [code])

  // 다른 학습코드로 넘어가면 앞 목록을 바로 비운다 — 새 목록이 오기 전에 누르면 앞 학습코드의 항목 이름을 보낸다
  useEffect(() => {
    setPlan(null)
    setSaid('')
  }, [code])

  useEffect(() => {
    void load()
  }, [load, refresh])

  const clean = useCallback(async () => {
    setBusy(true)
    try {
      const r = await window.api.forgeRscClean(code, plan?.entries.map((e) => e.name) ?? [])
      setSaid(
        r.error ??
          `리소스 폴더에서 ${r.moved.length}개를 휴지통으로 옮겼습니다.` +
            (r.failed.length ? ` 옮기지 못한 것 ${r.failed.length}개: ${r.failed.map((f) => `${f.rel}(${f.why})`).join(', ')}` : '')
      )
      await load()
    } finally {
      setBusy(false)
    }
  }, [code, plan, load])

  if (!plan) return null
  if (plan.error) return <p className="sub">{plan.error}</p>
  if (!plan.finished || !plan.entries.length) return said ? <p className="state done">{said}</p> : null
  const total = plan.entries.reduce((n, e) => n + e.size, 0)
  return (
    <div className="rsc-clean">
      <p className="row-actions">
        <button
          className="ghost"
          disabled={busy || Boolean(plan.why)}
          onClick={() => void clean()}
          title="정리한 뒤 이 학습코드를 대화로 다시 만들려면 리소스를 다시 넣어야 합니다."
        >
          {busy ? '정리하는 중…' : '리소스 폴더 정리'}
        </button>
        <span className="sub">{plan.why || `기획서를 빼고 ${plan.entries.length}개(${formatBytes(total)})를 휴지통으로 옮깁니다.`}</span>
      </p>
      {said && <p className="sub">{said}</p>}
    </div>
  )
}
