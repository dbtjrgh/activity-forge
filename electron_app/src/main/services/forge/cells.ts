/**
 * **칸 수 맞추기** — 「이 자리는 N칸」이라는 답을 받아 배열을 늘리고 줄인다
 * (2026-09-18, 짜임에 길 내기).
 *
 * 원본을 베끼면 칸 수도 원본 것이 온다. 그런데 회차마다 이닝·장면 수가 다르다 —
 * **8호 76개 가운데 49개가 원본과 칸 수가 달랐다**(`forge/src/tool/cells.ts`).
 * 지금까지는 `shape.ts` 가 짚기만 하고 고치는 일은 옛 양산 창으로 넘겼다.
 *
 * **몇 칸이어야 하는지는 여기서 정하지 않는다.** 폴더 개수로 맞는 칸 수가 나온
 * 것은 53자리 중 17(32%)뿐이었다 — figma 화면이나 사람이 말해 줘야 한다. 여기는
 * **받은 칸 수로 짜임을 맞추기만** 한다. 값은 그 뒤 원래 길(맞추기·B단계·답)이 채운다.
 *
 * **칸들이 다 같은 꼴일 때만 한다.** 같은 꼴이면 늘릴 때는 마지막 칸을 떠서
 * 붙이고, 줄일 때는 꼬리를 자르면 짜임이 맞는다. 8호에서 그런 자리가 맨 윗단
 * 40/53, 칸 안의 칸 176/220 이었다. **꼴이 다르면 거절하고 까닭을 말한다** —
 * 장면마다 꼴이 다른 `sceneData` 에 아무 칸이나 떠 붙이면 조용히 엉뚱한 장면이 된다.
 *
 * **왜 옛 결정을 뒤집나** — `_document/양산계획.md` 3-3 이 「칸을 늘리고 줄이는
 * 것은 옛 양산 창으로」라고 정한 까닭은 **2000줄짜리 옛 폼 생성기를 옮겨 쓰는
 * 것이 위험**해서였다. 여기는 그것을 옮기지 않는다 — 같은 꼴 칸을 늘리고 줄이는
 * 것 하나만 하고, 만든 뒤에는 스펙 검산을 그대로 탄다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer } from '../../../shared/forge'
import { CELLS_PREFIX, parseCellsPath } from '../../../shared/forge'
import { applyAnswers, valueAt } from './answer'
import type { SpecRelation } from '@/gen/types'

/** 한 자리에 받는 칸 수 상한. 이보다 크면 잘못 적은 것이다. */
export const MAX_CELLS = 60

/**
 * 칸 하나의 **꼴** — 값은 버리고 열쇠와 타입만. 회차마다 낱말·좌표가 달라
 * 값으로 견주면 늘 「다르다」가 나온다(재 보니 273자리 중 251이 그랬다).
 */
function shapeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `[${v.length ? shapeOf(v[0]) : ''}]`
  if (typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${k}:${shapeOf((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return typeof v
}

/** 칸들이 **다 같은 꼴인가.** 칸이 하나 이하면 견줄 것이 없어 그렇다고 본다. */
export function uniform(arr: unknown[]): boolean {
  if (arr.length < 2) return true
  const one = shapeOf(arr[0])
  return arr.every((x) => shapeOf(x) === one)
}

export type Resize = { path: string; from: number; to: number }

/**
 * 한 자리를 N칸으로. 된 것과 **왜 안 됐는지**를 돌려준다.
 *
 * **자리를 새로 만들지 않는다.** 배열이 이미 있어야 한다 — 없는 자리를 만들면
 * 모듈이 안 읽는 곳에 값이 들어간다(`answer.ts` 의 `setAt` 과 같은 태도).
 */
export function resizeAt(
  recipe: unknown,
  path: string,
  want: number,
  gameDataRoot: string
): { ok: true; did: Resize } | { ok: false; why: string } {
  if (!Number.isInteger(want) || want < 1 || want > MAX_CELLS) {
    return { ok: false, why: `개수는 1~${MAX_CELLS} 사이의 정수여야 합니다 (${want}).` }
  }
  const arr = valueAt(recipe, path, gameDataRoot)
  if (!Array.isArray(arr)) return { ok: false, why: '배열 항목이 아닙니다.' }
  if (arr.length === 0) return { ok: false, why: '빈 배열이라 복제할 칸이 없습니다.' }
  if (!uniform(arr)) {
    return {
      ok: false,
      why: '칸마다 구조가 달라 어느 칸을 넣고 뺄지 정할 수 없습니다. 양산기 화면(forge-ui.bat)에서 고치세요.'
    }
  }

  const from = arr.length
  if (want < from) {
    // **꼬리를 자른다.** 칸이 같은 꼴이라 어느 칸을 빼도 짜임은 같고, 값은
    // 그 뒤에 이 회차 것으로 다시 채워진다.
    arr.splice(want)
  } else {
    // **마지막 칸을 떠서 붙인다.** 이어 붙인 칸의 값은 앞 칸 것 그대로라
    // 아직 이 회차 것이 아니다 — 맞추기·B단계·요구 카드가 그 자리를 본다.
    const last = arr[from - 1]
    for (let i = from; i < want; i++) arr.push(structuredClone(last))
  }
  return { ok: true, did: { path, from, to: want } }
}

/**
 * 받은 `#cells|…` 답을 **얕은 자리부터** 얹는다.
 *
 * **얕은 것이 먼저다.** `inningData` 를 6칸으로 늘린 뒤에야 `inningData[5].items`
 * 가 생긴다. 차례를 안 지키면 깊은 자리가 「없는 자리」로 물린다.
 */
export function applyCells(
  recipe: unknown,
  answers: Answer[],
  gameDataRoot: string,
  relations: SpecRelation[] = []
): { done: Resize[]; refused: { path: string; why: string }[]; synced: string[] } {
  const mine = answers
    .map((a) => ({ at: parseCellsPath(a.path), n: Number(a.value) }))
    .filter((x): x is { at: string; n: number } => x.at !== null)
    .sort((a, b) => depth(a.at) - depth(b.at))

  const done: Resize[] = []
  const refused: { path: string; why: string }[] = []
  for (const { at, n } of mine) {
    const got = resizeAt(recipe, at, n, gameDataRoot)
    if (got.ok) {
      // 이미 그 칸 수였으면 한 일이 없다. 「맞췄습니다」로 세지 않는다.
      if (got.did.from !== got.did.to) done.push(got.did)
    } else refused.push({ path: at, why: got.why })
  }
  return { done, refused, synced: syncCounts(recipe, done, relations, gameDataRoot) }
}

/**
 * **칸 수와 묶인 수 칸도 같이 맞춘다** (2026-09-23). MAL2M07W2S1 에서 정답표를
 * 3→5칸으로 늘리고 `Com_Inning.length` 는 3으로 두어 「이닝이 3인데 정답표는
 * 5칸」 카드가 났다 — 완성본은 5다. 어느 수가 어느 배열과 묶였는지는 스펙의
 * `sameCount` 관계(수는 그 수로 센다)가 안다. `each`·`when`·`zip`·`atLeast` 가
 * 붙은 것은 칸마다 뜻이 달라 안 건드린다.
 */
export function syncCounts(
  recipe: unknown,
  done: Resize[],
  relations: SpecRelation[],
  gameDataRoot: string
): string[] {
  const full = (p: string): string => (gameDataRoot ? `${gameDataRoot}.${p}` : p)
  const out: string[] = []
  for (const r of relations) {
    if (r.kind !== 'sameCount' || r.each || r.when || r.zip || r.atLeast) continue
    const d = done.find((x) => r.picks.some((p) => full(p) === x.path))
    if (!d) continue
    const nums = r.picks
      .map(full)
      .filter((p) => p !== d.path && typeof valueAt(recipe, p, gameDataRoot) === 'number')
    const put = applyAnswers(recipe, nums.map((path) => ({ path, value: d.to })), gameDataRoot)
    out.push(...nums.filter((p) => !put.missed.includes(p)).map((p) => `${p} → ${d.to}`))
  }
  return out
}

function depth(path: string): number {
  return (path.match(/\.|\[/g) ?? []).length
}

/** 이 답이 칸 수 답인가 — `assemble.ts` 가 값 답과 가를 때 쓴다. */
export function isCellsAnswer(a: Answer): boolean {
  return a.path.startsWith(CELLS_PREFIX + '|')
}
