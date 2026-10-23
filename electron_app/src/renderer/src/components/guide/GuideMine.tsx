import type { GuideFile } from '../../../../shared/forge'
import { kindName } from '../../lib/format'
import { useThumbs } from '../bench/useThumbs'
import { Src } from './GuideTiles'

/**
 * **「넣은 리소스」** (2026-10-12, 사용자 요청) — 이번 폴더에 놓인 파일을 그대로. 원본 목록과 견주어 빼먹은 그림을 찾게 한다.
 * 그림은 **이번 폴더 것**으로 그린다(기본 썸네일 자리). 짝 딱지는 메인이 적은 사실만(`rscguidemine.ts`).
 * 누르는 것이 없어 단추 모양으로 안 그린다.
 */

/** 짝인 원본 이름은 칸 title(`titleOf`)에 있다 — 딱지에는 낱말만 */
function Pair({ file }: { file: GuideFile }) {
  if (file.how === 'name') return <span className="guide-mark name">이름 같음</span>
  if (file.how === 'set') return <span className="guide-mark name">정함</span>
  if (file.how === 'size') return <span className="guide-mark hint">{file.to.length > 1 ? `같은 크기 ${file.to.length}개` : '크기 같음'}</span>
  return <span className="guide-mark">{file.kind === 'image' ? '짝 없음' : '이름 다름'}</span>
}

/** 마우스를 올리면 — 파일 경로와 짝인 원본 이름 */
const titleOf = (f: GuideFile): string => (f.to.length ? `${f.rel}\n원본: ${f.to.join(', ')}` : f.rel)

/** 짝인 원본이 하나로 정해질 때만 이름을 적는다 — 이름이 같으면 되풀이라 뺀다 */
const toLine = (f: GuideFile): string => (f.how !== 'name' && f.to.length === 1 ? `→ ${f.to[0]}` : '')

export default function GuideMine({ code, files }: { code: string; files: GuideFile[] }) {
  const pics = files.filter((f) => f.kind === 'image')
  const other = files.filter((f) => f.kind !== 'image')
  const thumbs = useThumbs(code, pics.map((f) => f.rel))
  if (!files.length) return <p className="state">이 학습코드 리소스 폴더에 넣은 파일이 없습니다.</p>
  return (
    <>
      {pics.length > 0 && (
        <section className="guide-sec">
          <h2>
            넣은 그림 <span className="guide-count">{pics.length}개</span>
          </h2>
          <div className="guide-grid">
            {pics.map((f) => (
              <div key={f.rel} className="guide-tile mine" title={titleOf(f)}>
                <span className="guide-pic guide-checker">
                  {thumbs[f.rel] ? <img src={thumbs[f.rel]} alt="" /> : <span className="guide-glyph">◇</span>}
                  {thumbs[f.rel] && <Src mine />}
                </span>
                <span className="guide-name mono">{f.name}</span>
                <span className="guide-meta mono">{f.w ? `${f.w}×${f.h}` : kindName(f.kind)}</span>
                {toLine(f) && <span className="guide-to mono">{toLine(f)}</span>}
                <Pair file={f} />
              </div>
            ))}
          </div>
        </section>
      )}
      {other.length > 0 && (
        <section className="guide-sec">
          <h2>
            그 밖에 넣은 리소스 <span className="guide-count">{other.length}개</span>
          </h2>
          <ul className="guide-rows">
            {other.map((f) => (
              <li key={f.rel} title={titleOf(f)}>
                <span className="guide-glyph">{f.kind === 'sound' ? '♪' : f.kind === 'video' ? '▶' : '◇'}</span>
                <span className="mono">{f.rel}</span>
                <span className="sub">{kindName(f.kind)}</span>
                <Pair file={f} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
