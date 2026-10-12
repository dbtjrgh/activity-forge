import type { GuideItem } from '../../../../shared/forge'
import { kindName } from '../../lib/format'
import { useThumbs, type ThumbSource } from '../bench/useThumbs'
import './guidetiles.css'

/** 받을 리소스 창의 그림은 **앞 학습코드 폴더**에서 — 메인이 배치표로 폴더를 정한다(`ipc/guide.ts`) */
const ORIGIN: ThumbSource ={ key: 'guide', get: (code, files) => window.api.guideThumbs(code, files) }

export const sizeOf = (i: GuideItem): string => (i.w && i.h ? `${i.w}×${i.h}` : kindName(i.kind))

/** 형편 딱지 — 이름으로 왔으면 「왔음」, 크기만 맞으면 「크기 맞음」(실마리), 같은 크기 묶음이면 몇 장 왔나 */
export function Mark({ item }: { item: GuideItem }) {
  if (item.state === 'name') return <span className="guide-mark name">✓ 받음</span>
  if (item.state === 'set')
    return (
      <span className="guide-mark name" title={`${item.pick} 파일로 정했습니다.`}>
        ✓ 정함
      </span>
    )
  if (item.state === 'hint')
    return (
      <span
        className="guide-mark hint"
        title={item.byCount ? '이름과 크기가 다른 파일이 같은 수만큼 있습니다. 생성할 때 figma 화면을 보고 맞춥니다.' : '이름이 다른 파일이 있습니다. 생성할 때 자동으로 맞춥니다.'}
      >
        {item.byCount ? '크기 다름' : item.w ? '크기 일치' : '이름 다름'}
      </span>
    )
  if (item.group)
    return (
      <span className="guide-mark" title={`같은 종류 ${item.group.of}개 중 ${item.group.got}개가 들어왔습니다. 어느 파일인지는 생성할 때 맞춥니다.`}>
        {item.group.of}개 중 {item.group.got}개
      </span>
    )
  return null
}

/** figma 에서 내보낼 것 — 그림 격자. 누르면 크게 */
export function GuideTiles({ code, items, onZoom }: { code: string; items: GuideItem[]; onZoom: (i: GuideItem) => void }) {
  const thumbs = useThumbs(code, items.map((i) => i.rel), ORIGIN)
  // 정한 자리는 이번 폴더에 들어온 그림으로 바꿔 그린다 — 무엇으로 정했는지가 바로 보이게
  const mine = useThumbs(code, items.flatMap((i) => (i.pick ? [i.pick] : [])))
  return (
    <div className="guide-grid">
      {items.map((i) => (
        <button key={i.rel} className={`guide-tile ${i.state}`} onClick={() => onZoom(i)} title={i.pick ? `${i.rel} → ${i.pick}` : i.rel}>
          <span className="guide-pic guide-checker">
            {(i.pick && mine[i.pick]) || thumbs[i.rel] ? (
              <img src={(i.pick && mine[i.pick]) || thumbs[i.rel]} alt="" />
            ) : (
              <span className="guide-glyph">{i.kind === 'video' ? '▶' : '◇'}</span>
            )}
          </span>
          <span className="guide-name mono">{i.name}</span>
          <span className="guide-meta mono">{sizeOf(i)}</span>
          <Mark item={i} />
        </button>
      ))}
    </div>
  )
}

/** 따로 받을 것(소리 · 로티) · 앱이 가져올 것 — 한 줄씩 */
export function GuideRows({ items }: { items: GuideItem[] }) {
  return (
    <ul className="guide-rows">
      {items.map((i) => (
        <li key={i.rel} className={i.state} title={i.rel}>
          <span className="guide-glyph">{i.kind === 'sound' ? '♪' : i.kind === 'video' ? '▶' : '◇'}</span>
          <span className="mono">{i.name}</span>
          <span className="sub">{i.talk ? '대사' : sizeOf(i)}</span>
          <Mark item={i} />
        </li>
      ))}
    </ul>
  )
}
