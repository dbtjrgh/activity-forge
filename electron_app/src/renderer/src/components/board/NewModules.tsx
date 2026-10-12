import { useCallback, useEffect, useState } from 'react'
import type { NewModules as Found } from '../../../../shared/forge'

/**
 * **「새 모듈」 알림** — 스펙 주인의 옆줄에만 (2026-09-29 사용자 말 — 「신규모듈같은게 나왔을 때 나한테 보고되도록」).
 * 열린 진행판의 배치표가 정했는데 스펙이 없는 모듈(`newmodules.ts`). 모듈마다 **「Claude 에게 줄 글 복사」** —
 * 스펙은 이 저장소에서 Claude 에게 시킨다(사용자 말). 앱 안 스펙 창은 두지 않는다.
 * **그 모듈을 쓴 완성본이 없으면 초안을 못 뽑는다**(완성본을 견줘 쓴다) — 그렇다고 줄에 적는다.
 *
 * `stamp` 가 바뀌면(진행판 목록이 바뀜 — 호를 열거나 배치표를 받음) 다시 센다.
 */
export default function NewModules({ stamp }: { stamp: string }) {
  const [got, setGot] = useState<Found | null>(null)
  const [copied, setCopied] = useState('')
  useEffect(() => {
    let off = false
    void window.api.forgeNewModules().then((r) => !off && setGot(r))
    return () => {
      off = true
    }
  }, [stamp])
  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => setCopied(`${key} 요청문을 복사했습니다. Claude에게 붙여 넣으세요.`),
      () => setCopied(`${key} 복사에 실패했습니다.`)
    )
  }, [])

  if (!got) return null
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
            <button className="ghost" onClick={() => copy(`${m.subject}/${m.module}`, m.ask)} title={m.ask}>
              요청문 복사
            </button>
          </li>
        ))}
      </ul>
      <p className="sub">스펙을 커밋하고 푸시하면 다른 개발자에게 업데이트 알림이 표시됩니다.</p>
      {copied && <p className="sub">{copied}</p>}
    </details>
  )
}
