/**
 * 돌린 결과를 **화면이 쓸 만큼만 줄인다.**
 *
 * forge 가 내놓는 것은 크다 — 맞추기 한 번에 자리가 수백 개고, 만들려던 글은
 * 파일 여덟 장이다. 그대로 IPC 로 보내면 화면이 쓰지도 않는 것을 나르게 되고,
 * 무엇을 보여 줄지를 렌더러가 다시 정하게 된다.
 *
 * **모르는 것을 빈 표로 보이지 않는다.** 못 견줬으면 왜 못 견줬는지, 검사가
 * 안 돌았으면 안 돌았다고 담는다. 빈 결과와 「이상 없음」은 다르다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MadeFile, OddReport, RunIssue, SwapReport } from '../../../shared/forge'
import { lineDiff, onlyChanged } from '../../lib/diff'
import { toMessage } from '../../lib/errors'
import type { Forge } from './runtime'

/** 한 파일에 담을 글의 상한. 넘으면 자르고 잘랐다고 말한다. */
const CLIP = 200_000

/**
 * 만들려던 글을 화면이 볼 수 있게 담고, **원본의 같은 파일과 견준다.**
 *
 * 견주는 상대는 호 저장소에 실제로 놓여 있는 원본의 파일이다 —
 * `sparkon_mNN/src/activity/<원본코드>/<파일>`. 클론이 값을 떠 온 바로 그
 * 자리라, 「원본과 무엇이 달라졌나」가 곧 「이번 회차에서 무엇이 바뀌나」다.
 *
 * **못 견주는 것을 빈 표로 보이지 않는다.** 원본에 그 파일이 없거나(새로
 * 생긴 파일) 너무 크면 까닭을 담는다.
 */
export function madeFiles(
  files: Record<string, string>,
  paths: Forge['paths'],
  origin: string
): MadeFile[] {
  const month = /M(\d\d)/.exec(origin)?.[1]
  const dir = month ? join(paths.workRoot(), `sparkon_m${month}`, 'src', 'activity', origin) : ''

  return Object.entries(files).map(([name, text]) => {
    const one: MadeFile = {
      name,
      chars: text.length,
      text: text.length > CLIP ? text.slice(0, CLIP) : text,
      clipped: text.length > CLIP
    }

    // 견주는 것은 사람이 실제로 볼 둘뿐이다. 템플릿에서 그대로 베끼는
    // 나머지(index.html·활동 정보 따위)는 견줘 봐야 늘 같거나 학습코드만 다르다.
    if (name !== 'GameData.ts' && name !== 'Activity.ts') return one
    if (!dir) {
      one.diff = { rows: [], added: 0, removed: 0, note: '원본 학습코드에서 호를 읽지 못했습니다.' }
      return one
    }

    const at = join(dir, name)
    if (!existsSync(at)) {
      one.diff = { rows: [], added: 0, removed: 0, note: `원본에 ${name} 파일이 없어 비교하지 못했습니다.` }
      return one
    }
    try {
      const d = lineDiff(readFileSync(at, 'utf8'), text)
      one.diff = {
        rows: d.tooBig ? [] : onlyChanged(d.rows),
        added: d.added,
        removed: d.removed,
        note: d.tooBig
      }
    } catch (error) {
      one.diff = { rows: [], added: 0, removed: 0, note: `원본을 읽지 못했습니다: ${toMessage(error)}` }
    }
    return one
  })
}

/** 맞추기 결과를 화면이 쓸 만큼만 줄인다. 못 맞은 것은 무리로 묶어서. */
export function reportSwap(
  swapper: Forge['swap'],
  s: ReturnType<Forge['swap']['swapResources']>
): SwapReport {
  const counted = new Map<string, number>()
  for (const h of s.hits) counted.set(h.rule, (counted.get(h.rule) ?? 0) + 1)
  return {
    slots: s.hits.length + s.misses.length,
    hits: s.hits.length,
    byRule: [...counted].map(([rule, n]) => ({
      rule,
      label: swapper.RULE_LABEL[rule as keyof typeof swapper.RULE_LABEL] ?? rule,
      n
    })),
    families: swapper.families(s),
    spare: s.spare.length,
    notes: s.notes,
    aliases: Object.entries((s.recipe as { assets?: Record<string, { alias: string }[]> }).assets ?? {}).flatMap(
      ([kind, list]) => list.map((a) => `${kind}|${a.alias}`)
    )
  }
}

/**
 * 「혼자만 다른 것」을 이 학습코드에 대해서만 추린다.
 *
 * **아직 안 쓴 차시는 견줄 대상에 없다.** 그럴 때 「다른 자리 없음」이라고
 * 하면 검사가 돈 것처럼 보인다. 안 돌았다고 말한다.
 */
export function reportOdd(oddly: Forge['odd'], code: string, module: string): OddReport {
  const subject = code.slice(0, 2)
  const found = oddly.findOdd(subject, module)
  if (found.note) return { ran: false, note: found.note, samples: found.samples.length, mine: [] }
  if (!found.samples.includes(code)) {
    return {
      ran: false,
      note: `저장소에 반영한 뒤 같은 모듈 ${found.samples.length}개와 비교합니다.`,
      samples: found.samples.length,
      mine: []
    }
  }
  return {
    ran: true,
    note: '',
    samples: found.samples.length,
    mine: found.odds
      .filter((o) => o.code === code)
      .map((o) => ({
        where: o.where,
        kind: o.kind,
        what: o.what,
        ...(o.mine !== undefined ? { mine: o.mine } : {}),
        ...(o.others !== undefined ? { others: o.others } : {})
      }))
  }
}

/**
 * 스펙에 적은 「관계」가 낸 것에 표를 붙인다.
 *
 * `runRelations` 는 `rule` 칸에 **관계의 id 를 그대로** 적는다. 그래서 규칙
 * 이름만 봐서는 생성기가 낸 것인지 스펙이 낸 것인지 모른다. 스펙에서 id 를
 * 읽어 대조한다 — 1단계 1-2 가 잡은 것이 무엇인지 화면에서 갈리게 하려는 것이다.
 */
export function tagRelations(
  spec: { relations?: { id: string }[] } | null,
  issues: { level: string; rule: string; path: string; message: string; why?: string }[]
): RunIssue[] {
  const ids = new Set((spec?.relations ?? []).map((r) => r.id))
  return issues.map((i) => ({ ...i, ...(ids.has(i.rule) ? { relation: true } : {}) }))
}
