import type { CSSProperties } from 'react'
import type { BoardItem, BoardKey, BoardList as BoardListData } from '../../../../shared/forge'
import { HO_OF, SUBJECTS, hoLabel, hoOrder, subjectName, subjectRank } from '../../../../shared/forge'
import { TOUR_ANCHOR } from '../../lib/anchors'

/**
 * 진행판 목록을 호마다 한 줄로 — **옛 호가 위**(사용자 말 — 「역순으로, M07 이 맨 위」), 줄 안은 과목 표 차례(영어 · 수학 · 국어 · 누리, `shared/forge/subjects.ts`).
 * 차례는 **호 차례**다(`HO_OF`) — 6호가 방학호 M11 이라 M 번호 차례와 다르다. 표에 없는 M 은 맨 뒤에 M 번호로
 */
function issuesOf(boards: BoardItem[]): [string, BoardItem[]][] {
  const by = new Map<string, BoardItem[]>()
  for (const b of boards) by.set(b.issue, [...(by.get(b.issue) ?? []), b])
  return [...by.entries()]
    .sort((a, b) => hoOrder(a[0]) - hoOrder(b[0]))
    .map(([i, row]) => [i, row.sort((a, b) => subjectRank(a.subject) - subjectRank(b.subject))])
}

/** 열기 단추 글 — 과목 표 전부를 여는 호는 과목 이름을 안 붙인다(「+ M12 열기」), 일부만이면 붙인다(「+ 1호(M01) 누리 열기」) */
const openText = (o: { issue: string; subjects: string[] }): string =>
  `+ ${hoLabel(o.issue)} ${o.subjects.length < SUBJECTS.length ? `${o.subjects.map(subjectName).join(', ')} ` : ''}열기`

const allDone = (b: BoardItem): boolean => b.done !== null && b.total > 0 && b.done === b.total

/**
 * **옆줄의 진행판 목록** — 호마다 가로 막대 한 줄 (사용자 말 — 「가로 막대형으로 깔끔하게」). `App.tsx` 에서 떼어 냈다(200줄).
 * 칸마다 끝난 만큼 아래 띠가 차고 **다 끝나면 초록**이다(사용자 말 — 「다 완성돼 있는 것들은 겉보기에서도 티 나게」).
 * 셈은 호 저장소의 devFinished 만 본다(`board.ts` `progressOf`) — 배치표가 뺀 국어 협력사 몫은 안 센다.
 */
export default function BoardList({
  boards,
  selected,
  isSelected,
  onSelect,
  onClose,
  opens,
  onOpen
}: {
  boards: BoardItem[]
  selected: BoardKey | null
  isSelected: (a: BoardKey | null, b: BoardKey) => boolean
  onSelect: (b: BoardKey) => void
  onClose: (b: BoardKey) => void
  opens: BoardListData['opens']
  onOpen: (issue: string, subject: string) => void
}) {
  return (
    <>
      <ul className="board-list" id={TOUR_ANCHOR.sideBoards}>
        {issuesOf(boards).map(([issue, row]) => (
          <li key={issue} className="board-row">
            {/* 사람은 호로 부른다 — 호가 앞, M 번호는 옆에 작게 */}
            <span className="board-issue">
              <b>{HO_OF[issue]?.name ?? `M${issue}`}</b>
              {HO_OF[issue] && <small className="mono">M{issue}</small>}
            </span>
            <span className="board-bar">
              {row.map((b) => (
                <span key={b.subject} className="board-item">
                  <button
                    className={`board-pick${isSelected(selected, b) ? ' selected' : ''}${allDone(b) ? ' all-done' : ''}`}
                    onClick={() => onSelect(b)}
                    style={{ '--p': b.done === null || !b.total ? 0 : b.done / b.total } as CSSProperties}
                    title={b.done === null ? '호 저장소가 없어 진행률을 계산할 수 없습니다' : `개발 완료 ${b.done} / ${b.total}`}
                  >
                    {subjectName(b.subject)}
                  </button>
                  {/* **사람이 정한 칸이 없는 것만 닫는다** — 배치표는 휴지통으로, 호 저장소 · 리소스는 그대로 */}
                  {!b.closeWhy && (
                    <button
                      className="board-close"
                      onClick={() => onClose(b)}
                      title={`${b.subject}${b.issue} 닫기 (빈 배치표는 휴지통으로 이동합니다)`}
                      aria-label={`${b.subject}${b.issue} 닫기`}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {/* **다음 호는 사람이 한 번 연다** (M7) — 작업 폴더에 m09~m11 더미까지 있어 저절로 고르면 틀린다. 과목마다 다음 호가 달라 단추가 여럿일 수 있다 */}
      {opens.map((o) => (
        <button key={o.issue} className="ghost board-open" onClick={() => onOpen(o.issue, o.subjects[0] ?? '')}>
          {openText(o)}
        </button>
      ))}
    </>
  )
}
