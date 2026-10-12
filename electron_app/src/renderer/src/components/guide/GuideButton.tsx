import { useState } from 'react'
import './guidebutton.css'

/**
 * 받을 리소스 창을 여는 단추 — 작업대 「부족한 리소스」(크게) · 「관리」 받을 리소스(작게)가 같이 쓴다. 못 열면 까닭을 그 자리에.
 * **작업대 것은 양산의 첫 손이라 크게 둔다**(2026-09-30 사용자 말 — 「나름 핵심 버튼이라서」). 무엇이 뜨는지를 단추 안에 한 줄로
 */
function GuideButton({ code, big = false, short = 0 }: { code: string; big?: boolean; short?: number }) {
  const [why, setWhy] = useState('')
  const open = (): void => void window.api.guideOpen(code).then(setWhy)
  return (
    <>
      {big ? (
        <button className="guide-open" onClick={open} title="원본 학습코드의 리소스를 새 창에서 확인합니다">
          <span className="guide-open-label">
            받을 리소스 보기
            {short > 0 && <span className="guide-open-count">{short}개 부족</span>}
          </span>
        </button>
      ) : (
        <button className="ghost" onClick={open} title="원본 학습코드의 리소스를 새 창에서 확인합니다">
          리소스 보기
        </button>
      )}
      {why && <span className="state error"> {why}</span>}
    </>
  )
}

export default GuideButton
