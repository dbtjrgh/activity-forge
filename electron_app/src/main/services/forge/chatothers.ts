/**
 * **대화가 읽을 같은 모듈 완성본 고르기** (2026-10-13, `chatprep.ts` 에서 뗌).
 *
 * 전에는 원본 추천 차례(같은 칸 · 가까운 호)의 앞 다섯 곳이었다. 9호 MAL1M08W4S3(M01)은 그래서 같은 칸 L1 여섯 곳만 열렸고,
 * 기획서의 type2 · type3_2 를 만든 완성본(L2 · L3)은 하나도 못 봐 체크박스 · 스피커 · 숫자 그림을 사람에게 물었다.
 * 이제 차례는 셋이다 —
 * 1. figma 화면에 배경이 있는 완성본(`backdrop.ts` 가 남긴 점수) — 판이 같다
 * 2. 스펙 `variantKey` 의 값마다 그 값을 쓴 완성본 하나(forge `variants.ts` `coverValues`) — 원본에 없는 유형의 짜임 · 리소스
 * 3. 남은 자리는 추천 차례 그대로
 * **개발 완료만 연다**(`hallwalk.ts` `finishedAt`). `OTHERS_MAX` 를 넘어 못 덮은 값은 숨기지 않고 알린다.
 * 대화를 이을 때(`chatprep.ts` `ctxOf`)도 같은 셈을 한다 — 그새 완성본이 늘거나 figma 화면이 바뀌면 열리는 폴더가 달라질 수 있다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { SceneScore } from '../../../shared/forge'
import { finishedAt } from './hallwalk'
import type { Forge } from './runtime'

/** 같은 모듈 완성본을 몇 개까지 열어 주나 — 원본 하나에는 안 나오는 규칙을 본다(`whole.ts` 와 같은 까닭) */
const OTHERS_MAX = 5

export type Done = { code: string; act: string; rsc: string }

export const hallOf = (forge: Forge, code: string): string =>
  forge.paths.workPath(`sparkon_m${String(forge.spec.parseStudyCode(code)?.month ?? 0).padStart(2, '0')}`)

export const doneOf = (forge: Forge, code: string): Done => ({
  code,
  act: path.join(hallOf(forge, code), 'src', 'activity', code),
  rsc: forge.common.rscOfDone(code)
})

/** 모듈 안 유형(스펙 `variantKey`) 표 — 첫 지시에 싣는다. `open` 은 대화가 읽을 수 있는 완성본(원본 포함), `all` 은 그 값을 쓴 완성본 수 */
export type VariantView = {
  path: string
  note: string
  rows: { value: string; open: string[]; all: number }[]
  /** 열어 준 완성본 가운데 아무도 안 쓴 값 — 자리가 모자랐다 */
  missing: string[]
}

export type OthersPick = { others: Done[]; variants: VariantView | null }

/**
 * `ranked` 는 forge `originChoices` 의 후보 차례, `scores` 는 배경 점수(없으면 null).
 * 원본과 만들 학습코드는 뺀다. GameData 가 없거나 개발 완료가 아닌 것도 뺀다
 */
export function pickOthers(forge: Forge, code: string, module: string, origin: string, ranked: string[], scores: SceneScore[] | null): OthersPick {
  const pool = ranked
    .filter((c) => c !== origin && c !== code)
    .map((c) => doneOf(forge, c))
    .filter((d) => fs.existsSync(path.join(d.act, 'GameData.ts')) && finishedAt(d.act) === true)
  const codes = pool.map((d) => d.code)
  // 1. 배경이 figma 화면에 있는 것 — 후보 차례 그대로
  const picked = (scores ?? [])
    .filter((s) => codes.includes(s.code) && s.seen.some((x) => x.ratio >= forge.scenefind.HIT))
    .map((s) => s.code)
    .slice(0, OTHERS_MAX)
  // 2. 유형마다 하나
  const table = forge.variants.variantTable(code.slice(0, 2), module, [origin, ...codes].map((c) => ({ code: c, dir: doneOf(forge, c).act })))
  if (table) {
    const have = [origin, ...picked].flatMap((c) => table.byCode.get(c) ?? [])
    const cover = forge.variants.coverValues(codes.filter((c) => !picked.includes(c)), table.byCode, have, OTHERS_MAX - picked.length)
    picked.push(...cover.picked)
  }
  // 3. 남은 자리는 추천 차례
  for (const c of codes) if (picked.length < OTHERS_MAX && !picked.includes(c)) picked.push(c)
  const others = picked.map((c) => pool.find((d) => d.code === c) as Done)
  return { others, variants: table ? viewOf(table, [origin, ...picked]) : null }
}

function viewOf(table: { path: string; note: string; byCode: Map<string, string[]> }, open: string[]): VariantView {
  const values = [...new Set([...table.byCode.values()].flat())].sort()
  const rows = values.map((value) => ({
    value,
    open: open.filter((c) => table.byCode.get(c)?.includes(value)),
    all: [...table.byCode.values()].filter((v) => v.includes(value)).length
  }))
  return { path: table.path, note: table.note, rows, missing: rows.filter((r) => !r.open.length).map((r) => r.value) }
}
