import type { GuideFile, GuideItem } from '../../../../shared/forge'
import { kindClass, kindName } from '../../lib/format'
import { useThumbs, type ThumbSource } from '../bench/useThumbs'
import './guidetiles.css'

/**
 * 받을 리소스 창의 그림은 **앞 학습코드 폴더**에서 — 메인이 배치표로 폴더를 정한다(`ipc/guide.ts`).
 * 열쇠에 원본을 넣는다 — 원본을 바꾸면 같은 이름이 다른 그림이다. 안 넣었더니 바꾸기 전 원본의 북 그림이
 * 새 원본(실로폰)의 크기 옆에 그대로 남았다(2026-10-15, MAL2M08W4S1)
 */
const originSource = (origin: string): ThumbSource => ({ key: `guide|${origin}`, get: (code, files) => window.api.guideThumbs(code, files) })

export const sizeOf = (i: GuideItem): string => (i.w && i.h ? `${i.w}×${i.h}` : kindName(i.kind))

/** 받은 것 — 이름이 같거나 · 정했거나 · 크기가 맞는 파일이 왔다 */
export const isDone = (i: GuideItem): boolean => i.state === 'name' || i.state === 'set' || i.state === 'hint'

/**
 * 종류마다 「받은 것 / 받을 것」 — **사람이 받을 것만** 센다 (2026-10-01). 앱이 가져올 것까지 세면
 * 그림 한 장만 보이는데 「그림 0/5」, 소리는 하나도 안 보이는데 「소리 0/5」가 떠서 무엇을 받으라는지 흐렸다.
 * `GuideWindow.tsx` 가 200줄을 넘어 여기로 옮겼다(2026-10-15, 동작 변화 없음)
 */
export function Counts({ items }: { items: GuideItem[] }) {
  const kinds = [...new Set(items.map((i) => i.kind))]
  return (
    <>
      {kinds.map((k) => {
        const of = items.filter((i) => i.kind === k)
        return (
          <span key={k} className={`guide-count ${kindClass(k)}`}>
            {kindName(k)} {of.filter(isDone).length}/{of.length}
          </span>
        )
      })}
    </>
  )
}

/** 형편 딱지 — 이름으로 왔으면 「왔음」, 크기만 맞으면 「크기 맞음」(실마리), 같은 크기 묶음이면 몇 장 왔나 */
export function Mark({ item }: { item: GuideItem }) {
  if (item.state === 'name') return <span className="guide-mark name">✓ 받음</span>
  if (item.state === 'set') return <span className="guide-mark name">✓ 정함</span>
  if (item.state === 'hint')
    return <span className="guide-mark hint">{item.byCount ? '크기 다름' : item.w ? '크기 일치' : '이름 다름'}</span>
  if (item.group)
    return (
      <span className="guide-mark">
        {item.group.of}개 중 {item.group.got}개
      </span>
    )
  return null
}

/**
 * 그림 왼쪽 아래 딱지 — 원본 그림인지 이번에 넣은 그림인지 (2026-10-15). 사람이 「전 호 것을 알려 주는 건지
 * 지금 리소스를 보이는 건지 모르겠다」고 했다 — 두 가지가 한 격자에 섞여 그려진다. 목록 위 풀이 한 줄은 10-16 에 뺐다
 */
export const Src = ({ mine }: { mine: boolean }) => <span className={`guide-src${mine ? ' mine' : ''}`}>{mine ? '넣은 그림' : '원본 그림'}</span>

/**
 * figma 에서 내보낼 것 — 그림 격자. 누르면 크게(크게 보기는 늘 원본 그림).
 * 받은 자리(이름이 같음 · 정함)는 **이번 폴더에 넣은 그림**으로 그리고 크기도 그 파일 것을 적는다 — 그림과 크기가 다른 파일 것이면 또 헷갈린다
 */
export function GuideTiles(props: { code: string; origin: string; items: GuideItem[]; placed: GuideFile[]; onZoom: (i: GuideItem) => void }) {
  const { code, origin, items, placed, onZoom } = props
  const thumbs = useThumbs(code, items.map((i) => i.rel), originSource(origin))
  const byRel = new Map(placed.map((f) => [f.rel.toLowerCase(), f]))
  const byName = new Map(placed.filter((f) => f.how === 'name').map((f) => [f.name.toLowerCase(), f]))
  const fileOf = (i: GuideItem): GuideFile | undefined =>
    i.pick ? byRel.get(i.pick.toLowerCase()) : i.state === 'name' ? byName.get(i.name.toLowerCase()) : undefined
  const mine = useThumbs(code, items.flatMap((i) => fileOf(i)?.rel ?? []))
  return (
    <div className="guide-grid">
      {items.map((i) => {
        const f = fileOf(i)
        const own = f ? mine[f.rel] : undefined
        const src = own || thumbs[i.rel]
        return (
          <button key={i.rel} className={`guide-tile ${i.state}`} onClick={() => onZoom(i)} title={f ? `${i.rel} → ${f.rel}` : i.rel}>
            <span className="guide-pic guide-checker">
              {src ? <img src={src} alt="" /> : <span className="guide-glyph">{i.kind === 'video' ? '▶' : '◇'}</span>}
              {src && <Src mine={Boolean(own)} />}
            </span>
            <span className="guide-name mono">{i.name}</span>
            <span className="guide-meta mono">{own && f?.w ? `${f.w}×${f.h}` : sizeOf(i)}</span>
            <Mark item={i} />
          </button>
        )
      })}
    </div>
  )
}

/** 따로 받을 것(소리 · 로티) · 앱이 가져올 것 — 한 줄씩 */
export function GuideRows({ items }: { items: GuideItem[] }) {
  return (
    <ul className="guide-rows">
      {items.map((i) => (
        <li key={i.rel} className={i.state} title={i.pick ? `${i.rel} → ${i.pick}` : i.rel}>
          <span className="guide-glyph">{i.kind === 'sound' ? '♪' : i.kind === 'video' ? '▶' : '◇'}</span>
          <span className="mono">{i.name}</span>
          <span className="sub">{i.talk ? '대사' : sizeOf(i)}</span>
          <Mark item={i} />
        </li>
      ))}
    </ul>
  )
}
