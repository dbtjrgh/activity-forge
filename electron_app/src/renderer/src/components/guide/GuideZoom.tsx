import { useEffect, useState } from 'react'
import type { GuideItem } from '../../../../shared/forge'
import CopyButton from '../CopyButton'
import { sizeOf } from './GuideTiles'
import './guidezoom.css'

/** 크게 보기 — figma 에서 비슷한 그림을 가릴 때. 창 밖을 누르거나 Esc 로 닫는다 */
function GuideZoom({ code, origin, item, onClose }: { code: string; origin: string; item: GuideItem; onClose: () => void }) {
  // 그리는 중 · 못 그림을 가린다 — 빈 글이면 못 그린 것(그림이 아니거나 읽지 못함)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    setUrl(null)
    let live = true
    void window.api.guideThumbs(code, [item.rel], true).then((r) => {
      if (live) setUrl(r.thumbs[item.rel] ?? '')
    })
    return () => {
      live = false
    }
  }, [code, item.rel])
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div className="guide-zoom" onClick={onClose}>
      <div className="guide-zoom-card" onClick={(e) => e.stopPropagation()}>
        <div className="guide-zoom-pic guide-checker">
          {url ? <img src={url} alt="" /> : <span className="state">{url === null ? '불러오는 중…' : '그림으로 볼 수 없는 파일입니다.'}</span>}
        </div>
        <div className="guide-zoom-foot">
          <div className="guide-zoom-name">
            <b className="mono">{item.name}</b>
            <span className="sub mono">
              {sizeOf(item)}, {origin}/{item.rel}
            </span>
          </div>
          <CopyButton text={item.name}>이름 복사</CopyButton>
          <button className="ghost" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default GuideZoom
