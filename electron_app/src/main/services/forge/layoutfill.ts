/**
 * **MA 기획서의 「모듈넘버」로 배치표를 채운다** (2026-09-29, M7). 9호 MA 는 36칸 중 31칸을 기계가 못 정한다 —
 * 앞선 호마다 모듈이 달라서다. 그런데 기획서 1쪽에 `모듈넘버: M05` 가 적혀 온다. 그것이 곧 답이다.
 *
 * - **배치표가 이미 정한 칸은 안 건드린다.** 다르면 기획서는 넣고, 다르다고 말한다 — 바꾸는 것은 사람이 작업대의
 *   「기획서대로 바꾸기」로 한다(`planmodule.ts` · `sortpaper.ts`, 2026-10-14). 원본이 없어 `layoutFor` 가 못 여는
 *   새 모듈의 첫 학습코드(M38_1 · M38_2)도 정한 칸이다 — 안 그러면 작업대를 열 때마다 사람이 적은 까닭을 덮는다
 * - 남기는 길은 사람 답과 같다(`carry.ts` → `_layout/<과목><호>.json`, 까닭에 「기획서 1쪽 모듈넘버」) — 길을 둘로 두지 않는다
 * - **스펙이 없는 모듈이면**(예: M02) 배치표에는 남기되 「9호 끝 기준 밖」이라고 같이 말한다 — 만들 수가 없다
 * - **모듈 폴더도 스펙도 없는 이름은 안 남긴다** — 기획서의 `M30_1` · `M30_2` 는 폴더가 아니라 M30 의 판이다(배치표 L1W2S1 까닭)
 * - 다른 학습코드 기획서(1쪽의 학습코드가 다른 것)는 안 본다 — MAL1M08W3S3 폴더에 W2S1 기획서가 같이 들어 있었다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { MODULE_PATH } from '../../../shared/forge'
import { carryAnswers } from './carry'
import type { Forge } from './runtime'

/**
 * 모듈 이름 한 개 — 수학 `M30` · `M30_3`, 국어 `K36` · `K32Type2`. 대소문자를 가린다 — 소리 이름 속 `SL_ma_m30_` 를 안 잡게.
 * 앞뒤가 글자 · `_` · `-` 이면 안 잡는다(`MA-L1-M08-W2-S1` 의 M08), `09호(M08)` 의 호도 안 잡는다
 */
const MOD = '(?<![A-Za-z0-9_-])(?<!호\\s*\\()(M\\d{2}(?:_\\d+)?|K\\d{2}(?:Type\\d+)?)(?![A-Za-z0-9_-])'

/**
 * 1쪽에서 모듈을 읽는 꼴 — **앞의 것이 이긴다.** 9호 기획서는 꼴이 제각각이었다(2026-10-14, 9호 MA 24장 · KO 4장).
 *   모듈 변경    `※ 모듈 변경: 기존 커리큘럼 M30(…) → M30_3(…)` — 옛 모듈이 먼저 나오므로 화살표 뒤를 본다(MAL3M08W2S1)
 *   이름표       `모듈넘버: M05` · `모듈 번호 : M38_1` · `모듈: M24 —` · `· 모듈 M05 ·`
 *   괄호         `(표현수학 M30_3)` · `(M25 두더지 게임)` · 국어 `(K36 쌍안경 모듈)`
 * 맨 앞 줄 밖(`M24 공통 재사용` 같은 낱 이름)은 다른 모듈을 말하는 것일 수 있어 안 본다
 */
const RULES = [
  new RegExp(`모듈[ \\t]*변경[ \\t]*[:：][^\\n]*?→[ \\t]*${MOD}`, 'g'),
  new RegExp(`모듈[ \\t]*(?:넘버|번호|ID)?[ \\t]*[:：]?[ \\t]*${MOD}`, 'g'),
  new RegExp(`(?<!호[ \\t]*)\\([^()\\n]*?${MOD}[^()\\n]*\\)`, 'g')
]

/** 기획서 1쪽 글의 모듈 — 없거나, 한 꼴 안에서 둘 이상으로 갈리면 빈 글(짐작하지 않는다) */
export function moduleOnPage(text: string): string {
  for (const rule of RULES) {
    const got = new Set([...text.matchAll(rule)].map((m) => m[1] as string))
    if (got.size === 1) return [...got][0] as string
    if (got.size > 1) return ''
  }
  return ''
}

/** 모듈 폴더나 스펙이 있는 이름인가 — 없으면 기획서가 판(`M30_1`)을 적은 것이다 */
export function moduleKnown(forge: Forge, subject: string, module: string): boolean {
  return existsSync(forge.survey.moduleDir(subject, module)) || existsSync(forge.spec.specPath(subject, module))
}

// 그 학습코드 `_plan` 에 이미 놓인 기획서로 채우는 `fillFromPlans` 는 `planmodule.ts` 로 옮겼다(2026-10-14) — 기획서 읽기를 한 벌로

/** 채웠으면 한 줄, 채울 것이 아니면 빈 글 */
export async function fillFromPlan(forge: Forge, code: string, module: string, file: string): Promise<string> {
  if (!module) return ''
  const pick = forge.api.layoutFor(code)
  if (pick.ok) return ''
  const at = forge.layout.placementFor(code)
  if (at?.module && at.verdict !== '갈림') return ''
  if (!moduleKnown(forge, code.slice(0, 2), module)) return `기획서 모듈넘버 ${module}에 맞는 모듈 폴더가 없어 배치표에 넣지 않았습니다.`
  const [done] = await carryAnswers(
    code,
    [{ path: MODULE_PATH, value: module, carry: { why: `기획서 1쪽 모듈넘버 ${module} (${basename(file)})` } }],
    forge
  )
  if (!done) return ''
  if (!done.ok) return `배치표에 저장하지 못했습니다: ${done.note}`
  const spec = existsSync(forge.spec.specPath(code.slice(0, 2), module))
  return done.note + (spec ? '' : ` ${module} 모듈은 스펙이 없어 생성할 수 없습니다.`)
}
