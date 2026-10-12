/**
 * **호 저장소 리소스 자리(`public/sparklab/<코드>`)에 있는 것과 AssetTable 이 부르는 것** — 셈은 여기 하나 (2026-10-12).
 *
 * 대화 뒤 「없는 파일」 검사(`chatfinish.ts`, 부르는데 없는 것)와 「안 쓰는 리소스」(`pubextra.ts`, 있는데 안 부르는 것)가 같이 쓴다.
 * 둘이 따로 세면 한쪽은 `animation/` 을, 다른 쪽은 `animations/` 를 보게 된다(함정 — 완성본 로티 폴더).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Forge } from './runtime'

/** 그 자리의 파일 전부 — 대소문자 그대로, `/` 로 */
export function listPub(dir: string): string[] {
  try {
    return (fs.readdirSync(dir, { recursive: true, withFileTypes: true }) as fs.Dirent[])
      .filter((e) => e.isFile())
      .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
  } catch {
    return []
  }
}

/** AssetTable 의 로티 경로 상수가 가리키는 폴더 — 주석 줄은 안 본다. 못 찾으면 null */
function aniDir(act: string): string | null {
  let text = ''
  try {
    text = fs.readFileSync(path.join(act, 'AssetTable.ts'), 'utf8')
  } catch {
    return null
  }
  const live = text.split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n')
  return /\/sparklab\/\$\{\w+\}\/(animations?)\b/.exec(live)?.[1] ?? null
}

/** AssetTable 이 부르는 파일(그 자리 안 경로). 레시피는 늘 `animations/` 로 읽으므로 AssetTable 의 로티 폴더로 고친다 */
export function wantOf(forge: Forge, recipe: unknown, act: string): string[] {
  const ani = aniDir(act)
  return [...new Set(forge.common.relOf(recipe as Parameters<Forge['common']['relOf']>[0]).values())].map((r) =>
    ani && r.startsWith('animations/') ? `${ani}/${r.slice('animations/'.length)}` : r
  )
}
