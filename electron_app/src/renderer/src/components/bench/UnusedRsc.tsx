import { useCallback, useEffect, useState } from 'react'
import type { PubExtra } from '../../../../shared/forge'
import { formatBytes } from '../../lib/format'

/**
 * **「검수」 칸 아래 — 호 저장소에 있는데 안 쓰는 리소스** (2026-10-12, `pubextra.ts`). 없으면 아무것도 안 그린다.
 * 셈은 짐작이다(모듈이 이름을 조립해 부르는 파일은 다 못 알아본다) — 그래서 저절로 안 지우고 사람이 목록을 보고 누른다.
 * 목록은 열 때 · 대화가 끝날 때(`wait` 가 바뀔 때) · 옮긴 뒤 다시 읽는다. 지울 것은 메인이 누른 때 다시 세고,
 * 여기 보인 목록과 겹치는 것만 옮긴다 — 그새 들어온 파일은 사람이 못 봤다.
 */
/** `force` — 남이 끝낸 학습코드를 작업대에서 「그래도 고치기」로 풀었다. 그 잠금(`locked`)만 넘고 메인이 다시 판단한다 */
export default function UnusedRsc({ code, wrote, wait = '', force = false }: { code: string; wrote: boolean; wait?: string; force?: boolean }) {
  const [got, setGot] = useState<PubExtra | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')

  const load = useCallback(async () => setGot(await window.api.forgePubExtra(code)), [code])

  // 다른 학습코드로 넘어가면 앞 목록을 바로 비운다 — 새 목록이 오기 전에 누르면 앞 학습코드의 목록(같은 이름 bg.png 등)을 보낸다
  useEffect(() => setGot(null), [code])

  useEffect(() => {
    setSaid('')
    void load()
  }, [load, wrote, wait])

  const trash = useCallback(async () => {
    setBusy(true)
    try {
      const r = await window.api.forgePubExtraTrash(code, got?.files.map((f) => f.rel) ?? [], force)
      setSaid(
        r.error ??
          `파일 ${r.moved.length}개를 휴지통으로 옮겼습니다.` +
            (r.failed.length ? ` 옮기지 못한 파일 ${r.failed.length}개: ${r.failed.map((f) => `${f.rel}(${f.why})`).join(', ')}` : '')
      )
      await load()
    } finally {
      setBusy(false)
    }
  }, [code, got, load, force])

  if (!got) return null
  const locked = force ? '' : (got.locked ?? '')
  if (got.error) return <p className="sub">{got.error}</p>
  if (!got.files.length) return said ? <p className="state done">{said}</p> : null
  return (
    <div className="unused-rsc">
      <p className="state warn">호 저장소에 쓰지 않는 파일이 {got.files.length}개 있습니다.</p>
      <ul className="sub main-extra">
        {got.files.map((f) => (
          <li key={f.rel} className="mono">
            {f.rel} ({formatBytes(f.size)})
          </li>
        ))}
      </ul>
      <p className="row-actions">
        <button
          className="ghost"
          disabled={busy || Boolean(wait) || Boolean(locked)}
          onClick={() => void trash()}
          title="쓰는 파일이 섞여 있을 수 있으니 확인한 뒤 누르세요."
        >
          {busy ? '옮기는 중…' : '휴지통으로 옮기기'}
        </button>
        {locked && <span className="sub">{locked}</span>}
      </p>
      {said && <p className="sub">{said}</p>}
    </div>
  )
}
