/**
 * **원본을 떠 온 레시피에서 무엇이 바뀌었나를 도구가 센다** (2026-09-29, M3 · M4).
 *
 * 「AI 가 한 일」을 AI 의 말(얹었다는 자리 수)로 보이면, 얹었다가 뒤 걸음이 덮은 것 · 도구가 바꾼 것이
 * 섞여 안 맞는다. **시작 레시피와 최종 레시피를 맞대어** 센다 — 누가 바꿨든 바뀐 것은 바뀐 것이다.
 *
 * **줄마다 누가 바꿨나**는 답 파일의 `by` 로 가린다(M4). 답이 없는 자리는 도구가 바꾼 것이고, 옛 답(by 없음)은 「모름」이다.
 * **경로는 답 꼴 그대로다**(`quizData.a.b[2].c`) — 「원본으로」가 그 경로로 원본 값을 답해 되돌린다(`answer.ts` 가 받는 꼴).
 * 좌표 잎(`x`·`y`·`width`·`height`)은 상자 하나로 묶는다 — 칸 네 줄보다 상자 한 줄이 사람이 보는 단위다.
 *
 * 셈은 `lib/treediff.ts`, 여기는 갈래만 가른다. Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer, ChangeRow, RecipeChanges } from '../../../shared/forge'
import { leafDiff } from '../../lib/treediff'

type Recipe = { assets?: Record<string, { alias: string; file: string }[]>; gameData?: unknown }

const COORD = new Set(['x', 'y', 'width', 'height'])
/** 화면에 싣는 줄의 상한 — 넘으면 `truncated` 로 알린다 */
const ROWS_MAX = 600

/** `a.b[2].c` 의 마지막 마디를 뗀 부모와 그 마디 */
function split(path: string): { parent: string; last: string } {
  const m = /^(.*?)(?:\.([^.[\]]+)|\[(\d+)\])$/.exec(path)
  return m ? { parent: m[1], last: m[2] ?? m[3] } : { parent: '', last: path }
}

function valueIn(tree: unknown, path: string): unknown {
  let here = tree
  for (const chunk of path.split('.')) {
    const head = chunk.replace(/\[\d+\]/g, '')
    const keys: (string | number)[] = head ? [head] : []
    for (const m of chunk.matchAll(/\[(\d+)\]/g)) keys.push(Number(m[1]))
    for (const k of keys) {
      if (here === null || typeof here !== 'object') return undefined
      here = (here as Record<string | number, unknown>)[k]
    }
  }
  return here
}

/** `rest` — 답에 없는 바뀐 곳을 누구 것으로 볼까. 통째로 맡긴 레시피(`whole.ts`)면 AI 가 쓴 것이다 — 「도구」로 79줄이 찍혀 무엇을 AI 가 했는지 안 보였다 */
export function recipeChanges(start: unknown, final: unknown, root: string, answers: Answer[], rest: ChangeRow['by'] = 'tool'): RecipeChanges {
  const a = (start ?? {}) as Recipe
  const b = (final ?? {}) as Recipe
  // 「원본 값 그대로 n자리」 — 좌표는 빼고 센다(좌표는 figma 가 정본이라 따로 본다). 옛 창 screen.js markOrigin 이 명세
  const { leaves, truncated, same } = leafDiff(a.gameData, b.gameData, 5000, (p) => !COORD.has(split(p).last))
  const full = (p: string): string => (root ? `${root}.${p}` : p)
  // 답은 뿌리를 붙인 꼴(`quizData.set[0].label`)로도, 안 붙인 꼴(`[0].endScale` — 뿌리가 배열인 K36)로도 온다 — `answer.ts` `setAt` 이 둘 다 받는다.
  // 붙인 꼴로만 찾으면 배열 뿌리 모듈의 AI 답이 「도구」로 찍혔다(2026-10-02, KOL1M08W4S2 endScale 0.83). 둘 다 뗀 꼴로 맞댄다
  const bare = (p: string): string => (root && p.startsWith(`${root}.`) ? p.slice(root.length + 1) : p)
  const byPath = new Map(answers.map((x) => [bare(x.path), x]))
  const who = (path: string): ChangeRow['by'] => {
    const p = bare(path)
    const hit = byPath.get(p) ?? answers.find((x) => bare(x.path).startsWith(`${p}.`) || bare(x.path).startsWith(`${p}[`))
    return hit ? (hit.by ?? 'unknown') : rest
  }

  const rows: ChangeRow[] = []
  const boxes = new Map<string, ChangeRow>()
  for (const l of leaves) {
    const { parent, last } = split(l.path)
    if (COORD.has(last) && parent) {
      if (!boxes.has(parent)) {
        boxes.set(parent, { path: full(parent), before: valueIn(a.gameData, parent), after: valueIn(b.gameData, parent), by: who(full(parent)) })
      }
      continue
    }
    rows.push({ path: full(l.path), before: l.before, after: l.after, by: who(full(l.path)) })
  }

  const files = (r: Recipe): Map<string, string> =>
    new Map(Object.entries(r.assets ?? {}).flatMap(([k, list]) => list.map((x) => [`${k}.${x.alias}`, x.file] as const)))
  const was = files(a)
  const now = files(b)
  const cut = rows.length + boxes.size > ROWS_MAX
  return {
    values: rows.length,
    same,
    coords: boxes.size,
    rows: rows.slice(0, ROWS_MAX),
    boxes: [...boxes.values()].slice(0, Math.max(0, ROWS_MAX - rows.length)),
    added: [...now.keys()].filter((k) => !was.has(k)),
    removed: [...was.keys()].filter((k) => !now.has(k)),
    refiled: [...now.keys()].filter((k) => was.has(k) && was.get(k) !== now.get(k)),
    truncated: truncated || cut
  }
}
