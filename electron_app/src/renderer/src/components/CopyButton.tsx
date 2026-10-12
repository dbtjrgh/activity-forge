import { useState } from 'react'

/** 글을 클립보드로 — 「관리」 받을 리소스 · 받을 리소스 창이 같이 쓴다(2026-09-30, RscSection.tsx 에서 뗌 — 동작 변화 없음) */
function CopyButton({ text, children }: { text: string; children: string }) {
  // 창에 초점이 없으면 클립보드가 거부한다 — 조용히 넘기지 않고 말한다
  const [said, setSaid] = useState('')
  const show = (word: string): void => {
    setSaid(word)
    setTimeout(() => setSaid(''), 1500)
  }
  const copy = (): void =>
    void navigator.clipboard.writeText(text).then(
      () => show('복사했습니다'),
      () => show('복사하지 못했습니다')
    )
  return (
    <button className="ghost" onClick={copy}>
      {said || children}
    </button>
  )
}

export default CopyButton
