import { useEffect, useState } from 'react'

/**
 * **미리보기 창에서 난 오류** (2026-09-29) — 빈 화면의 까닭을 작업대에 띄운다. 모으는 것은 메인 `preview.ts`.
 * 9호 KOL1M08W1S3 이 검사를 다 지나고도 빈 배경에서 멈췄는데, 까닭은 창 콘솔에만 있었다.
 *
 * 「asset 이 없다」 류는 **이름만** 모아 한 줄로 — 같은 그림이 열 번씩 찍힌다. 나머지 오류는 몇 줄만.
 * 이 학습코드의 창일 때만 보인다(한 창을 여러 학습코드가 돌려 쓴다).
 */

const MISSING = [/Asset id (\S+) was not found/, /asset\[\s*(\S+)\s*\]/]
const EVERY_MS = 3000
const SHOW = 4

function PreviewIssues({ code }: { code: string }) {
  const [got, setGot] = useState<string[]>([])
  useEffect(() => {
    let off = false
    const read = (): void => {
      void window.api.forgePreviewIssues().then((r) => {
        if (!off) setGot(r.url.includes(`/${code}/`) ? r.issues : [])
      })
    }
    read()
    const t = setInterval(read, EVERY_MS)
    return () => {
      off = true
      clearInterval(t)
    }
  }, [code])

  if (!got.length) return null
  const names = new Set<string>()
  const rest: string[] = []
  for (const line of got) {
    const hit = MISSING.map((r) => r.exec(line)?.[1]).find(Boolean)
    if (hit) names.add(hit)
    else rest.push(line)
  }
  return (
    <div className="state error">
      <p>미리보기에서 오류가 발생했습니다. 화면이 비어 있거나 멈출 수 있습니다.</p>
      {names.size > 0 && <p>없는 리소스: {[...names].join(', ')}</p>}
      {rest.slice(0, SHOW).map((l) => (
        <p key={l} className="mono">
          {l}
        </p>
      ))}
    </div>
  )
}

export default PreviewIssues
