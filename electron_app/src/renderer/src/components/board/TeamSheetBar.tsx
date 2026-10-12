import { useState } from 'react'
import type { TeamSheet } from '../../../../shared/forge'

/**
 * **「팀 일정표 갱신」** (2026-10-12, 사용자 요청) — 진행판 맨 위. 누르면 완료 목록을 내 컴퓨터에 잠깐 띄우고 일정표를 연다.
 * **앱이 칠하지 않는다** — 열린 엑셀에서 「스파크온 완료 칠하기」 스크립트를 실행해야 칠해진다. 그래서 그 할 일을 그대로 적는다.
 * 메인 쪽은 `services/forge/teamsheet.ts`, 스크립트는 `_document/팀일정표.md`.
 */
const clock = (ms: number): string => new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

export default function TeamSheetBar() {
  const [busy, setBusy] = useState(false)
  const [got, setGot] = useState<TeamSheet | null>(null)

  const go = async (): Promise<void> => {
    setBusy(true)
    try {
      setGot(await window.api.forgeTeamSheet())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="team-sheet row-actions">
      <button className="ghost" disabled={busy} onClick={() => void go()} title="완료한 학습코드를 팀 일정표에 파란색으로 칠할 준비를 합니다.">
        {busy ? '준비하는 중…' : '팀 일정표 갱신'}
      </button>
      {got?.error ? (
        <span className="state error">{got.error}</span>
      ) : got ? (
        <span className="sub">
          열린 일정표에서 자동화 → 「스파크온 완료 칠하기」를 실행하세요(완료 {got.count}개, {clock(got.until)}까지).
        </span>
      ) : null}
    </div>
  )
}
