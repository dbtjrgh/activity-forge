/**
 * 안 됐을 때 **사람에게 무엇을 달라고 할지** 정한다.
 *
 * 최종 목표 그림의 오른쪽 갈래다(`_document/양산계획.md`). 에러 목록만
 * 내놓으면 「그래서 뭘 어쩌라고」가 된다. 걸린 것 하나하나를 **요구 한 장**으로
 * 바꾼다 — 무엇이 없나가 아니라 **무엇을 어떤 꼴로 주면 풀리나**.
 *
 *   리소스파일   그 이름의 파일을 폴더에 넣어 주세요
 *   고르기       폴더에 있는 것 중 이 자리에 쓸 것을 골라 주세요 (후보 있음)
 *   좌표         피그마에서 그 요소의 x·y·w·h 를 재서 알려 주세요
 *   값           기획서의 그 대목을 알려 주세요
 *   사람이 봐야  기계가 판정 못 합니다. 무엇을 봐야 하는지만 적습니다
 *
 * **요구는 이름 무리로 묶는다.** 자리마다 한 장씩 내면 `KOL1M07W1S1` 에서
 * 130장이 나온다. 실제 사정은 「사과 그림 한 벌이 통째로 없다」 몇 가지다.
 *
 * **후보를 「이것이다」라고 말하는 것은 자리 하나에 남은 파일 하나일 때뿐이다.**
 * 여럿이면 어느 쪽인지 알 수 없으므로 후보로 늘어놓되 **짝은 사람이 정한다**고
 * 적는다. 짐작해서 채우면 잘못된 액티비티가 조용히 나온다.
 *
 * **설명은 스펙에서 가져온다.** 스펙의 `desc` 는 이미 사람이 읽으라고 쓴
 * 글이다(「이름이 아니라 파일 크기를 보세요 — 1370x600」). 여기서 새로 짓지
 * 않는다. 두 벌이 되면 갈라진다.
 *
 * **에러 하나 → 그 자리 카드는 `askfield.ts`, 리소스 카드는 `askasset.ts`, 배치표 카드는 `askmodule.ts` 에
 * 있다** (2026-09-18 · 2026-09-23 에 갈랐다). 여기는 카드를 모으는 것뿐이다.
 */

import type { Answer, Ask } from '../../../shared/forge'
import { SEEN_PREFIX } from '../../../shared/forge'
import { askOf, HANDS_OFF } from './askfield'
import { assetAsks, spareByFamily } from './askasset'
import type { SizeGroup } from './sizematch'
import type { Issue, Spec } from '@/gen/types'
import type { Swap } from '@/gen/swap'

export function asksOf(
  issues: Issue[],
  spec: Spec | null,
  swap: Swap,
  familyOf: (rel: string) => string,
  /**
   * **이 별칭은 리소스 요구로 내지 않는다.** 이 회차에 없어질 자리라고
   * 가려 둔 것이라(`slots.ts`), 「그 이름의 파일을 주세요」는 답이 없는
   * 물음이다. 그 자리는 자리 카드가 따로 맡는다.
   */
  skip: Set<string> = new Set(),
  /** 같은 크기라 차례만 남은 묶음(`sizematch.ts`) — 그 자리들은 고르기 카드로 */
  groups: SizeGroup[] = [],
  /** 기획서가 들어와 있나 — 순서만 남은 카드의 안내가 갈린다(`askorder.ts`) */
  hasPlan = false
): Ask[] {
  const spare = spareByFamily(swap, familyOf)
  const asset: Issue[] = []
  const out: Ask[] = []
  for (const issue of issues) {
    // 주의(warn)는 막지 않는다. 다만 「사람이 봐야」라고 스펙이 말한 것은
    // 그것 자체가 요구다 — 사람이 안 보면 아무도 안 본다.
    if (issue.level !== 'error' && !issue.message.startsWith(HANDS_OFF)) continue
    if (issue.rule.startsWith('asset-file')) {
      if (!skip.has(issue.path.split('.').pop() ?? '')) asset.push(issue)
    } else out.push(askOf(issue, spec, swap.recipe))
  }
  return [...assetAsks(asset, swap, spare, familyOf, groups, hasPlan), ...byRelation(out, spec)]
}

/**
 * **관계 하나가 여러 자리에 걸리면 한 장이다** (2026-09-23). MAL2M07W2S1 에서
 * `answer-button-exists` 가 정답표 11칸에 걸려 11장이 나왔다 — 실제 사정은
 * 「정답표가 옛 회차 것이라 이 회차에 없는 6·7번 버튼을 가리킨다」 하나다.
 * 관계는 칸 하나의 값이 아니라 **자리 사이의 어긋남**이라 칸마다 받을 값도 없다.
 * 규칙·필드 카드는 칸마다 값을 받으므로 안 묶는다.
 */
function byRelation(asks: Ask[], spec: Spec | null): Ask[] {
  const rel = new Set((spec?.relations ?? []).map((r) => r.id))
  const ruleOf = (a: Ask): string => a.id.slice(0, a.id.indexOf('|'))
  const groups = new Map<string, Ask[]>()
  const out: Ask[] = []
  for (const a of asks) {
    const g = rel.has(ruleOf(a)) ? groups.get(ruleOf(a)) : undefined
    if (g) {
      g.push(a)
      continue
    }
    if (rel.has(ruleOf(a))) groups.set(ruleOf(a), [a])
    out.push(a) // 자리는 첫 장이 잡는다 — 차례가 안 흔들린다
  }
  return out.map((a) => {
    const g = groups.get(ruleOf(a))
    if (!g || g.length < 2) return a
    return {
      ...a,
      id: `${ruleOf(a)}|*`,
      title: `${a.title} 외 ${g.length - 1}개 항목`,
      where: `${g.length}개 항목`,
      give: '같은 규칙에 걸린 항목입니다. forge-ui.bat 화면에서 한꺼번에 고치세요.',
      options: [],
      shape: 'none' as const,
      count: g.length,
      items: g.map((x) => `${x.where} — ${x.title}`),
      carry: false
    }
  })
}

/**
 * 사람이 「확인했습니다」를 누른 카드에 표를 해 둔다.
 *
 * **글은 안 받는다** (2026-09-16). 전에는 메모를 적어야 카드가 닫혔는데,
 * 적는 사람에게 일만 늘고 읽는 사람은 없었다. 누른 사실만 답으로 남는다.
 */
export function withDone(asks: Ask[], seen: Set<string>): Ask[] {
  if (!seen.size) return asks
  return asks.map((a) => (seen.has(a.id) ? { ...a, done: true } : a))
}

/** 「확인했습니다」가 눌린 카드의 id. 값이 참인 `#seen|…` 답만 센다. */
export function seenIds(answers: Answer[]): Set<string> {
  const out = new Set<string>()
  for (const a of answers) {
    if (a.path.startsWith(SEEN_PREFIX + '|') && a.value === true) {
      out.add(a.path.slice(SEEN_PREFIX.length + 1))
    }
  }
  return out
}
