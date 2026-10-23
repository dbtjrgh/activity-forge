import { useState } from 'react'
import { BUTTON } from '../../../../shared/forge'
import { TOUR_ANCHOR } from '../../lib/anchors'
import RscCleanPanel from './RscCleanPanel'
import SyncPanel from './SyncPanel'
import TeamSheetBar from './TeamSheetBar'
import './boardtop.css'

/**
 * **진행판 맨 위 한 줄** (2026-10-14) — 「팀 일정표 갱신」 옆에 「main 에 모두 올리기」와 「리소스 폴더 정리」.
 * 둘 다 학습코드마다 작업대에 있던 단추를 한 곳으로 모은 것이다(사용자 말 — 「메인에 한 번에 다 올리는 식」, 「매 학습코드 내에 리소스 정리 버튼은 없애고」).
 *
 * 누르면 아래에 목록을 펴고, 펼친 칸 안의 단추를 **한 번 더 눌러야** 실행한다 — 확인 창(`window.confirm`)은 CDP 를 멈추게 해서 안 쓴다.
 * 다시 누르면 새로 잰다(`round` 가 칸을 새로 띄운다). 도는 동안에는 두 단추를 끈다 — 칸이 바뀌면 진행 줄을 못 본다.
 */
export default function BoardTop() {
  const [open, setOpen] = useState<'' | 'sync' | 'clean'>('')
  const [round, setRound] = useState(0)
  const [busy, setBusy] = useState(false)

  const show = (what: 'sync' | 'clean'): void => {
    setOpen(what)
    setRound((n) => n + 1)
  }

  return (
    <div className="board-top">
      <div className="board-top-row">
        <TeamSheetBar />
        <button id={TOUR_ANCHOR.boardSync} className="ghost" disabled={busy} onClick={() => show('sync')}>
          {BUTTON.mainAll}
        </button>
        <button className="ghost" disabled={busy} onClick={() => show('clean')}>
          리소스 폴더 정리
        </button>
      </div>
      {open === 'sync' && <SyncPanel key={round} onBusy={setBusy} onClose={() => setOpen('')} />}
      {open === 'clean' && <RscCleanPanel key={round} onBusy={setBusy} onClose={() => setOpen('')} />}
    </div>
  )
}
