import { useEffect, useState, type CSSProperties } from 'react'
import { DEFAULT_DIR } from '../../shared/ipc'
import Board from './components/Board'
import CodeGo from './components/CodeGo'
import FolderProperties from './components/FolderProperties'
import FolderTree from './components/FolderTree'
import Bench from './components/bench/Bench'
import RscSort from './components/RscSort'
import TeamSheetBar from './components/board/TeamSheetBar'
import Features from './components/Features'
import Manage from './components/manage/Manage'
import SettingsDrawer from './components/SettingsDrawer'
import SidebarHead, { type View } from './components/SidebarHead'
import Splitter, { useWidth } from './components/Splitter'
import UpdateBar from './components/UpdateBar'
import BoardList from './components/board/BoardList'
import NewModules from './components/board/NewModules'
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
  const { boards, boardsError, next, openIssue, closeBoard, selected, setSelected, result, refresh, reload, sameKey } = useBoard()

  // 폴더 화면(지금까지 만든 트리)은 그대로 둔다. 양산 전에 쓰기 권한을 보는 자리다.
  const [folder, setFolder] = useState(DEFAULT_DIR)
  const [treeKey, setTreeKey] = useState(0)

  // 리소스 화면. 학습코드가 있으면 진행판 대신 그것을 보여 준다.
  // **진행판은 첫 화면 그대로 남는다** — 돌아오면 고른 호가 그대로다.
  const [forgeCode, setForgeCode] = useState<string | null>(null)

  const {
    workspace,
    picking,
    refreshed,
    pickWorkspace,
    pickRscRoot,
    clearRscRoot,
    pickForgeRoot,
    setMe,
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
        <SidebarHead view={view} onView={setView} />

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
              />
              {/* 스펙 주인에게만 — 배치표가 정했는데 스펙이 없는 모듈 */}
              {workspace?.specOwner && <NewModules stamp={boards.map((b) => b.subject + b.issue).join() + (refreshed?.after ?? '')} />}
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
                next={next}
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
        <main className="content-body">
          {view === '진행판' ? (
            forgeCode ? (
              <Bench
                key={forgeCode}
                code={forgeCode}
                onBack={() => {
                  // 작업대에서 한 일(만들기 · 답)은 칸의 상태를 바꾼다 — 돌아오면 새로 읽는다
                  setForgeCode(null)
                  refresh()
                }}
              />
            ) : (
              <>
                {/*
                  **리소스 놓는 자리는 한 곳이다** (2026-09-16 사용자 결정).
                  학습코드 화면마다 있던 놓는 칸은 그대로 두되, 받은 것을 통째로
                  놓는 자리를 진행판에 하나 둔다 — 학습코드를 고를 필요가 없다.
                  넣고 나면 진행판을 다시 읽는다 (파일 수가 바뀐다).

                  **진행판 결과 바깥에 둔다.** 안에 두면 다시 읽는 동안
                  `result` 가 잠깐 null 이라 놓는 칸이 통째로 사라지고,
                  **방금 넣은 결과와 「안 넣은 것」 목록이 같이 날아간다** —
                  넣자마자 화면이 비었다 (2026-09-16 앱에서 드롭해 보고 찾음).
                  놓는 칸은 고른 호와 아무 상관이 없으니 밖이 제자리다.
                */}
                <TeamSheetBar />
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
    </div>
  )
}

export default App
