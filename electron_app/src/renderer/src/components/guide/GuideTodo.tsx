import type { RscGuide } from '../../../../shared/forge'
import { guideTodo, todoVerdict } from '../../lib/guidetodo'

/**
 * 받을 리소스 창 맨 위 「할 일」 (2026-10-28) — 무엇을 직접 넣고 무엇은 앱이 하는지, 다 넣었는지를 한눈에.
 * 줄을 고르는 셈은 `lib/guidetodo.ts` 다. 진행 막대 하나로 세던 것을 이것으로 바꿨다(원본 소리 이름 때문에 막대가 안 찼다)
 */
const MARK = { left: '○', guess: '✓', done: '✓', none: '–' }

function GuideTodo({ data }: { data: RscGuide }) {
  // 끝낸 학습코드는 원본과 개수를 견주지 않는다 — 이번 호가 원본보다 적게 쓴 것까지 「아직 없음」으로 나왔다
  if (data.finished)
    return (
      <div className="guide-todo done">
        <p className="guide-verdict">개발 완료된 학습코드입니다.</p>
      </div>
    )
  const rows = guideTodo(data)
  const verdict = todoVerdict(rows)
  return (
    <div className={`guide-todo${verdict.done ? ' done' : ''}`}>
      <p className="guide-verdict">{verdict.text}</p>
      <ul>
        {rows.map((r) => (
          <li key={r.key} className={r.state}>
            <span className="guide-todo-mark">{MARK[r.state]}</span>
            <div>
              <b>{r.title}</b> <span>{r.text}</span>
              {r.names && r.names.length > 0 && (
                <details>
                  <summary>없는 이름 {r.names.length}개</summary>
                  <p className="mono">{r.names.join(', ')}</p>
                </details>
              )}
            </div>
          </li>
        ))}
      </ul>
      {/* 끝낸 학습코드는 리소스 폴더를 정리해 파일이 호 저장소에만 있다 — 「넣은 리소스」가 0 인데 다 왔다고 나오는 까닭 */}
      {data.hall > 0 && <p className="guide-todo-note">호 저장소에 이미 올라간 파일 {data.hall}개도 들어온 것으로 셉니다.</p>}
    </div>
  )
}

export default GuideTodo
