import { useCallback } from 'react'
import Bay from './Bay'
import ShotList from './ShotList'
import { usePapers } from '../lib/papers'
import { useDropped } from '../lib/dropbus'

/**
 * **기획서 넣기** (2026-09-21 사용자 말 — 「기획서 통로 만들어」).
 *
 * figma 화면은 **어느 그림이 어디에 오나**를 알려 주고, 기획서는 **어떤
 * 낱말·숫자·차례인가**를 알려 준다. 완성본 셋을 다시 만들어 재 보니
 * **리소스 표는 77% 가 맞는데 값은 32%** 였다 — 값의 근거가 통째로 없었다.
 * 완성본 주석도 「기획서 10쪽 표와 대조해 그대로다」라고 적고 있다.
 *
 * **Ctrl+V 를 여기에 달지 않는다.** figma 쪽(`ShotPaste.tsx`)이 이미 창
 * 전체의 붙여넣기를 듣고 있어서, 여기도 들으면 한 번 붙인 것이 **양쪽에 다
 * 들어간다.** 그래서 이쪽은 **끌어다 놓기**와 **단추**로 받는다 —
 * 어디로 가는지가 사람 눈에 분명하다.
 *
 * **PDF 를 그대로 받는다.** `claude -p` 가 여는 `Read` 가 그림과 PDF 를
 * 읽는다. PPT·엑셀은 못 여니 그런 것은 해당 쪽을 캡처해서 넣는다 —
 * 아래 안내에 그렇게 적어 둔다.
 *
 * **끌어다 놓은 파일의 자리는 `File.path` 로 못 얻는다**(저장소 함정) —
 * `window.api.pathForFile` 로 얻는다. `RscDrop.tsx` 와 같은 길이다.
 */
function PlanDrop({
  code,
  busy,
  reader = '',
  onChanged
}: {
  code: string
  busy: boolean
  /** poppler 가 안 돌 때 그 까닭(M5, `Prepare.planReader`) — 넣어도 AI 가 조용히 기획서 없이 답한다 */
  reader?: string
  /**
   * PDF 를 넣었다 — 작업대가 다시 읽는다. 모듈이 갈린 MA 칸은 그때 기획서의 모듈넘버로 배치표를 채운다(`prepare.ts`).
   * 안 부르면 기획서를 넣고도 작업대를 다시 열 때까지 「모듈을 고르세요」가 남는다
   */
  onChanged?: () => void
}): React.JSX.Element {
  const { items, note, setNote, reload, dropOne, clear } = usePapers(code, 'plan')

  const take = useCallback(
    async (paths: string[]): Promise<void> => {
      if (!paths.length) {
        setNote('파일 경로를 읽지 못했습니다. 파일을 다시 끌어다 놓으세요.')
        return
      }
      // **한 장씩 넣고 마지막 말만 남긴다.** 넣다 막히면 그 까닭이 보여야 한다.
      for (const at of paths) {
        const got = await window.api.forgeAddShotFile(code, at, 'plan')
        setNote(got.error || got.note)
        if (got.error) break
      }
      await reload()
      onChanged?.()
    },
    [code, reload, setNote, onChanged]
  )

  const fromClipboard = useCallback(async (): Promise<void> => {
    const got = await window.api.forgePasteShot(code, 'plan')
    setNote(got.error || got.note)
    await reload()
  }, [code, reload, setNote])

  // **화면 어디에 놓아도 PDF 는 여기로 온다** (2026-09-23, `DropAll.tsx`). 이 칸이 따로 받지 않는다.
  const dropped = useCallback((paths: string[]) => void take(paths), [take])
  useDropped('plan', dropped)

  return (
    <Bay
      icon="plan"
      title="기획서"
      hint="PDF는 화면에 끌어다 놓고, PPT와 엑셀은 캡처해서 넣으세요."
      count={items.length}
      busy={busy}
    >
      {/* **머리줄에 넣지 않는다** — 칸이 셋이라 좁아서 제목이 글자 사이에서
          잘린다. 끌어다 놓기가 본길이고 이것은 곁길이라 아래가 맞다. */}
      {reader && <p className="state warn">{reader}</p>}
      <p className="row-actions">
        <button className="ghost" type="button" onClick={() => void fromClipboard()} disabled={busy}>
          클립보드 이미지 붙여넣기
        </button>
        {note ? <span className="sub">{note}</span> : null}
      </p>
      <ShotList
        shots={items}
        busy={busy}
        onDrop={(f) => void dropOne(f)}
        onClear={() => void clear()}
      />
    </Bay>
  )
}

export default PlanDrop
