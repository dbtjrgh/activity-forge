import { useState } from 'react'
import { HO_OF, type OriginChoices } from '../../../../shared/forge'
import './originpicker.css'

const hoName = (issue: string): string => HO_OF[issue]?.name ?? `M${issue}`

/**
 * **원본 바꾸기** (2026-09-30) — 그 모듈을 쓴 앞 학습코드 전부에서 하나를 고른다. 작업대 「모듈과 원본」 · 받을 리소스 창이 같이 쓴다.
 * 고르면 배치표에 적고(`services/forge/originpick.ts`) 부른 쪽이 다시 읽는다. 확인 창(`window.confirm`)은 안 띄운다 — 고르고 한 번 더 누른다
 */
function OriginPicker({ code, onChanged }: { code: string; onChanged?: () => void }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<OriginChoices | null>(null)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')

  const show = (): void => {
    setOpen(true)
    setSaid('')
    void window.api.forgeOriginChoices(code).then((d) => {
      setData(d)
      setPick(d.now)
    })
  }
  const write = (to: string | null): void => {
    setBusy(true)
    void window.api.forgeOriginPick(code, to).then((d) => {
      setBusy(false)
      setData(d)
      if (d.error) return setSaid(d.error)
      setPick(d.now)
      setSaid(to ? `원본을 변경했습니다: ${to}` : '원래 원본으로 되돌렸습니다.')
      onChanged?.()
    })
  }

  const trash = (): void => {
    setBusy(true)
    void window.api.forgeLeftoverTrash(code).then((r) => {
      setBusy(false)
      setSaid(
        r.error ??
          `파일 ${r.moved.length}개를 휴지통으로 옮겼습니다.` +
            (r.failed.length ? ` ${r.failed.length}개는 옮기지 못했습니다: ${r.failed[0]?.why ?? ''}` : '')
      )
      void window.api.forgeOriginChoices(code).then(setData)
      onChanged?.()
    })
  }
  // 생성 때 잰 장면 점수(`services/forge/scene.ts`) — 열 때 새로 재지 않는다
  const sceneOf = (c: string): { hits: number; tried: number } | undefined => data?.scene?.scores.find((s) => s.code === c)

  if (!open)
    return (
      <button className="ghost" onClick={show}>
        원본 변경
      </button>
    )

  return (
    <div className="origin-pick">
      <div className="origin-pick-head">
        <b>원본 선택</b>
        <span className="sub">{data ? `${data.module} 모듈을 사용하는 학습코드 ${data.choices.length}개 (추천 순)` : '불러오는 중…'}</span>
      </div>
      {data?.scene?.better && (
        <p className="state warn">
          figma 화면의 장면이 지금 원본과 다릅니다. {data.scene.better} 학습코드의 장면 그림이 화면에 더 많이 있습니다.
        </p>
      )}
      {data?.error && !data.choices.length ? (
        <p className="state error">{data.error}</p>
      ) : (
        <ul className="origin-pick-list">
          {data?.choices.map((c) => (
            <li key={c.code}>
              <button className={`origin-pick-row${pick === c.code ? ' on' : ''}`} onClick={() => setPick(c.code)}>
                <span className="mono">{c.code}</span>
                <span className="sub">
                  {hoName(c.issue)} {c.slot}
                </span>
                <span className="origin-pick-tags">
                  {c.code === data.now && <span className="tag mine">현재</span>}
                  {c.code === data.first && <span className="tag">추천</span>}
                  {!c.sameSlot && <span className="tag warn" title="레벨, 주, 순서가 달라 구성이 다를 수 있습니다">위치 다름</span>}
                  {(sceneOf(c.code)?.tried ?? 0) > 0 && (
                    <span
                      className={`tag${c.code === data.scene?.better ? ' settled' : ''}`}
                      title="figma 화면에서 이 학습코드의 장면 그림을 찾은 수와 찾아본 수입니다"
                    >
                      장면 {sceneOf(c.code)?.hits}/{sceneOf(c.code)?.tried}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="sub">원본을 변경하면 다음 생성 때 AI를 다시 실행합니다.</p>
      {!!data?.leftover.length && (
        <div className="origin-left">
          <p className="state warn">
            다른 호 원본의 파일 {data.leftover.length}개가 리소스 폴더에 남아 있습니다. 지금 원본은 쓰지 않는 파일입니다.
          </p>
          <details>
            <summary>파일 보기</summary>
            <ul>
              {data.leftover.map((f) => (
                <li key={f.rel}>
                  <span className="mono">{f.rel}</span> <span className="sub">{f.from}</span>
                </li>
              ))}
            </ul>
          </details>
          <button className="ghost" disabled={busy || data.running} onClick={trash}>
            휴지통으로 옮기기
          </button>
        </div>
      )}
      {said && <p className={`state${data?.error ? ' error' : ''}`}>{said}</p>}
      <div className="origin-pick-foot">
        <button className="go" disabled={busy || !pick || pick === data?.now || data?.running} onClick={() => write(pick)}>
          이 원본으로 변경
        </button>
        {data?.changed && (
          <button className="ghost" disabled={busy} onClick={() => write(null)}>
            원래 원본으로 되돌리기
          </button>
        )}
        <button className="ghost" onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>
      {data?.running && <p className="state warn">생성 중에는 원본을 변경할 수 없습니다.</p>}
    </div>
  )
}

export default OriginPicker
