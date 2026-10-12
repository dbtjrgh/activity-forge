import { useCallback, useEffect, useState } from 'react'
import Bay from './Bay'
import ShotList from './ShotList'
import { usePapers } from '../lib/papers'

/**
 * figma 화면 붙여넣기 (Ctrl+V) — `RunPanel.tsx` 에서 떼어 냄.
 *
 * **폴더에 파일로 넣으라고 하지 않는다.** figma 에서 캡처하고 이 화면에서
 * 붙여넣으면 그것으로 끝이다. 받은 뒤에는 **그대로 다시 돌린다**(`onPasted`) —
 * 화면이 생겼다는 것은 「이제 자리를 정할 수 있다」는 뜻이라, 또 누르게 할 까닭이 없다.
 *
 * **여러 장을 받는다** (2026-09-21 사용자 말 — 「여러개 figma 붙여놓을수도
 * 있으니까」). 앞 장을 지우지 않고 쌓고, 브리프가 전부를 이름으로 부른다
 * (`shot.ts`). 한 장에 다 안 담기는 것이 오히려 보통이다.
 *
 * **붙인 것을 그림으로 보여 준다** (같은 날, 「잘 붙여넣었는지 미리보기도」).
 * 글 한 줄만 보여 주면 엉뚱한 창을 캡처해도 똑같이 「받았습니다」로 보인다 —
 * 미리보기는 `ShotList.tsx` 가 그린다.
 *
 * **도는 중에도 받는다.** 전에는 `busy` 면 **아무 말 없이 흘려 버렸다** —
 * 화면에는 「Ctrl+V 로 붙여넣으면 됩니다」가 그대로 적혀 있는데 눌러도 오류도
 * 표시도 없어서, 사용자는 **캡처가 잘못된 줄 알고 같은 것을 몇 번이나 다시
 * 떴다.** 저장소 규칙 6번(모른다를 숨기지 않는다)에 걸리는 자리다.
 *
 * 붙이는 일은 `_figma` 에 파일 한 장을 쓰는 것뿐이라 도는 중에 해도 된다.
 * **다시 돌리는 것만 미룬다** — 도는 것을 가로채면 그때까지 한 일이 날아간다.
 *
 * **그림이 아닌 붙여넣기는 그대로 흘린다.** figma 의 맨 `Ctrl+C` 는 도형
 * 데이터라 그림이 아니다 (2026-09-21 에 실제로 그래서 안 붙었다). 그때는
 * 우리 일이 아니므로 가로채지 않고, 대신 **무엇으로 캡처해야 하는지** 적어 둔다.
 */
function ShotPaste({
  code,
  busy,
  onPasted
}: {
  code: string
  busy: boolean
  onPasted: () => Promise<void>
}): React.JSX.Element {
  // 읽기·지우기는 기획서 쪽과 **같은 셈**을 쓴다 (`lib/papers.ts`).
  const { items: shots, note: shot, setNote: setShot, reload, dropOne, clear, move } = usePapers(
    code,
    'figma'
  )
  /** 도는 중에 받아 둔 것이 있나 — 끝나면 그때 다시 돌린다. */
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    setWaiting(false)
  }, [code])

  // **Ctrl+V 와 단추가 같은 셈이다** — 클립보드의 그림을 `_figma` 에 한 장 쓴다.
  const pasteNow = useCallback(async (): Promise<void> => {
    const got = await window.api.forgePasteShot(code, 'figma')
    if (got.error) {
      setShot(got.error)
      return
    }
    // **그림부터 보여 준다.** 미리보기가 떠야 「잘못 붙였다」를 그 자리에서 안다.
    await reload()
    if (busy) {
      // **받아는 뒀다고 말한다.** 조용히 넘어가면 안 붙은 것과 구별이 안 된다.
      // 대화 중에 붙인 화면은 다음 답과 함께 Claude 에게 간다(chat.ts 가 새로 들어온 파일을 알린다) — 이전 방식처럼 다시 생성하지 않는다(2026-10-08)
      setShot(`${got.note} 다음 답을 보낼 때 Claude 에게 함께 알립니다.`)
      setWaiting(true)
      return
    }
    setShot(got.note)
    await onPasted()
  }, [code, busy, onPasted, reload, setShot])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      // 다른 칸이 이미 받은 붙여넣기는 넘긴다 — 대화 답 칸에 붙인 그림이 figma 화면으로도 들어갔다 (2026-10-08)
      if (e.defaultPrevented) return
      // 글을 붙여넣은 것까지 가로채지 않는다. 그림일 때만 우리 일이다.
      const has = [...(e.clipboardData?.items ?? [])].some((i) => i.type.startsWith('image/'))
      if (!has) return
      e.preventDefault()
      void pasteNow()
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [pasteNow])

  // 도는 것이 끝났고 받아 둔 화면이 있으면 **그때 한 번** 작업대를 다시 읽는다.
  // **여기서 목록을 다시 읽지 않는다** — 붙일 때 이미 읽었고, 도는 동안
  // 화면이 늘거나 줄지 않는다(늘리는 것도 지우는 것도 사람이 하고, 그때마다
  // `reload` 를 부른다). 여기서 또 부르면 같은 것을 두 번 읽는다.
  useEffect(() => {
    if (busy || !waiting) return
    setWaiting(false)
    void (async () => {
      setShot('붙인 화면을 반영해 다시 읽었습니다.')
      await onPasted()
    })()
  }, [busy, waiting, onPasted])

  return (
    <Bay
      icon="shot"
      title="figma 화면"
      how="paste"
      hint="figma 프레임을 캡처해 넣으세요."
      count={shots.length}
      busy={busy}
    >
      {/* **비어 있을 때만 크게** (2026-09-23 사용자 말 — 「이쁘게 실용성 있게」). 무엇을 누르면
          되는지가 한눈에 — 캡처 단축키 둘과 붙이는 길 둘(Ctrl+V · 단추). 쌓이면 미리보기가 자리를 쓴다. */}
      {shots.length === 0 && (
        <div className="shot-empty">
          <p className="shot-keys">
            <span>
              figma 프레임 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd>
            </span>
            <span className="shot-arrow">→</span>
            <span>
              <kbd>Ctrl</kbd>+<kbd>V</kbd> 붙여넣기
            </span>
          </p>
          {/* M5 — 붙일 때 1x 를 가른다(`ipc/shots.ts` oneX). 제멋대로 크기의 캡처는 받지 않으니 권하지 않는다 */}
          <p className="sub" title="Win+Shift+S 캡처는 크기가 맞지 않아 받지 않습니다.">1x(1920×1080) PNG만 받습니다.</p>
        </div>
      )}
      <p className="row-actions">
        <button className="ghost" type="button" onClick={() => void pasteNow()}>
          클립보드에서 붙여넣기
        </button>
      </p>
      {shot ? <p className="sub">{shot}</p> : null}
      <ShotList
        shots={shots}
        busy={busy}
        onDrop={(f) => void dropOne(f)}
        onMove={(f, step) => void move(f, step)}
        onClear={() => void clear()}
      />
    </Bay>
  )
}

export default ShotPaste
