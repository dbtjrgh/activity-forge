import { useState } from 'react'

/**
 * 진행판에 없는 것을 만들 때 학습코드를 적는 칸 — `App.tsx` 에서 떼어 냄.
 * 진행판 줄의 「양산」과 같은 자리(`onGo`)로 간다.
 */
function CodeGo({ onGo }: { onGo: (code: string) => void }) {
  const [typed, setTyped] = useState('')
  return (
    <form
      className="code-go"
      onSubmit={(e) => {
        e.preventDefault()
        const code = typed.trim().toUpperCase()
        if (code) onGo(code)
      }}
    >
      <input
        className="code-input mono"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="ENL1M06W3S1"
        spellCheck={false}
      />
      <button className="ghost" type="submit">
        열기
      </button>
    </form>
  )
}

export default CodeGo
