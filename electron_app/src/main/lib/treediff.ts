/**
 * JSON 나무 두 그루를 **잎 단위로** 견준다. 양산을 모른다 — 경로와 앞뒤 값만 낸다.
 *
 * 배열은 번호로, 객체는 열쇠로 맞댄다. 한쪽에만 있는 가지는 **가지 통째로 한 줄**(`undefined` ↔ 값)이다.
 * 잎이 많을 수 있으니 부르는 쪽이 상한을 준다 — 넘으면 `truncated` 로 알린다.
 * **같은 잎은 세기만 한다** — `sameIf` 가 참인 경로만. 목록으로 내면 수천 줄이다.
 */

export type Leaf = { path: string; before: unknown; after: unknown }

const isTree = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'

export function leafDiff(
  a: unknown,
  b: unknown,
  max = 5000,
  sameIf: (path: string) => boolean = () => false
): { leaves: Leaf[]; truncated: boolean; same: number } {
  const leaves: Leaf[] = []
  let truncated = false
  let same = 0
  const walk = (x: unknown, y: unknown, at: string): void => {
    if (truncated) return
    if (isTree(x) && isTree(y) && Array.isArray(x) === Array.isArray(y)) {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        walk(x[k], y[k], Array.isArray(x) ? `${at}[${k}]` : at ? `${at}.${k}` : k)
      }
      return
    }
    if (JSON.stringify(x) === JSON.stringify(y)) {
      if (x !== undefined && sameIf(at)) same += 1
      return
    }
    if (leaves.length >= max) {
      truncated = true
      return
    }
    leaves.push({ path: at, before: x, after: y })
  }
  walk(a, b, '')
  return { leaves, truncated, same }
}
