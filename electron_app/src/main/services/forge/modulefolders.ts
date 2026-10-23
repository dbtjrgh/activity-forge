/**
 * **과목의 공용 모듈 폴더 목록** (2026-10-21, 누리) — 앞선 호가 없는 학습코드(배치표 판정 「없음」)의 모듈을 진행판에서 고를 목록.
 *
 * 1호 누리 L2 · L3 처럼 앞선 호 기록이 없는 학습코드는 후보가 0개라 고를 길이 없었다(진행판은 「모듈 못 정함」으로 셌다).
 * 거기에 공용 모듈 폴더(`sparkon_common/_common/module/<과목 폴더>/`)를 그대로 내놓는다.
 *
 * - **매번 폴더를 읽는다** — 다른 팀이 모듈 폴더(`N08`)를 더하면 코드를 안 고쳐도 목록에 나온다
 * - **폴더만 센다** — 과목 폴더에 같이 있는 낱개 파일(`index.ts`, 누리 `CornerAnchor.ts`)은 모듈이 아니다
 * - 배치표가 못 받는 이름의 폴더(`writeLayoutPick` 의 모듈 이름 꼴 밖)는 빼고, 뺐다고 알린다 — 조용히 사라지지 않게.
 *   그 이름 규칙은 forge `layoutwrite.ts` 의 `MODULE_NAME_RE` 한 곳이다(2026-10-21 — 여기 따로 적어 두던 것을 걷었다)
 * - 과목 폴더 자리와 국어 KO → KR 표는 forge `moduleDir` 한 곳이다 — 모듈 이름을 비우면 과목 폴더다(`regresspick.ts` 도 그렇게 쓴다)
 * - sparkLib 모듈(`VideoPlayer` 등)은 이 폴더에 없어 목록에도 없다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ModuleFolders } from '../../../shared/forge'
import { toErrorMessage, toMessage } from '../../lib/errors'
import { loadForge } from './runtime'

export async function moduleFolders(subject: string): Promise<ModuleFolders> {
  const out: ModuleFolders = { subject, dir: '', modules: [], skipped: [] }
  try {
    const forge = await loadForge()
    out.dir = forge.survey.moduleDir(subject, '')
    const dirs = readdirSync(out.dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() || (d.isSymbolicLink() && linkedDir(join(out.dir, d.name))))
      .map((d) => d.name)
      .sort()
    const name = forge.layout.MODULE_NAME_RE
    out.modules = dirs.filter((n) => name.test(n))
    out.skipped = dirs.filter((n) => !name.test(n) && !n.startsWith('.'))
  } catch (error) {
    // 폴더 자리를 정하기 전(양산기 폴더를 못 찾음)이면 그 까닭 그대로, 폴더를 못 읽었으면 한국어 파일 오류로
    out.error = out.dir ? toErrorMessage(error, `공용 모듈 폴더 ${out.dir}`) : toMessage(error)
  }
  return out
}

/** 정션 · 바로가기가 가리키는 것이 폴더인가 — 못 읽으면 아니다 */
function linkedDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
