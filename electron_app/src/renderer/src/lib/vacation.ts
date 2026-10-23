import { HO_OF, hoOrder, type BoardRow, type VacationLink } from '../../../shared/forge'

/**
 * 방학호 짝을 화면에 적는 꼴 (2026-10-20) — 진행판 칸(`Tiles.tsx`)과 따로 모은 목록(`VacationList.tsx`)이 같이 쓴다.
 * 「원본」이라고 부르지 않는다 — 앱에서 원본은 양산할 때 고르는 완성본이다. 잰 것(파일이 같음)만 말한다.
 */

const monthOf = (code: string): string => /M(\d\d)/.exec(code)?.[1] ?? ''

/** 학습코드의 호 이름 — 「1호」 「6호(방학)」. 표에 없는 M 은 M 번호만 */
export const hoOfCode = (code: string): string => {
  const m = monthOf(code)
  return HO_OF[m]?.name ?? `M${m}`
}

/** 칸에 올렸을 때 보일 한 마디 */
export const vacationLine = (l: VacationLink): string =>
  l.side === 'copied'
    ? `${hoOfCode(l.code)} ${l.code} 에 그대로 쓰임(파일 ${l.same}/${l.total}개 같음)`
    : `${hoOfCode(l.code)} ${l.code} 에서 그대로 가져옴(파일 ${l.same}/${l.total}개 같음)`

export type VacationPair = { mine: string; from: string; to: string; same: number; total: number }

/** 이 진행판의 짝을 상대 호마다 — 화살표는 늘 앞선 호 → 방학호 */
export function vacationGroups(rows: BoardRow[]): { month: string; name: string; pairs: VacationPair[] }[] {
  const groups = new Map<string, VacationPair[]>()
  for (const row of rows) {
    for (const l of row.work?.vacation ?? []) {
      const pair = l.side === 'copied' ? { from: row.code, to: l.code } : { from: l.code, to: row.code }
      const month = monthOf(l.code)
      groups.set(month, [...(groups.get(month) ?? []), { mine: row.code, ...pair, same: l.same, total: l.total }])
    }
  }
  return [...groups]
    .sort(([a], [b]) => hoOrder(a) - hoOrder(b))
    .map(([month, pairs]) => ({ month, name: HO_OF[month]?.name ?? `M${month}`, pairs: pairs.sort((a, b) => a.mine.localeCompare(b.mine)) }))
}
