import { useCallback, useEffect, useRef, useState } from 'react'
import type { GuideItem, RscGuide } from '../../../../shared/forge'
import { kindClass, kindName } from '../../lib/format'
import CopyButton from '../CopyButton'
import { GuideRows, GuideTiles } from './GuideTiles'
import GuideMine from './GuideMine'
import GuideOrigin from './GuideOrigin'
import GuideVoice from './GuideVoice'
import GuideZoom from './GuideZoom'
import './guide.css'

/**
 * **받을 리소스 창** (2026-09-30) — figma 옆에 켜 두는 좁은 창. 앞 학습코드가 쓴 리소스를 그림 · 크기로 보이고,
 * 이번 폴더에 들어오는 대로 체크한다. 메인 쪽은 `main/guidewin.ts` · `services/forge/rscguide.ts`.
 *
 * - 몇 초마다 폴더를 다시 읽는다 — 창이 가려져 있으면 안 묻는다. 앞 판이 안 끝났으면 다음 판을 안 보낸다
 * - 「남은 것만」이 처음 — 받을수록 목록이 줄어야 할 일이 보인다
 * - 앱이 앞 호에서 가져올 것은 맨 아래에 접어 둔다 — 안 받아도 되는 것까지 늘어놓으면 할 일이 흐려진다
 */
const POLL_MS = 4000

/** figma 에서 내보내는 것 — 그림뿐. 영상 · 소리 · 로티는 따로 받는다(영상은 AssetTable 이 그림에 올려도 figma 에 없다) */
const FIGMA = new Set(['image'])
const isDone = (i: GuideItem): boolean => i.state === 'name' || i.state === 'set' || i.state === 'hint'

/**
 * 종류마다 「받은 것 / 받을 것」 — **사람이 받을 것만** 센다 (2026-10-01). 앱이 가져올 것까지 세면
 * 그림 한 장만 보이는데 「그림 0/5」, 소리는 하나도 안 보이는데 「소리 0/5」가 떠서 무엇을 받으라는지 흐렸다
 */
