/**
 * **호 저장소가 원격보다 몇 커밋 뒤처졌나** (2026-09-29, M7). 뒤처진 채 쓰면 남이 올린 것 위에 겹쳐 쓰게 된다.
 *
 * **받지 않는다(fetch 안 함).** 마지막으로 받아 둔 원격 가지(`@{u}`) 기준이다 — 받는 것은 남의 저장소를 바꾸는 일이라
 * 사람이 한다. 그래서 「마지막으로 받은 것 기준」이라고 같이 말한다. 못 물어보면 null(모름).
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { git } from '../../lib/git'

export async function behindOf(repo: string): Promise<{ behind: number | null; note: string }> {
  try {
    const n = Number((await git(repo, ['rev-list', '--count', 'HEAD..@{u}'], 10_000)).trim())
    const when = (await git(repo, ['log', '-1', '--format=%cr', '@{u}'], 10_000)).trim()
    if (!Number.isFinite(n)) return { behind: null, note: '원격과 비교하지 못했습니다.' }
    return {
      behind: n,
      note: n ? `원격보다 커밋 ${n}개가 뒤처져 있습니다. 호 저장소에서 먼저 받으세요. (${when} 기준)` : `원격과 같습니다. (${when} 기준)`
    }
  } catch {
    return { behind: null, note: '원격 브랜치가 없어 비교하지 못했습니다.' }
  }
}
