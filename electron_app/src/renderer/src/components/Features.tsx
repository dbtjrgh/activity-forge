import { useState } from 'react'
import { FEATURES } from '../lib/features'

/**
 * 「기능」 화면 (2026-09-30) — 이 프로그램이 무엇을 하나. 목록 정본은 `lib/features.ts` 하나다.
 * 찾기 칸은 이름 · 하는 일 · 자리 어디든 들어 있으면 남긴다 — 「이런 기능이 이미 있나」를 파일 이름으로도 찾게.
 */
function Features() {
  const [q, setQ] = useState('')
  const want = q.trim().toLowerCase()
  const groups = FEATURES.map((g) => ({
    ...g,
    rows: want ? g.rows.filter((r) => `${r.name} ${r.what} ${r.where}`.toLowerCase().includes(want)) : g.rows
  })).filter((g) => g.rows.length)
  const total = FEATURES.reduce((a, g) => a + g.rows.length, 0)

  return (
    <div className="board features">
      <div className="board-head">
        <h2>기능</h2>
        <p className="count">
          기능 {total}개. 기능을 추가하거나 삭제하면 <span className="mono">renderer/src/lib/features.ts</span> 파일도 함께 수정하세요.
        </p>
      </div>
      <input className="code-input features-find" value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름, 설명, 파일 이름으로 검색" />
      {groups.length === 0 && <p className="state">「{q}」 검색 결과가 없습니다.</p>}
      {groups.map((g) => (
        <section key={g.title} className="features-group">
          <h3>{g.title}</h3>
          {g.note && <p className="sub">{g.note}</p>}
          <table className="run-table features-table">
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.name}>
                  <td className="features-name">{r.name}</td>
                  <td>{r.what}</td>
                  <td className="mono sub">{r.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}

export default Features
