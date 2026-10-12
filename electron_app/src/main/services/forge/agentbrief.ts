/**
 * **맡기기 브리프** — 막힌 카드를 채팅처럼 폴더를 뒤져 푸는 에이전트에게 줄 글 (2026-09-30, `agent.ts`).
 *
 * 채팅에서 Claude 가 한 일을 그대로 적는다 — 원본 호 폴더와 견주고, 그림을 열어 보고, 크기를 재고, figma 화면 ·
 * 기획서를 읽는다. 규칙은 `_document/차례표.md` 의 다섯이다. **답만** 받는다 — 파일은 안 건드린다
 * (그 에이전트에게는 쓰기 도구가 없다, `aiargs.ts`).
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer, Ask } from '../../../shared/forge'

export type AgentFacts = {
  code: string
  module: string
  origin: string
  /** 원본 호의 리소스 폴더(절대 경로) — 읽기만 */
  originDir: string
  /** 스펙 파일(절대 경로) */
  specFile: string
  /** 사람이 이미 준 답 — 기획이 정한 것(이름표 차례 등). 이것에 맞춰 푼다 */
  person: Answer[]
}

export function agentBrief(f: AgentFacts, asks: Ask[]): string {
  const cards = asks.map((a) => ({
    path: a.where,
    title: a.title,
    shape: a.shape,
    ...(a.options.length ? { options: a.options.map((o) => o.value) } : {}),
    ...(a.now !== undefined ? { now: a.now } : {}),
    ...(a.desc ? { desc: a.desc } : {})
  }))
  return [
    `# 학습코드 ${f.code} (${f.module}) — 막힌 카드 ${asks.length}장을 풀어라`,
    '',
    `이 액티비티는 원본 ${f.origin} 을 떠 와서 만든다. 도구가 이름으로 못 맞춘 자리가 아래 카드다.`,
    '',
    '## 볼 수 있는 곳 (읽기만)',
    `- 지금 폴더(\`.\`) — ${f.code} 의 리소스 폴더. \`images/\` · \`sounds/\` · \`_figma/\`(figma 화면) · \`_plan/\`(기획서)`,
    `- 원본 ${f.origin} 의 리소스 폴더 — \`${f.originDir}\``,
    `- 모듈 스펙 — \`${f.specFile}\``,
    '',
    '## 규칙',
    '1. 원본의 같은 자리 그림을 열어 보고, 이 폴더에서 **뜻이 같은 그림**을 고른다(이름은 figma 식이라 믿지 않는다)',
    '2. 크기가 같은 그림이 여럿이면 **차례**가 문제다 — figma 화면 · 기획서 · 아래 「사람이 정한 것」의 차례를 따른다',
    '3. GameData 가 무작위(랜덤)로 쓰는 무리는 파일 이름 차례로 둔다',
    '4. 한 무리 안에서 **한 파일은 한 자리에만** 넣는다',
    '5. 확실하지 않은 카드는 **답하지 않는다** — 빈 채로 두면 사람이 본다',
    '',
    '## 사람이 정한 것',
    f.person.length ? f.person.map((a) => `- \`${a.path}\` = ${JSON.stringify(a.value)}`).join('\n') : '- 없음',
    '',
    '## 카드',
    '```json',
    JSON.stringify(cards, null, 1),
    '```',
    '',
    '## 답하는 꼴',
    '마지막에 **json 블록 하나**로만 답한다. `path` 는 위 카드의 것 그대로, `value` 는 고르기면 **options 가운데 하나를 글자 그대로**(`images/` 까지) 적는다.',
    '`why` 에는 무엇을 보고 정했는지 한 줄.',
    '```json',
    '[{"path": "assets.image.film1", "value": "images/Group 33082.png", "why": "원본 film1 이 캔 그림이고, 이 폴더에서 캔 그림은 이것"}]',
    '```'
  ].join('\n')
}

/** 받은 글에서 답을 읽고 **검산한다** — 준 카드의 자리 · 고르기 후보만 받고, 한 무리에 같은 파일이 두 번이면 그 무리를 통째로 버린다 */
export function readAgent(text: string, asks: Ask[]): { answers: Answer[]; why: Map<string, string>; refused: string[] } {
  const refused: string[] = []
  const why = new Map<string, string>()
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1] ?? '')
  let raw: unknown = []
  try {
    raw = JSON.parse(blocks.at(-1) ?? '[]')
  } catch {
    return { answers: [], why, refused: ['AI 답의 json 을 읽지 못했습니다.'] }
  }
  const byPath = new Map(asks.map((a) => [a.where, a]))
  const got: Answer[] = []
  for (const r of Array.isArray(raw) ? raw : []) {
    const { path, value, why: w } = (r ?? {}) as { path?: unknown; value?: unknown; why?: unknown }
    const ask = typeof path === 'string' ? byPath.get(path) : undefined
    if (!ask) {
      refused.push(`${String(path)}: 요청한 질문이 아닙니다.`)
      continue
    }
    if (value === undefined || value === null || value === '') {
      // 규칙 5 — 확실하지 않아 비웠다. 까닭은 남긴다
      refused.push(`${ask.where}: AI 가 답을 비워 두었습니다${typeof w === 'string' ? ` (${w})` : ''}.`)
      continue
    }
    // 고르기는 후보 글자 그대로 받되, 폴더 머리(`images/`)를 뺀 이름으로 와도 **그 후보 하나로만** 이어지면 받는다
    // (2026-09-30 첫 시험에서 25자리를 다 맞게 골랐는데 머리를 빼고 적어 다 버렸다)
    const opt =
      ask.shape === 'pick'
        ? (ask.options.find((o) => o.value === value) ??
          (ask.options.filter((o) => o.value.split('/').pop() === value).length === 1
            ? ask.options.find((o) => o.value.split('/').pop() === value)
            : undefined))
        : undefined
    if (ask.shape === 'pick' && !opt) {
      refused.push(`${ask.where}: 후보에 없는 값입니다 (${String(value)}).`)
      continue
    }
    got.push({ path: ask.where, value: opt ? opt.value : ask.shape === 'number' ? Number(value) : (value as string) })
    if (typeof w === 'string') why.set(ask.where, w)
  }
  // 같은 후보 묶음(=같은 무리)에 같은 파일이 두 번 → 그 무리는 못 믿는다
  const groups = new Map<string, Answer[]>()
  for (const a of got) {
    const ask = byPath.get(a.path)
    if (ask?.shape !== 'pick') continue
    const key = ask.options.map((o) => o.value).sort().join('|')
    groups.set(key, [...(groups.get(key) ?? []), a])
  }
  const bad = new Set<string>()
  for (const list of groups.values()) {
    const vals = list.map((a) => String(a.value))
    if (new Set(vals).size !== vals.length) for (const a of list) bad.add(a.path)
  }
  if (bad.size) refused.push(`한 파일을 두 항목에 넣은 그룹이 있어 ${bad.size}개 항목의 답을 버렸습니다.`)
  return { answers: got.filter((a) => !bad.has(a.path)), why, refused }
}
