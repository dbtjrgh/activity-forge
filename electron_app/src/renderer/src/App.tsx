import { useEffect, useState, type CSSProperties } from 'react'
import { DEFAULT_DIR } from '../../shared/ipc'
import Board from './components/Board'
import CodeGo from './components/CodeGo'
import FolderProperties from './components/FolderProperties'
import FolderTree from './components/FolderTree'
import Bench from './components/bench/Bench'
import DevCodeBar from './components/DevCodeBar'
import ErrorGuard from './components/ErrorGuard'
import RscSort from './components/RscSort'
import BoardTop from './components/board/BoardTop'
import Features from './components/Features'
import Manage from './components/manage/Manage'
import SettingsDrawer from './components/SettingsDrawer'
import SidebarHead, { type View } from './components/SidebarHead'
import Splitter, { useWidth } from './components/Splitter'
import UpdateBar from './components/UpdateBar'
import BoardList from './components/board/BoardList'
import NewModules from './components/board/NewModules'
import Tour from './components/tour/Tour'
import { useTour } from './components/tour/useTour'
import { useBoard } from './useBoard'
import { useWorkspace } from './useWorkspace'

function App() {
  const [view, setView] = useState<View>('진행판')
  // **옆줄은 접는다** (M6 사용자 말 — 「세로형 바가 많아 번잡하고 좁다」). 접은 채로 기억한다 — 이 PC 에서만의 편의라 localStorage
  const [folded, setFolded] = useState(() => {
    try {
      return localStorage.getItem('sidebarFolded') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('sidebarFolded', folded ? '1' : '0')
    } catch {
      // 못 적으면 다음에 펴진 채로 뜰 뿐이다
    }
  }, [folded])
  // 옆줄 너비 — 끌어서 바꾸고 이 PC 에 기억한다(사용자 말 — 「각자 세로바 조절할 수 있게」)
  const [sideW, setSideW, resetSide] = useWidth('sidebarW', 280, 220, 520)
  const { boards, boardsError, opens, openIssue, closeBoard, selected, setSelected, result, refresh, reload, sameKey } = useBoard()

  // 폴더 화면(지금까지 만든 트리)은 그대로 둔다. 양산 전에 쓰기 권한을 보는 자리다.
  const [folder, setFolder] = useState(DEFAULT_DIR)
  const [treeKey, setTreeKey] = useState(0)

  // 리소스 화면. 학습코드가 있으면 진행판 대신 그것을 보여 준다.
  // **진행판은 첫 화면 그대로 남는다** — 돌아오면 고른 호가 그대로다.
  const [forgeCode, setForgeCode] = useState<string | null>(null)
  // 둘러보기 — 처음 설정 뒤 한 번, 옆줄 「둘러보기」로 다시(`components/tour/`)
  const tour = useTour({ result, view, forgeCode, setView, setForgeCode, setFolded })

  const {
    workspace,
    picking,
    refreshed,
    pickWorkspace,
    pickRscRoot,
    clearRscRoot,
    pickForgeRoot,
    setMe,
    setShareRoot,
    pickCommonRoot,
    clearCommonRoot,
    refreshSpecs
  } = useWorkspace(reload)

  return (
    <div className={`app${folded ? ' folded' : ''}`} style={folded ? undefined : ({ '--sidebar-w': `${sideW}px` } as CSSProperties)}>
      {!folded && <Splitter width={sideW} onWidth={setSideW} onReset={resetSide} className="sidebar-splitter" label="왼쪽 목록 너비" />}
      <button
        className="sidebar-fold"
        onClick={() => setFolded((f) => !f)}
        title={folded ? '왼쪽 목록 펴기' : '왼쪽 목록 접기'}
        aria-label={folded ? '왼쪽 목록 펴기' : '왼쪽 목록 접기'}
      >
        {folded ? '›' : '‹'}
      </button>
      <aside className="sidebar">
        <SidebarHead view={view} onView={setView} onTour={tour.start} />

        <div className="sidebar-body">
          {view !== '폴더' ? (
            <>
              {/* 새 판이 있을 때만 켜지는 업데이트 — 서랍 밖 맨 위에 둔다(접힌 서랍에 숨기면 못 본다) */}
              <UpdateBar refreshed={refreshed} busy={picking} onUpdate={refreshSpecs} />
              <SettingsDrawer
                workspace={workspace}
                busy={picking}
                onPick={pickWorkspace}
                onPickRsc={pickRscRoot}
                onClearRsc={clearRscRoot}
                onPickForge={pickForgeRoot}
                onFolders={() => setView('폴더')}
                onSetMe={(d, t) => void setMe(d, t)}
                onSetShare={(d) => void setShareRoot(d)}
                onPickCommon={pickCommonRoot}
                onClearCommon={clearCommonRoot}
              />
              {/* 배치표가 정했는데 스펙이 없는 모듈 — 2026-10-21 부터 모두에게(스펙은 푸시 권한이 있는 누구나 만든다) */}
              <NewModules stamp={boards.map((b) => b.subject + b.issue).join() + (refreshed?.after ?? '')} />
              {/* 진행판에 없는 것을 만들 때 */}
              <CodeGo
                onGo={(c) => {
                  setForgeCode(c)
                  setView('진행판')
                }}
              />
              {boardsError && <p className="state error">{boardsError}</p>}
              <BoardList
                boards={boards}
                selected={selected}
                isSelected={sameKey}
                onSelect={(b) => {
                  // 작업대에 있어도(만드는 중이어도) 진행판으로 돌아간다 — 도는 판은 메인이 들고 있어 돌아가도 이어진다(M4)
                  setSelected(b)
                  setForgeCode(null)
                  setView('진행판')
                }}
                onClose={(b) => void closeBoard(b)}
                opens={opens}
                onOpen={(i, s) => void openIssue(i, s)}
              />
            </>
          ) : (
            <FolderTree
              rootPath={DEFAULT_DIR}
              selectedPath={folder}
              onSelect={setFolder}
              reloadKey={treeKey}
            />
          )}
        </div>

        {view === '폴더' && (
          <div className="sidebar-foot">
            <button className="ghost" onClick={() => setTreeKey((k) => k + 1)}>
              새로고침
            </button>
          </div>
        )}
      </aside>

      <div className="content">
        <DevCodeBar />
        <main className="content-body">
          {view === '진행판' ? (
            forgeCode ? (
              // 작업대가 그리다 던져도 옆줄 · 진행판은 남는다 — 학습코드가 바뀌면 오류도 버린다(`ErrorGuard.tsx`)
              <ErrorGuard key={forgeCode} label="작업대">
                <Bench
                  key={forgeCode}
                  code={forgeCode}
                  onBack={() => {
                    // 작업대에서 한 일(만들기 · 답)은 칸의 상태를 바꾼다 — 돌아오면 새로 읽는다
                    setForgeCode(null)
                    refresh()
                  }}
                />
              </ErrorGuard>
            ) : (
              <>
                {/* 놓는 자리는 진행판 결과 바깥에 둔다 — 까닭은 `RscSort.tsx` 머리말 */}
                <BoardTop />
                <RscSort onDone={refresh} />
                {result ? (
                  <Board result={result} onForge={setForgeCode} onChanged={refresh} />
                ) : selected ? (
                  <p className="state">진행판을 불러오는 중…</p>
                ) : (
                  <p className="state">왼쪽에서 호를 선택하세요.</p>
                )}
              </>
            )
          ) : view === '기능' ? (
            <Features />
          ) : view === '관리' ? (
            <Manage />
          ) : (
            <FolderProperties key={folder} path={folder} />
          )}
        </main>
        <footer className="app-footer">
          {workspace?.forgeRoot ? `양산기 폴더 ${workspace.forgeRoot}` : ''}
        </footer>
      </div>
      {/* 단계마다 새로 그린다 — 진행판 결과가 늦게 와 「글로만」이 풀리거나 작업대 후보를 바꿔도 칸을 다시 찾는다 */}
      {tour.view && <Tour key={`${tour.view.index}|${tour.view.code ?? ''}|${tour.view.noBench}`} view={tour.view} />}
    </div>
  )
}

export default App
