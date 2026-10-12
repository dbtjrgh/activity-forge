import { useState } from 'react'
import type { Prepare } from '../../../../shared/forge'
import { kindClass, kindName } from '../../lib/format'
import { useThumbs } from './useThumbs'

/** 쓰기 권한 세 갈래 — 됨 · 안 됨 · 모름. 모름을 「됨」으로 보이지 않게 한다. */
function writeTag(writable: boolean | null): { text: string; cls: string } {
  if (writable === null) return { text: '알 수 없음', cls: 'warn' }
  return writable ? { text: '쓰기 가능', cls: 'done' } : { text: '쓰기 불가', cls: 'error' }
}

/** 폴더 안 상대 경로 — `root` 는 폴더 바로 아래다 */
const relOf = (f: Prepare['rsc']['files'][number]): string => (f.base === 'root' ? f.name : `${f.base}/${f.name}`)

/**
 * 리소스 폴더 칸 — 옛 `Resource.tsx` 에서 떼어 냄 (M4).
 * 목록을 **펼쳤을 때만** 썸네일을 받는다 — 폴더에 그림이 수백 장이라 열 때마다 그리면 IPC 가 무겁다.
 */
export function FolderCard({ code, rsc, onOpen }: { code: string; rsc: Prepare['rsc']; onOpen: () => void }) {
  const [shown, setShown] = useState(false)
  const thumbs = useThumbs(code, shown ? rsc.files.map(relOf) : [])
  return (
    <section className="card">
      <h3>리소스 폴더</h3>
      {rsc.error ? (
        <p className="state error">{rsc.error}</p>
      ) : (
        <>
          <p className="path mono">{rsc.dir}</p>
          <p className="row-actions">
            <button className="ghost" onClick={onOpen}>
              {rsc.exists ? '탐색기로 열기' : '폴더 생성 후 열기'}
            </button>
            <span className="sub">{rsc.exists ? `파일 ${rsc.files.length}개` : '폴더가 없습니다.'}</span>
          </p>
          {rsc.files.length > 0 && (
            <details className="files" onToggle={(e) => setShown(e.currentTarget.open)}>
              <summary>파일 목록 {rsc.files.length}개</summary>
              <ul>
                {rsc.files.map((f) => (
                  <li key={f.base + '/' + f.name}>
                    {thumbs[relOf(f)] ? (
                      <img className="pick-thumb" src={thumbs[relOf(f)]} alt="" />
                    ) : (
                      <span className={`kind-chip ${kindClass(f.kind, f.name)}`}>{kindName(f.kind, f.name)}</span>
                    )}
                    <span className="mono">{f.name}</span>
                    <span className="sub">{f.base}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}

/** 쓰기 권한 칸. */
export function WriteCard({ write }: { write: Prepare['write'] }) {
  const tag = writeTag(write.writable)
  return (
    <section className="card">
      <h3>저장소 쓰기 권한</h3>
      <p className="row-actions">
        <span className={`tag ${tag.cls}`}>{tag.text}</span>
        <span className="sub">{write.why}</span>
      </p>
      {write.dir && <p className="path mono">{write.dir}</p>}
      {/* 그 자리의 형편 · 원격보다 뒤처졌나 (M7) */}
      {write.slot && <p className="sub">{write.slot}</p>}
      {write.behindNote && <p className={`sub ${write.behind ? 'warn' : ''}`}>{write.behindNote}</p>}
    </section>
  )
}
