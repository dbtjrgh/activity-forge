/**
 * 값의 자리(`quizData.inningData[1].items[0].popup`)를 **스펙 나무에서** 찾는다.
 *
 * 두 곳이 쓴다 — 요구 카드가 그 자리의 설명·모양을 가져올 때(`ask.ts`), 그리고
 * 「다음 호에도 같습니다」로 기본값을 올릴 때(`carry.ts`). **한 곳에 둔다.**
 * 마디를 세는 셈이 두 벌이 되면 「보여준 자리와 올린 자리가 다르다」가 되고,
 * 그것은 다음 호에 가서야 드러난다.
 *
 * 값 쪽 자리 셈(`recipe` 안을 걷는 것)은 `answer.ts` 가 한다. 여기는 **스펙**
 * 나무만 걷는다 — 둘은 짜임이 다르다. 레시피는 칸마다 값이 있고, 스펙은
 * 칸 하나의 모양(`of`)만 한 벌 적어 둔다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Spec, SpecField } from '@/gen/types'

/**
 * 스펙에서 그 자리의 필드를 찾는다.
 *
 * 뿌리 이름(`spec.gameData.root`)을 떼고 마디를 따라 내려간다. `[n]` 은
 * 배열의 칸이라 `of` 로, 번호로 늘어나는 열쇠(`c1`·`c2`)는 `series.of` 로.
 * **못 찾으면 null 이다** — 못 찾은 것을 아무 필드로 대신하지 않는다.
 */
export function fieldAt(spec: Spec, path: string): SpecField | null {
  const root = spec.gameData?.root
  let rest = path
  if (root && (rest === root || rest.startsWith(root + '.') || rest.startsWith(root + '['))) {
    rest = rest.slice(root.length).replace(/^\./, '')
  }
  if (!rest) return null

  // **뿌리 자신이 배열인 스펙이 있다.** `WordSparkLv1` 의 `quizData` 가 그렇다 —
  // `kind: "array"` 이고 칸 하나의 모양은 `fields` 가 아니라 `of` 에 적혀 있다.
  // 그래서 자리 이름이 `quizData[0].wheel.image` 로 오는데, 위에서 뿌리를 떼면
  // `[0].wheel.image` 가 남아 첫 마디의 열쇠가 **빈 글자**가 된다. 그대로 두면
  // 그런 모듈은 스펙에서 자리를 **하나도** 못 찾는다 — 설명도 갈래도 못
  // 가져오고, 그런데도 오류는 안 난다(그냥 「모르는 자리」가 된다).
  // 2026-09-15 에 자리 세우기가 갈래를 못 가리는 것으로 드러났다.
  let here: SpecField[] = spec.gameData?.fields ?? []
  let owner: SpecField | null = null
  let found: SpecField | null = null
  if (/^\[\d+\]/.test(rest)) {
    const item = spec.gameData?.of ?? null
    if (!item) return null
    rest = rest.replace(/^\[\d+\]\.?/, '')
    if (!rest) return item
    here = item.fields ?? []
    owner = item
    found = item
  }

  for (const raw of rest.split('.')) {
    const key = raw.replace(/\[\d+\]/g, '')
    const indexed = raw !== key
    if (!key) return null

    let next: SpecField | null = here.find((f) => f.key === key) ?? null
    // 번호로 늘어나는 열쇠 — `cards.c3` 의 c3. 앞 마디가 그 주인이다.
    const series = owner?.series
    if (!next && series && key.startsWith(series.prefix)) next = series.of
    if (!next) return null

    // 배열 칸을 가리켰으면(`items[0]`) 그 칸의 모양으로 내려간다.
    const inner: SpecField = indexed && next.of ? next.of : next
    found = inner
    owner = inner
    here = inner.fields ?? inner.of?.fields ?? []
  }
  return found
}

/**
 * 이 자리의 답을 **스펙에 올려도 되나**.
 *
 * 스펙의 `default` 는 그 모듈을 쓰는 **모든 호·모든 칸**에 걸린다. 그러니
 * 「이 차시의 이 칸에서만 맞는 값」을 올리면 다음 호가 조용히 틀린다.
 * 짐작해서 올리느니 다음 호에 한 번 더 묻는 편이 낫다.
 *
 *   배열 칸(`items[2]`)  칸마다 값이 다른 것이 보통이다 — 안 올린다
 *   리소스 파일 이름     호마다 다르다 — 안 올린다 (`assets.` 로 시작한다)
 *   스펙에 없는 자리     올릴 데가 없다
 */
export function carryable(spec: Spec | null, path: string): boolean {
  if (!spec) return false
  if (path.startsWith('assets.')) return false
  if (/\[\d+\]/.test(path)) return false
  return fieldAt(spec, path) !== null
}
