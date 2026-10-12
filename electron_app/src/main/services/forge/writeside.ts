/**
 * **쓰기 곁에서 하는 셋** — 끝 표시 지키기 · 쓰는 리소스 파일 셈 · 측정 한 줄. `write.ts` 가 224줄이 되어 갈랐다
 * (2026-09-30, 동작 변화 없음). Electron 을 import 하지 않는다(services 규칙).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mark } from './measure'
import { loadForge } from './runtime'

/**
 * 그 자리 `activityInfo.json` 의 `devFinished` 를 레시피에 얹는다. 못 읽으면 그대로 둔다.
 * **끝난 자리면 날짜 · 만든 사람까지 지킨다** (M7) — 「끝」(`done.ts`) 뒤에 다시 만들어 쓰면 원본(앞 회차)의 날짜와
 * 이름이 돌아와, 끝났다는 표시는 남는데 누가 언제 끝냈는지가 틀려진다.
 */
export function keepFinished(dir: string, recipe: { info?: Record<string, unknown> & { devFinished?: boolean } }): void {
  try {
    const was = JSON.parse(readFileSync(join(dir, 'activityInfo.json'), 'utf8')) as Record<string, unknown>
    if (typeof was.devFinished !== 'boolean') return
    recipe.info = { ...recipe.info, devFinished: was.devFinished }
    if (was.devFinished) {
      for (const k of ['finishedDate', 'developer', 'devTeam']) if (typeof was[k] === 'string' && was[k]) recipe.info[k] = was[k]
    }
  } catch {
    // 없거나 깨졌으면 여느 때처럼 원본 값으로 쓴다
  }
}

/** 레시피가 쓰는 리소스 파일(폴더 안 경로, 소문자). 셈은 forge `common.relOf` 하나다. */
export function usedFiles(forge: Awaited<ReturnType<typeof loadForge>>, recipe: unknown): Set<string> {
  const rels = forge.common.relOf(recipe as Parameters<typeof forge.common.relOf>[0])
  return new Set([...rels.values()].map((r) => r.toLowerCase()))
}

/** 측정에 한 줄. **재다가 쓰기를 넘어뜨리지 않는다** — 못 적으면 안 적는다. */
export async function markWrite(code: string, what: string): Promise<void> {
  try {
    const forge = await loadForge()
    mark(forge.paths.REPO_ROOT, code, what)
  } catch {
    // forge 를 못 불러도 아래에서 같은 까닭으로 막힌다.
  }
}
