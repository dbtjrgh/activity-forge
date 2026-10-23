import { useCallback, useEffect, useState } from 'react'
import type { NewModules as Found } from '../../../../shared/forge'

/**
 * **「새 모듈」 알림** (2026-09-29 사용자 말 — 「신규모듈같은게 나왔을 때 나한테 보고되도록」).
 * 처음에는 스펙 주인의 옆줄에만 띄웠고, **2026-10-21 부터 모두에게 띄운다** — 사용자 결정 「git 권한 있는 사람은 다 스펙을 만들게」.
 * 열린 진행판의 배치표가 정했는데 스펙이 없는 모듈(`newmodules.ts`). 모듈마다 **「요청문 복사」**(Claude 에게 줄 글) —
 * 스펙은 제 양산기 저장소에서 Claude Code 에게 시키고 main 에 푸시한다(그러면 남의 「업데이트」가 켜진다). 앱 안 스펙 창은 두지 않는다.
 * **그 모듈을 쓴 완성본이 없으면 초안을 못 뽑는다**(완성본을 견줘 쓴다) — 그렇다고 줄에 적는다.
 *
 * `stamp` 가 바뀌면(진행판 목록이 바뀜 — 호를 열거나 배치표를 받음) 다시 센다.
 * **같은 `stamp` 로는 다시 묻지 않는다** (2026-10-21) — 한 번 세는 데 메인이 진행판 34장을 다 읽는다(1초 넘게, `newmodules.ts`).
 * 폴더 화면에 갔다 오면 이 알림이 새로 그려져 그때마다 다시 셌다. 진행판을 아직 못 읽었으면(`stamp` 가 빔) 셀 것이 없어 안 묻는다.
 */

/** 마지막으로 센 것 — 화면이 새로 그려져도 남는다. 오류는 담지 않는다(다시 그려지면 다시 묻게) */
let last: { stamp: string; got: Found } | null = null

export default function NewModules({ stamp }: { stamp: string }) {
  const [fresh, setFresh] = useState<Found | null>(last?.got ?? null)
  // 이 stamp 로 센 것이 있으면 그것이 먼저다 — 다른 stamp 에서 받은 오류가 화면에 남지 않게
  const got = last?.stamp === stamp ? last.got : fresh
  const [copied, setCopied] = useState('')
  useEffect(() => {
    if (!stamp || last?.stamp === stamp) return
    let off = false
    void window.api.forgeNewModules().then((r) => {
      if (!r.error) last = { stamp, got: r }
      if (!off) setFresh(r)
    })
    return () => {
      off = true
    }
  }, [stamp])
  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => setCopied(`${key} 요청문을 복사했으니 Claude에게 붙여 넣으세요.`),
      () => setCopied(`${key} 복사에 실패했습니다.`)
    )
  }, [])

  if (!stamp || !got) return null
  if (got.error) return <p className="state error">새 모듈 확인 실패: {got.error}</p>
  if (!got.modules.length) return null

  return (
    <details className="new-modules">
      <summary>
        <span className="tag nomod">새 모듈 {got.modules.length}</span>
        <span className="sub">스펙이 없어 생성할 수 없습니다</span>
      </summary>
      <ul>
        {got.modules.map((m) => (
          <li key={`${m.subject}/${m.module}`}>
            <b className="nm-name">{m.subject} {m.module}</b>
            <span className="sub" title={m.codes.join('\n')}>
              학습코드 {m.codes.length}개, {m.samples ? `완성본 ${m.samples}개` : '완성본 없음 (초안 작성 불가)'}
            </span>
            <button className="ghost" onClick={() => copy(`${m.subject}/${m.module}`, m.ask)}>
              요청문 복사
            </button>
          </li>
        ))}
      </ul>
      {copied && <p className="sub">{copied}</p>}
    </details>
  )
}
