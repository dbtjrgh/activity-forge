/**
 * **통째로 맡기기**(`whole.ts`)의 브리프와 받은 답 읽기 (2026-10-02).
 *
 * 좁은 물음(맞추기 · 짜임 · 값 고치기)은 칸 하나씩 묻는다 — 구조가 원본과 같으면 그쪽이 더 맞고 싸다(9-28 M1).
 * 구조가 바뀌는 회차(KOL1M08W2S3 퍼즐 — 낱말마다 조각 수 · 조각 종류가 다름)에서는 물음마다 전체가 안 보여
 * 오전 내내 카드를 주고받고도 못 풀었다. 같은 입력을 한 장에 다 주니 3분에 풀었다(사용자 말 — 「아예 해결할 수 있는 방법」).
 * 그래서 여기는 **원본 완성본을 본보기로, 이 회차 레시피 전체를** 받는다. 검산은 도구가 한다(`whole.ts`).
 *
 * 리소스 표는 측정 스크립트 `forge/src/tool/pack.ts` 와 같은 꼴이다 — 그쪽이 이 함수를 부른다.
 * Electron 을 import 하지 않는다(services 규칙).
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Answer } from '../../../shared/forge'
import type { Forge } from './runtime'

type Asset = { alias: string; file: string; base?: string }
const md5 = (f: string): string => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex')

/** 리소스 표 — 파일 · 크기 · 원본과 같은 파일인가 · 지금 쓰는 별칭. 폴더에 없는 자리는 맨 아래 */
export function rscTable(forge: Forge, rsc: string, originRsc: string, recipe: unknown): { text: string; files: number; missing: number } {
  const used = new Map<string, string[]>()
  const assets = (recipe as { assets?: Record<string, Asset[]> }).assets ?? {}
  for (const list of Object.values(assets)) for (const a of list ?? []) {
    const rel = a.base === 'root' ? a.file : `${a.base ?? ''}/${a.file}`.replace(/^\//, '')
    used.set(rel, [...(used.get(rel) ?? []), a.alias])
  }
  const rows = ['파일\t가로×세로\t원본과\t쓰는 별칭']
  const files = fs.existsSync(rsc) ? forge.files.walk(rsc, '').filter((f) => !f.startsWith('_')) : []
  for (const f of files) {
    const full = path.join(rsc, f)
    const size = f.endsWith('.png') ? forge.png.pngSize(full) : null
    const o = path.join(originRsc, f)
    const same = fs.existsSync(o) ? (md5(o) === md5(full) ? '같음' : '다름') : '원본에 없음'
    const alias = [...used.entries()].filter(([k]) => f.endsWith(k) || k.endsWith(f)).flatMap(([, v]) => v)
    rows.push(`${f}\t${size ? `${size.w}×${size.h}` : ''}\t${same}\t${alias.join(',') || '(안 씀)'}`)
  }
  // 글꼴은 공용 자리에서 온다 — 「폴더에 없음」으로 적으면 뺄 자리로 안다
  const missing = [...used.keys()].filter((k) => !k.startsWith('font/') && !files.some((f) => f.endsWith(k) || k.endsWith(f)))
  for (const m of missing) rows.push(`${m}\t\t\t${(used.get(m) ?? []).join(',')} ← 폴더에 없음`)
  return { text: rows.join('\n'), files: files.length, missing: missing.length }
}

export type WholeFacts = {
  code: string
  module: string
  origin: string
  /** 원본 완성본 액티비티 폴더(GameData.ts · AssetTable.ts) */
  originAct: string
  originRsc: string
  moduleDir: string
  /** 같은 모듈의 다른 완성본 액티비티 폴더 — 원본에 안 나오는 경우의 규칙을 본다 */
  others: string[]
  /** 리소스 폴더 안 상대 경로 — **붙인 차례 그대로** */
  shots: string[]
  plans: string[]
  recipe: unknown
  table: string
  spec: string
  person: Answer[]
  /** 앞 판의 검사 에러 — 다시 물을 때만 */
  errors?: string[]
}

export function wholeBrief(f: WholeFacts): string {
  return [
    `# ${f.code} 만들기 — 원본 ${f.origin} 을 본보기로`,
    '',
    `모듈은 ${f.module} 입니다. 원본 ${f.origin} 은 같은 모듈을 사람이 다 만든 완성본입니다. **그 완성본이 한 방식 그대로** 이 회차를 만듭니다.`,
    '아래 「지금 레시피」는 도구가 원본을 복사하고 파일 이름으로 맞출 수 있는 것을 맞춘 것입니다. **이 회차와 구조가 다를 수 있습니다** — 이닝마다 칸 수, 칸 종류, 낱말이 바뀝니다.',
    '',
    '## 볼 것',
    '',
    `- **figma 화면 ${f.shots.length}장 — 붙인 차례가 곧 이닝 차례입니다.** 화면의 진행 표시로 차례를 정하지 않습니다.`,
    ...f.shots.map((s, i) => `  ${i + 1}. \`${s}\``),
    ...(f.plans.length ? [`- 기획서: ${f.plans.map((p) => `\`${p}\``).join(', ')} — 낱말 · 정답 · 소리 번호표는 여기가 정본입니다`] : ['- 기획서는 없습니다.']),
    '- 이 회차 리소스 폴더는 지금 작업 폴더입니다. **이름이 무작위인 그림은 Read 로 열어 보고** 자리를 정합니다.',
    `- 원본 완성본: \`${f.originAct}\` 의 GameData.ts · AssetTable.ts — 별칭 짓는 법, **번호 붙은 파일(소리 nar01 … )을 어떤 차례로 썼는지** 여기서 보고 같은 규칙을 따릅니다.`,
    ...(f.others.length
      ? [`- 같은 모듈의 다른 완성본: ${f.others.map((d) => `\`${d}\``).join(', ')} — **원본에 안 나오는 경우**(같은 글자가 두 번, 한 글자 낱말, 칸 수가 다른 이닝 따위)는 여기서 규칙을 찾습니다. 여럿이 같은 규칙이면 그것을 따릅니다`]
      : []),
    `- 원본 리소스: \`${f.originRsc}\` — 같은 자리 그림이 어떻게 생겼는지 견줄 때`,
    `- 모듈 소스: \`${f.moduleDir}\` — 모듈이 어떤 별칭과 값을 읽는지는 여기가 정본입니다`,
    '',
    '## 할 일',
    '',
    '1. 화면과 기획서로 이닝마다 무엇이 몇 개 나오는지 셉니다.',
    '2. 지금 레시피를 이 회차에 맞게 고칩니다 — 칸을 늘리고 줄이고, 칸 종류를 바꾸고, id 와 별칭을 이 회차 낱말로, 값을 이 회차 것으로.',
    '3. assets 의 파일은 리소스 폴더에 실제로 있는 것만 씁니다. 폴더의 파일은 될 수 있는 대로 다 씁니다. 원본에만 있던 자리는 뺍니다.',
    '4. 좌표(x, y)는 이미 있는 칸은 그대로 두고, 새로 생긴 칸만 화면에서 어림합니다.',
    '5. 아래 「사람이 정한 값」은 바꾸지 않습니다.',
    '6. 화면 · 기획서 · 원본 규칙으로 알 수 있는 것은 정해서 넣습니다. 그래도 짐작인 것만 ASKS 에 적습니다.',
    '',
    '## 답하는 꼴 — 세 덩어리만, 다른 말 없이',
    '',
    '===RECIPE===',
    '(고친 레시피 JSON 전체 — recipeVersion, code, module, subject, assets, gameData)',
    '===NOTES===',
    '[{"path": "…", "before": "…", "after": "…", "why": "…"}]',
    '===ASKS===',
    '[{"path": "…", "question": "무엇이 짐작인가 한 줄", "need": "무엇이 있으면 확정되나"}]',
    '',
    ...(f.errors?.length
      ? ['## 앞 답을 검사한 결과 — 고쳐서 다시 전체를 내세요', '', ...f.errors.map((e) => `- ${e}`), '']
      : []),
    ...(f.person.length ? ['## 사람이 정한 값', '', ...f.person.map((a) => `- ${a.path} = ${JSON.stringify(a.value)}`), ''] : []),
    '## 지금 레시피',
    '',
    '```json',
    JSON.stringify(f.recipe, null, 1),
    '```',
    '',
    '## 리소스 표',
    '',
    f.table,
    '',
    '## 스펙',
    '',
    '```json',
    f.spec,
    '```'
  ].join('\n')
}

export type WholeAsk = { path: string; question: string; need: string }
export type WholeNote = { path: string; before?: unknown; after?: unknown; why?: string }

/** 받은 글을 세 덩어리로. 레시피를 못 읽으면 `error` */
export function readWhole(text: string, code: string, module: string): { recipe?: Record<string, unknown>; notes: WholeNote[]; asks: WholeAsk[]; error: string } {
  const part = (name: string): string => {
    const m = new RegExp(`===${name}===\\s*([\\s\\S]*?)(?====[A-Z]+===|$)`).exec(text)
    return (m?.[1] ?? '').replace(/^```(?:json)?\s*|\s*```\s*$/g, '').trim()
  }
  const list = <T>(s: string): T[] => {
    try {
      const v = JSON.parse(s || '[]') as unknown
      return Array.isArray(v) ? (v as T[]) : []
    } catch {
      return []
    }
  }
  const notes = list<WholeNote>(part('NOTES'))
  const asks = list<WholeAsk>(part('ASKS')).filter((a) => a && typeof a.question === 'string')
  let recipe: Record<string, unknown> | undefined
  try {
    recipe = JSON.parse(part('RECIPE')) as Record<string, unknown>
  } catch {
    return { notes, asks, error: 'AI 가 낸 레시피를 읽지 못했습니다.' }
  }
  if (!recipe || recipe['code'] !== code || recipe['module'] !== module || typeof recipe['gameData'] !== 'object' || typeof recipe['assets'] !== 'object') {
    return { notes, asks, error: 'AI 가 낸 레시피의 학습코드나 모듈이 다릅니다.' }
  }
  return { recipe, notes, asks, error: '' }
}
