import { useEffect, useState } from 'react'
import { SHARE_DEFAULT, type Workspace } from '../../../shared/forge'

/**
 * **사내 공유 폴더 위치** (2026-10-14, 사용자와 정함) — 소리 · 애니메이션 · 영상을 찾는 폴더(`sharefetch.ts`). `.user.json` 의 `shareRoot`.
 * 글로 받는다 — `\\서버\공유` 꼴은 폴더 고르기 창으로 고르기 어렵다. 비우거나 「기본값으로」를 누르면 기본 주소(`SHARE_DEFAULT`)를 쓴다.
 * 이 PC 에서 공유 폴더가 안 열리면 공유 폴더 칸이 이 칸으로 오라고 알린다
 */
export default function ShareRootRow({ workspace, busy, onSave }: { workspace: Workspace; busy: boolean; onSave: (dir: string) => void }) {
  const saved = workspace.shareRoot ?? ''
  const [text, setText] = useState(saved)
  useEffect(() => setText(saved), [saved])
  const changed = text.trim() !== saved

  return (
    <div className="workspace share-row">
      <div className="workspace-head">
        <span className="label">공유 폴더</span>
        <button className="ghost" onClick={() => onSave(text)} disabled={busy || !changed}>
          저장
        </button>
        {saved && (
          <button className="ghost" onClick={() => onSave('')} disabled={busy}>
            기본값으로
          </button>
        )}
      </div>
      <input aria-label="공유 폴더 위치" className="mono" placeholder={SHARE_DEFAULT} value={text} onChange={(e) => setText(e.target.value)} />
      {workspace.shareError && <p className="state error">{workspace.shareError}</p>}
    </div>
  )
}
