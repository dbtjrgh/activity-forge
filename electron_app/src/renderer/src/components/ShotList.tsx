import type { Shot } from '../../../shared/forge'

/**
 * 붙여넣은 figma 화면의 **미리보기** — `ShotPaste.tsx` 에서 떼어 냄.
 *
 * **왜 그림을 보여 주나** (2026-09-21 사용자 말 — 「잘 붙여넣었는지 미리보기도
 * 구현해놓으면 좋을듯」). 붙여넣기 결과는 글 한 줄뿐이라, **엉뚱한 창을
 * 캡처했어도 똑같이 「화면을 받았습니다」로 보인다.** 그러면 AI 가 헛것을
 * 보고 답하고, 사람은 왜 틀렸는지 모른다. 줄여 그린 것 한 장이면 그 자리에서 안다.
 *
 * **크기도 같이 적는다.** 「잘렸나」는 눈으로 잘 안 보이는데 `1920×412` 처럼
 * 가로가 길고 세로가 짧으면 한 조각만 찍은 것이다.
 *
 * 여기는 **보여 주기만** 한다 — 불러오기와 지우기는 `ShotPaste.tsx` 가 한다.
 */
function ShotList({
  shots,
  busy,
  onDrop,
  onClear,
  onMove
}: {
  shots: Shot[]
  busy: boolean
  onDrop: (file: string) => void
  onClear: () => void
  /** 한 칸 앞(-1) · 뒤(+1)로 — **붙인 차례가 이닝 차례다**(2026-10-02 사용자 결정) */
  onMove?: (file: string, step: -1 | 1) => void
}): React.JSX.Element | null {
  if (!shots.length) return null
  return (
    <div className="shots">
      {/* 「붙인 차례대로 AI 가 다 봅니다」는 뺐다 (2026-09-21) — 그림이 차례로
          놓여 있는 것이 이미 그 말이다. */}
      <p className="shots-head">
        <b>{shots.length}장</b>{' '}
        <button className="ghost" disabled={busy} onClick={onClear}>
          모두 지우기
        </button>
      </p>
      <ul className="shot-grid">
        {shots.map((s, i) => (
          <li key={s.file} className="shot">
            {/* 못 그린 것도 자리를 비우지 않는다 — 있는데 안 보이는 것처럼 되면
                사람이 또 붙인다 (저장소 규칙 6). */}
            {s.thumb ? (
              <img src={s.thumb} alt={`${i + 1}번째 화면`} />
            ) : (
              <span className="shot-none">썸네일 없음</span>
            )}
            {/* 이닝 번호가 먼저 — 크기는 틀렸을 때만 눈에 걸리면 된다(1x 가 아니면 받지도 않는다) */}
            <span className="shot-meta">
              <b>{onMove ? `${i + 1}이닝` : `${i + 1}.`}</b>
              <span className="sub" title={s.file}>
                {/* PDF 기획서는 첫 쪽을 그린 것이라 크기가 뜻이 없다 */}
                {/\.pdf$/i.test(s.file) ? 'PDF' : s.width ? `${s.width}×${s.height}` : '크기 알 수 없음'}
              </span>
            </span>
            <span className="shot-acts">
              {onMove && (
                <>
                  <button className="ghost" disabled={busy || i === 0} title="한 칸 앞으로" onClick={() => onMove(s.file, -1)}>
                    ←
                  </button>
                  <button className="ghost" disabled={busy || i === shots.length - 1} title="한 칸 뒤로" onClick={() => onMove(s.file, 1)}>
                    →
                  </button>
                </>
              )}
              <button className="ghost" disabled={busy} title={`${s.file} 지우기`} onClick={() => onDrop(s.file)}>
                지우기
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ShotList
