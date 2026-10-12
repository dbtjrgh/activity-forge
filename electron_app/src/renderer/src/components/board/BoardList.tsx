import type { CSSProperties } from 'react'
import type { BoardItem, BoardKey } from '../../../../shared/forge'
import { HO_OF, hoOrder } from '../../../../shared/forge'

const SUBJECT_NAME: Record<string, string> = { EN: '영어', MA: '수학', KO: '국어' }
const SUBJECT_ORDER = ['EN', 'MA', 'KO']

/**
 * 진행판 목록을 호마다 한 줄로 — **옛 호가 위**(사용자 말 — 「역순으로, M07 이 맨 위」), 줄 안은 영어 · 수학 · 국어 차례.
 * 차례는 **호 차례**다(`HO_OF`) — 6호가 방학호 M11 이라 M 번호 차례와 다르다. 표에 없는 M 은 맨 뒤에 M 번호로
 */
function issuesOf(boards: BoardItem[]): [string, BoardItem[]][] {
  const by = new Map<string, BoardItem[]>()
  for (const b of boards) by.set(b.issue, [...(by.get(b.issue) ?? []), b])
  const rank = (s: string): number => (SUBJECT_ORDER.indexOf(s) + 4) % 4
  return [...by.entries()]
    .sort((a, b) => hoOrder(a[0]) - hoOrder(b[0]))
    .map(([i, row]) => [i, row.sort((a, b) => rank(a.subject) - rank(b.subject))])
}

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
  next,
  onOpen
}: {
  boards: BoardItem[]
  selected: BoardKey | null
  isSelected: (a: BoardKey | null, b: BoardKey) => boolean
  onSelect: (b: BoardKey) => void
  onClose: (b: BoardKey) => void
  next: { issue: string; subjects: string[] } | null
  onOpen: (issue: string, subject: string) => void
}) {
  return (
    <>
      <ul className="board-list">
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
                    {SUBJECT_NAME[b.subject] ?? b.subject}
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
      {/* **다음 호는 사람이 한 번 연다** (M7) — 작업 폴더에 m09~m11 더미까지 있어 저절로 고르면 틀린다 */}
      {next && (
        <button
          className="ghost board-open"
          onClick={() => onOpen(next.issue, next.subjects[0] ?? 'EN')}
          title={`${next.subjects.join(', ')} 빈 배치표를 생성합니다`}
        >
          + {HO_OF[next.issue] ? `${HO_OF[next.issue].name}(M${next.issue})` : `M${next.issue}`} {next.subjects.length < 3 ? `${next.subjects.map((s) => SUBJECT_NAME[s] ?? s).join(', ')} ` : ''}열기
        </button>
      )}
    </>
  )
}
