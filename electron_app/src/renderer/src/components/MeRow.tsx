import { useEffect, useState } from 'react'
import { BUTTON, type Workspace } from '../../../shared/forge'
import SuggestInput from './SuggestInput'

/**
 * **만든 사람 · 팀** (2026-09-29). 「이대로 좋습니다 — 끝」이 activityInfo.json 에 적는 이름이다(`.user.json`).
 * 옛 양산 창 머리에만 있던 칸이라, 그 창을 걷은 뒤로 다른 개발자가 제 이름을 적을 길이 없었다 —
 * 그러면 모두의 「끝」이 이 PC 주인의 이름으로 적힌다. 둘 다 적어야 저장한다.
 */
export default function MeRow({
  workspace,
  busy,
  onSave
}: {
  workspace: Workspace
  busy: boolean
  onSave: (developer: string, devTeam: string) => void
}) {
  const [dev, setDev] = useState(workspace.developer ?? '')
  const [team, setTeam] = useState(workspace.devTeam ?? '')
  useEffect(() => {
    setDev(workspace.developer ?? '')
    setTeam(workspace.devTeam ?? '')
  }, [workspace.developer, workspace.devTeam])
  // Tab 으로 채울 값 — 초기 설정과 같은 제안(그 PC 의 git 이름 · 팀 이름, `services/forge/setup.ts`)
  const [suggest, setSuggest] = useState({ developer: '', devTeam: '' })
  useEffect(() => {
    void window.api.setupState().then((s) => setSuggest(s.suggest))
  }, [])
  const changed = dev.trim() !== (workspace.developer ?? '') || team.trim() !== (workspace.devTeam ?? '')

  return (
    <div className="workspace me-row">
      <div className="workspace-head">
        <span className="label">개발자와 팀</span>
        <button className="ghost" onClick={() => onSave(dev, team)} disabled={busy || !changed || !dev.trim() || !team.trim()}>
          저장
        </button>
      </div>
      <div className="me-fields">
        <SuggestInput label="아이디(이름)" value={dev} suggest={suggest.developer} onChange={setDev} />
        <SuggestInput label="팀" value={team} suggest={suggest.devTeam} onChange={setTeam} />
      </div>
      <p className="sub">「{BUTTON.done}」 버튼을 누르면 activityInfo.json 파일에 기록됩니다.</p>
    </div>
  )
}