function Counts({ items }: { items: GuideItem[] }) {
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

/** 디자인 쪽에 보낼 글 — 아직 안 온 것만 */
const listText = (g: RscGuide, left: GuideItem[]): string =>
  [`${g.code} 받을 리소스 (원본 ${g.origin})`, ...left.map((i) => `- ${i.name}${i.w ? ` (${i.w}×${i.h})` : ''}`)].join('\n')

function GuideWindow({ code }: { code: string }) {
  const [data, setData] = useState<RscGuide | null>(null)
  // 남은 항목 · 전체(원본 목록) · 넣은 리소스(이번 폴더) — 넣은 것을 보고 빼먹은 것을 찾는다 (2026-10-12)
  const [view, setView] = useState<'left' | 'all' | 'mine'>('left')
  const [top, setTop] = useState(false)
  const [zoom, setZoom] = useState<GuideItem | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    document.title = `받을 리소스 - ${code}`
  }, [code])

  const read = useCallback((): void => {
    if (busy.current) return
    busy.current = true
    void window.api
      .guideGet(code)
      .then(setData)
      .finally(() => {
        busy.current = false
      })
  }, [code])
  // 창은 켜 둔 「항상 위」를 들고 있다 — 다른 학습코드로 새로 떠도 단추가 창과 같게
  useEffect(() => {
    void window.api.guideTop(null).then(setTop)
  }, [code])
  useEffect(() => {
    read()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') read()
    }, POLL_MS)
    window.addEventListener('focus', read)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', read)
    }
  }, [read])

  const pin = (): void => void window.api.guideTop(!top).then(setTop)

  const want = data?.items.filter((i) => i.state !== 'auto') ?? []
  const got = want.filter(isDone).length
  const left = want.filter((i) => !isDone(i))
  const auto = data?.items.filter((i) => i.state === 'auto') ?? []
  const shown = view === 'left' ? left : want
  const figma = shown.filter((i) => FIGMA.has(i.kind))
  const other = shown.filter((i) => !FIGMA.has(i.kind))
  const pct = want.length ? Math.round((got / want.length) * 100) : 0

  return (
    <div className="guide">
      <div className="guide-top">
        <header className="guide-head">
          <div className="guide-title">
            <b className="mono">{code}</b>
            <span className="sub">{data?.module || ' '}</span>
          </div>
          <button className={`ghost guide-pin${top ? ' on' : ''}`} aria-pressed={top} onClick={pin}>
            {top ? '항상 위에 표시 중' : '항상 위에 표시'}
          </button>
        </header>
        {data?.module && <GuideOrigin code={code} origin={data.origin} note={data.originNote} onChanged={read} />}
        {data && !data.error && (
          <>
            <div className="guide-progress">
              <div className={`guide-bar${want.length && got === want.length ? ' full' : ''}`}>
                <i style={{ width: `${pct}%` }} />
              </div>
              <span>
                남은 항목 <b>{left.length}</b>개 (받음 {got}/{want.length})
              </span>
            </div>
            <div className="guide-tools">
              <div className="guide-seg">
                <button className={view === 'left' ? 'on' : ''} onClick={() => setView('left')}>
                  남은 항목
                </button>
                <button className={view === 'all' ? 'on' : ''} onClick={() => setView('all')}>
                  전체
                </button>
                <button className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}>
                  넣은 리소스 {data.mine.length}
                </button>
              </div>
              <span className="guide-grow" />
              {left.length > 0 && <CopyButton text={listText(data, left)}>목록 복사</CopyButton>}
              {data.exists && (
                <button className="ghost" onClick={() => void window.api.openPath(data.dir)}>
                  폴더 열기
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="guide-body">
        {!data ? (
          <p className="state">원본 리소스를 불러오는 중…</p>
        ) : data.error ? (
          <p className="state error">{data.error}</p>
        ) : view === 'mine' ? (
          <GuideMine code={code} files={data.mine} />
        ) : (
          <>
            {want.length > 0 && got === want.length && <p className="guide-done">리소스가 모두 준비되었습니다. 작업대에서 생성을 누르세요.</p>}
            {figma.length > 0 && (
              <section className="guide-sec">
                {/* 원본 학습코드는 머리에 한 번만 — 목록마다 붙였더니 「이 학습코드 것을 넣으라는 건가」로 읽혔다 (2026-10-01) */}
                <h2>
                  figma에서 내보낼 그림 <span className="guide-ref">참고용</span>{' '}
                  <Counts items={want.filter((i) => FIGMA.has(i.kind))} />
                </h2>
                <GuideTiles code={code} items={figma} onZoom={setZoom} />
              </section>
            )}
            {other.length > 0 && (
              <section className="guide-sec">
                <h2>
                  따로 받을 리소스 <Counts items={want.filter((i) => !FIGMA.has(i.kind))} />
                </h2>
                <p className="guide-sec-tip">소리, 영상, 애니메이션(로티)은 figma에 없습니다. 담당자에게 받아 작업대에 끌어다 놓으세요.</p>
                <GuideRows items={other} />
              </section>
            )}
            {/* 대사가 있는 모듈만 — 성우 성별이 같은 학습코드에서 한 묶음째 (2026-10-02) */}
            {data.items.some((i) => i.talk) && <GuideVoice code={code} onChanged={read} />}
            {auto.length > 0 && (
              <details className="guide-sec guide-auto">
                <summary>
                  앱이 원본에서 가져오는 리소스 {auto.length}개 (넣지 않아도 됩니다)
                </summary>
                <GuideRows items={auto} />
              </details>
            )}
          </>
        )}
      </div>
      {zoom && <GuideZoom code={code} origin={data?.origin ?? ''} item={zoom} onClose={() => setZoom(null)} />}
    </div>
  )
}

export default GuideWindow
