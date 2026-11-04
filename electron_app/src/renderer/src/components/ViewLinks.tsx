import type { ViewCheck } from '../../../shared/forge'
import { hoLabel } from '../../../shared/forge'

/**
 * 미리보기 칸의 **연결(정션) 목록** (2026-10-14, `ViewPanel.tsx` 에서 떼어 냄).
 * 무엇이 안 걸렸는지 짚을 수 있게 정션 넷을 그대로 보여 준다.
 * 서버가 도는 동안 공통 node_modules 정션이 다른 호로 바뀌면 30초마다 다시 재서 알리던 것은 2026-11-03 에 걷었다 —
 * 미리보기 덧config 가 의존성을 이 호 것으로 풀어(`devconfig.ts`) 정션이 바뀌어도 띄운 호 코드 그대로다
 */
export default function ViewLinks({ check }: { check: ViewCheck }) {
  return (
    <details className="files">
      <summary>
        미리보기 연결 {check.links.filter((l) => l.ok).length}/{check.links.length}
        {check.linkedMonth && ` (연결된 호: ${hoLabel(check.linkedMonth)})`}
      </summary>
      <ul>
        {check.links.map((l) => (
          <li key={l.at}>
            <span className={`tag ${l.ok ? 'done' : 'error'}`}>{l.ok ? '연결됨' : '없음'}</span>
            <span className="mono">{l.name}</span>
            <span className="sub">{l.target || l.at}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
