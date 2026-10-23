import { useEffect, useState } from 'react'
import type { PageNeeds as View } from '../../../../shared/forge'
import CopyButton from '../CopyButton'
import './pageneeds.css'

/**
 * **인터북 그림 — figma 에서 더 내보낼 판** (2026-10-13, 메인 `chatpages.ts` · forge `gen/pagemarks.ts`).
 * figma 는 누를 자리에 별을 그려서만 준다(사용자 — 「이짓거릴 계속 해야겠네? … 뭐 필요한지 얘기를 잘 해주면」).
 * 그림에서 별을 찾아 그림마다 「별을 숨긴 판」 · 「별만 숨긴 판(효과는 그대로)」 · 「별과 효과를 숨긴 판」 가운데 없는 것만 적는다.
 * 별이 하나도 없으면 아무것도 안 그린다. 작업대 왼쪽과 받을 리소스 창(`poll` 로 다시 읽음)이 같이 쓴다.
 */
export default function PageNeeds({ code, poll = 0 }: { code: string; poll?: number }) {
  const [v, setV] = useState<View | null>(null)
  useEffect(() => {
    let off = false
    setV(null)
    const read = (): void => void window.api.forgePageNeeds(code).then((r) => !off && setV(r))
    read()
    const t = poll ? setInterval(read, poll) : null
    return () => {
      off = true
      if (t) clearInterval(t)
    }
  }, [code, poll])
  if (!v || (!v.stars && !v.error)) return null
  const list = v.needs.map((n) => `${n.rel}: ${n.missing.join(', ')}`).join('\n')
  return (
    <section className="card page-needs">
      <h3>인터북 그림</h3>
      {v.error ? (
        <p className="state error">{v.error}</p>
      ) : v.needs.length === 0 ? (
        <p className="state done">별이 그려진 그림 {v.stars}장의 별 없는 그림이 모두 있습니다.</p>
      ) : (
        <>
          <p className="page-needs-say">figma 에서 아래 그림을 내보내 리소스 폴더에 넣으세요(파일 이름은 상관없습니다).</p>
          <ul className="page-needs-list">
            {v.needs.map((n) => (
              <li key={n.rel}>
                <span className="mono page-needs-name">{n.rel}</span>
                {n.missing.map((m) => (
                  <span key={m} className="page-needs-want">
                    {m}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="row-actions">
            <CopyButton text={list}>목록 복사</CopyButton>
            <span className="sub">{v.needs.reduce((s, n) => s + n.missing.length, 0)}장이 더 필요합니다.</span>
          </p>
        </>
      )}
    </section>
  )
}
