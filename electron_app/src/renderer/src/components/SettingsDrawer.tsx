import { useEffect, useState, type ComponentProps } from 'react'
import MeRow from './MeRow'
import WorkspaceBar from './WorkspaceBar'

/** 경로의 끝 이름 — 접힌 줄에 한 마디로 */
function leaf(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

/**
 * **설정 서랍** (2026-09-29, M4) — 작업 폴더 · 리소스 자리 · 양산기 폴더 · 만든 사람 · 폴더 권한 화면.
 *
 * 한 번 정하면 잘 안 바꾸는 것이 옆줄 위쪽 절반을 늘 차지하고 있었다. 접어 두고 한 줄로 보인다.
 * **알릴 것(warn · error)이 있으면 펴서 연다** — 잘못된 설정을 접어 숨기면 왜 진행판이 비었는지 모른다.
 */
function SettingsDrawer({
  onFolders,
  onSetMe,
  ...props
}: ComponentProps<typeof WorkspaceBar> & {
  /** 폴더 · 권한(ACL) 화면으로 — 옛 첫 탭을 서랍 안으로 옮겼다 (M5) */
  onFolders: () => void
  /** 만든 사람 · 팀 저장 */
  onSetMe: (developer: string, devTeam: string) => void
}) {
  const ws = props.workspace
  const trouble = Boolean(ws?.error || ws?.warn)
  const [open, setOpen] = useState(false)
  // 알림이 새로 생기면 한 번 편다 — 사람이 다시 접는 것은 막지 않는다
  useEffect(() => {
    if (trouble) setOpen(true)
  }, [trouble])
  return (
    <details className="settings-drawer" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span>설정</span>
        <span className="sub mono">
          {ws ? `${leaf(ws.dir)}, 호 ${ws.repos}개${ws.rscRoot ? `, 리소스 ${leaf(ws.rscRoot)}` : ''}` : '읽는 중'}
        </span>
        {trouble && <span className="tag warn">알림</span>}
      </summary>
      <WorkspaceBar {...props} />
      {ws && !ws.error && <MeRow workspace={ws} busy={props.busy} onSave={onSetMe} />}
      <button className="ghost open-forge-old" onClick={onFolders}>
        폴더 권한 보기
      </button>
    </details>
  )
}

export default SettingsDrawer
