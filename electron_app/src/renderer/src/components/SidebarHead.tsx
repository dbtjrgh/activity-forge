/**
 * 옆줄 머리 — 이름과 화면 바꾸기 단추. `App.tsx` 에서 떼어 냈다(2026-09-30, 200줄이 넘어서).
 * 진행판에서는 「관리」(스파크온 전체의 형편) · 「기능」(개발자가 「이런 기능이 이미 있나」를 찾는 화면)을,
 * 다른 화면에서는 돌아가는 단추 하나만 둔다. 폴더 · 권한 화면은 설정 서랍에서 연다(M5).
 * 「관리」에는 손볼 호 저장소 수를 점으로 단다(`manage/useManageAlert.ts`).
 */
import { useEffect, useState } from 'react'
import { useManageAlert } from './manage/useManageAlert'

const NAME = '스파크온 매니지먼트'

/** 지금 도는 앱의 판 번호 — 창 제목에도 단다(작업 표시줄에서 어느 판인지 보이게, 2026-10-02 사용자 말) */
function useVersion(): string {
  const [v, setV] = useState('')
  useEffect(() => {
    void window.api.getVersion().then((got) => {
      setV(got)
      document.title = got ? `${NAME} v${got}` : NAME
    })
  }, [])
  return v
}

export type View = '진행판' | '폴더' | '기능' | '관리'

function SidebarHead({ view, onView }: { view: View; onView: (v: View) => void }) {
  // 화면을 오갈 때마다 다시 본다 — 관리 화면에서 돌아왔으면 방금 본 것과 맞아야 한다
  const alert = useManageAlert(view)
  const version = useVersion()
  return (
    <div className="sidebar-head">
      <div className="sidebar-title">
        스파크온{version && <span className="sidebar-version">v{version}</span>}
      </div>
      {view !== '진행판' ? (
        <button className="ghost" onClick={() => onView('진행판')}>
          ← 진행판
        </button>
      ) : (
        <span className="sidebar-views">
          <button
            className="ghost"
            onClick={() => onView('관리')}
            title={alert.title || '호 저장소, 받을 리소스, 완성본 점검, 팀별 현황'}
          >
            관리
            {alert.count > 0 && <span className="alert-dot">{alert.count}</span>}
          </button>
          <button className="ghost" onClick={() => onView('기능')} title="이 프로그램의 기능 목록">
            기능
          </button>
        </span>
      )}
    </div>
  )
}

export default SidebarHead
