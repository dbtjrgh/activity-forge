import { useEffect, useRef, useState } from 'react'
import { sendDrop, sortDrops } from '../lib/dropbus'

/**
 * **양산 화면 전체가 받는 자리** — 파일을 끌고 들어오면 화면 전체가 켜지고, 놓으면
 * 확장자로 나눠 리소스·기획서 칸에 넘긴다 (`lib/dropbus.ts`).
 *
 * 전에는 칸이 셋이라 **어느 칸에 놓아야 하는지** 사람이 골라야 했고, figma 칸에 파일을
 * 끌고 가는 헛수고도 있었다. 이제 어디든 놓으면 된다. 켜진 동안 어디로 가는지만
 * 두 줄로 보여 준다.
 *
 * **파일을 끌 때만 켠다** — 글이나 화면 안의 것을 끌 때는 안 켠다(`types` 에 `Files`).
 * `dragenter`·`dragleave` 는 자식 요소를 지날 때마다 번갈아 와서 수를 센다(0 이 되면 끈다).
 */
function DropAll({ busy }: { busy: boolean }): React.JSX.Element | null {
  const [on, setOn] = useState(false)
  const depth = useRef(0)

  useEffect(() => {
    const files = (e: DragEvent): boolean => [...(e.dataTransfer?.types ?? [])].includes('Files')
    const enter = (e: DragEvent): void => {
      if (!files(e)) return
      depth.current += 1
      setOn(true)
    }
    const over = (e: DragEvent): void => {
      // 막지 않으면 Electron 이 그 파일을 창에서 열어 버린다
      if (files(e)) e.preventDefault()
    }
    const leave = (e: DragEvent): void => {
      if (!files(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (!depth.current) setOn(false)
    }
    const drop = (e: DragEvent): void => {
      if (!files(e)) return
      e.preventDefault()
      depth.current = 0
      setOn(false)
      const paths = [...(e.dataTransfer?.files ?? [])].map((f) => window.api.pathForFile(f)).filter(Boolean) as string[]
      const sorted = sortDrops(paths)
      sendDrop('rsc', sorted.rsc)
      sendDrop('plan', sorted.plan)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  if (!on) return null
  return (
    <div className="drop-all" aria-hidden="true">
      <div className="drop-all-box">
        <p className="drop-all-title">{busy ? '진행 중인 작업이 끝나면 넣습니다' : '여기 놓으세요'}</p>
        <p className="drop-all-route">
          <span className="chip">그림, 소리, 영상, 애니메이션, 폴더</span> → 리소스
        </p>
        <p className="drop-all-route">
          <span className="chip">PDF</span> → 기획서
        </p>
      </div>
    </div>
  )
}

export default DropAll
