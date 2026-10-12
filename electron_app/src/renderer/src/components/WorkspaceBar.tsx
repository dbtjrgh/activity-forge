import type { Workspace } from '../../../shared/forge'

interface Props {
  workspace: Workspace | null
  busy: boolean
  onPick: () => void
  /** 리소스를 놓을 자리 고르기 */
  onPickRsc: () => void
  /** 리소스 자리를 원래대로(호 저장소 안) */
  onClearRsc: () => void
  /** 스펙을 읽을 양산기 폴더 고르기 */
  onPickForge: () => void
}

/**
 * 작업 폴더 표시. **무엇을 보고 그 자리를 골랐는지까지 보여 준다** —
 * 양산기 readme 의 「화면 위쪽 작업 폴더에 무엇을 보고 골랐나 나옵니다」와 같은 자리다.
 *
 * **리소스 자리도 여기서 정한다.** 호 저장소는 이미 만든 회차가 들어 있는 남의
 * 자리라, 시험 삼아 넣고 빼는 일까지 거기서 하면 멀쩡한 것을 건드린다. 정해 두면
 * `<그 자리>/<학습코드>` 를 보고, 안 정하면 여태처럼 호 저장소 안을 본다.
 */
function WorkspaceBar({
  workspace,
  busy,
  onPick,
  onPickRsc,
  onClearRsc,
  onPickForge
}: Props) {
  if (!workspace) {
    return <p className="state">작업 폴더를 읽는 중…</p>
  }

  return (
    <div className="workspace">
      <div className="workspace-head">
        <span className="label">작업 폴더</span>
        <button className="ghost" onClick={onPick} disabled={busy}>
          변경
        </button>
      </div>

      {workspace.error ? (
        /*
          **막힌 자리에 고칠 길을 같이 둔다** (2026-09-18). 스펙을 못 읽으면
          여기 말고는 손댈 데가 없다 — zip 을 받아 압축만 푼 사람이 제일 먼저
          보는 화면이 이것이다 (함정 문서: 화면이 「못 한다」고 칸을 닫아 걸면
          고칠 길까지 닫힌다).
        */
        <>
          <p className="state error">{workspace.error}</p>
          <div className="workspace-head">
            <span className="label">양산기 폴더</span>
            <button className="ghost" onClick={onPickForge} disabled={busy}>
              선택
            </button>
          </div>
          <p className="sub">클론한 저장소 안의 forge 폴더를 선택하세요.</p>
        </>
      ) : (
        <>
          <p className="path">{workspace.dir || '알 수 없음'}</p>
          <p className="sub">
            {workspace.from ? `${workspace.from} 기준, ` : ''}호 {workspace.repos}개
          </p>
          {workspace.warn && <p className="state error">{workspace.warn}</p>}

          <div className="workspace-head">
            <span className="label">리소스 폴더</span>
            <button className="ghost" onClick={onPickRsc} disabled={busy}>
              변경
            </button>
            {workspace.rscRoot && (
              <button className="ghost" onClick={onClearRsc} disabled={busy} title="리소스를 호 저장소 안(public/sparklab)에서 읽습니다">
                호 저장소 안으로
              </button>
            )}
          </div>
          <p className="path">{workspace.rscRoot || '호 저장소 안 (public/sparklab)'}</p>
          <p className="sub">
            {workspace.rscRoot
              ? '학습코드별 리소스를 이 폴더에서 읽습니다.'
              : '테스트할 때는 다른 폴더를 지정하세요.'}
          </p>

          {/*
            **읽고 있는 자리를 보여 준다.** 스펙을 고쳤는데 안 바뀌면 제일 먼저
            의심할 것이 「어느 forge 를 보고 있나」다. **바꾸는 단추는 없다** (2026-10-01 사용자 결정) —
            초기 설정이 작업 폴더 안 `SparkOn-양산기` 에 정한다(`components/setup/FirstRun.tsx`).
            못 찾으면 위 오류 칸의 「선택」이 남는다
          */}
          <div className="workspace-head">
            <span className="label">양산기 폴더</span>
          </div>
          <p className="path">{workspace.forgeRoot || '알 수 없음'}</p>
          <p className="sub">스펙과 배치표를 읽는 폴더입니다. 초기 설정에서 작업 폴더 안에 만듭니다.</p>
        </>
      )}
    </div>
  )
}

export default WorkspaceBar
