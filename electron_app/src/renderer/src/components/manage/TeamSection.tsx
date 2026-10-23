import { HO_OF, hoOrder, type TeamTally } from '../../../../shared/forge'

/**
 * 팀별 칸 — M 번호(호)마다 팀이 끝낸 칸 수. 맨 아래 줄은 아직 안 끝난 폴더.
 * 팀 이름은 activityInfo 에 적힌 그대로 센다 — 짐작해서 합치지 않는다, 어느 이름이 맞는지는 사람이 정한다
 */
function TeamSection({ tally }: { tally: TeamTally | null }) {
  if (!tally) return <p className="state">불러오는 중…</p>
  if (tally.error) return <p className="state error">{tally.error}</p>
  if (!tally.months.length) return <p className="state">호 저장소에 액티비티가 없습니다.</p>
  const ho = (m: string): string => HO_OF[m]?.name ?? `M${m}`
  const months = [...tally.months].sort((a, b) => hoOrder(a) - hoOrder(b))
  const sum = (rec: Record<string, number>): number => Object.values(rec).reduce((a, n) => a + n, 0)
  return (
    <>
      <table className="run-table manage-table manage-grid">
        <thead>
          <tr>
            <th>팀</th>
            {months.map((m) => (
              <th key={m} title={`M${m}`}>
                {ho(m)}
              </th>
            ))}
            <th>합계</th>
          </tr>
        </thead>
        <tbody>
          {tally.teams.map((t) => (
            <tr key={t.team}>
              <td>{t.team}</td>
              {months.map((m) => (
                <td key={m}>{t.byMonth[m] ?? ''}</td>
              ))}
              <td>
                <b>{t.total}</b>
              </td>
            </tr>
          ))}
          <tr className="manage-open">
            <td>미완료</td>
            {months.map((m) => (
              <td key={m}>{tally.open[m] ?? ''}</td>
            ))}
            <td>{sum(tally.open)}</td>
          </tr>
          <tr className="manage-total">
            <td>폴더</td>
            {months.map((m) => (
              <td key={m}>{tally.folders[m] ?? ''}</td>
            ))}
            <td>{sum(tally.folders)}</td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

export default TeamSection
