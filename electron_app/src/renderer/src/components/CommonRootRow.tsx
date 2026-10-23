import type { Workspace } from '../../../shared/forge'

/**
 * **공용 폴더 위치** (2026-10-21 사용자 말 — 「공용폴더도 비슷한 경로로 있긴한데 경로 정할 수 있게 해놔」) — 공용 모듈 저장소 sparkon_common.
 * `.user.json` 의 `commonRoot`, 비면 `<작업 폴더>/sparkon_common`. 정본 셈은 forge `commonroot.ts` 의 `commonRoot()` 하나다.
 * 경로는 메인의 폴더 고르기 창으로만 받는다(렌더러는 경로를 안 보낸다) — 바로 위 「공유 폴더」처럼 글로 받지 않는 까닭이다.
 * 작업 폴더 안이 아니면 한 줄 알린다 — `sparkon link`(미리보기 연결)는 작업 폴더 안 sparkon_common 에만 정션을 건다.
 * 그 자리가 비었으면 미리보기 「연결」이 거기에 이 폴더로 가는 정션을 먼저 건다(2026-10-23, `services/forge/commonlink.ts`) — 건 뒤로는 `beside` 라 이 줄이 사라진다
 */
export default function CommonRootRow({
  workspace,
  busy,
  onPick,
  onClear
}: {
  workspace: Workspace
  busy: boolean
  onPick: () => void
  onClear: () => void
}) {
  const c = workspace.common
  return (
    <div className="workspace">
      <div className="workspace-head">
        <span className="label">공용 폴더</span>
        <button className="ghost" onClick={onPick} disabled={busy}>
          변경
        </button>
        {c?.saved && (
          <button className="ghost" onClick={onClear} disabled={busy}>
            기본값으로
          </button>
        )}
      </div>
      <p className="path">{c?.dir || '알 수 없음'}</p>
      {c && !c.saved && <p className="sub">작업 폴더 안의 기본 위치입니다.</p>}
      {c && !c.beside && (
        <p className="state warn">
          {c.free
            ? '작업대 미리보기에서 연결을 누르면 작업 폴더 안에 이 폴더로 가는 sparkon_common 연결을 만듭니다.'
            : '미리보기와 모듈 회귀 검사는 이 폴더가 아니라 작업 폴더 안의 sparkon_common 폴더를 씁니다.'}
        </p>
      )}
      {workspace.commonError && <p className="state error">{workspace.commonError}</p>}
    </div>
  )
}
