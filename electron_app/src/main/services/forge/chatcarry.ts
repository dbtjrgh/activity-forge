/**
 * **대화가 원본에서 리소스 폴더로 가져오는 파일** (2026-10-14, `chatprep.ts` 에서 뗐다 — 떼기 전후 차례 같음).
 *
 * 대화를 시작할 때(`prepChat`)와 대화 도중 모듈이 바뀌어 원본이 바뀔 때(`chat.ts` · `chatresume.ts`)가 같은 차례를 쓴다.
 * 원본이 바뀌었으면 옛 원본에서 가져온 것부터 휴지통으로(`carrylog.ts`), 그다음 공용 · 돌려 쓰는 파일(`assemble.ts` ②.5 와 같은 빗장).
 * 9호 MAL3M08W4S1 은 M30 원본에서 가져온 그림 십여 개(tool-box.png 등)가 M30_3 으로 바꾼 뒤에도 남을 뻔했다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { logCarried, pruneCarried } from './carrylog'
import { carrySame } from './carryrsc'
import type { OriginPick } from './chatscene'
import { copyCommon } from './commonrsc'
import type { Forge } from './runtime'
import { pullCommonPlans } from './sortpaper'

type Cloned = Extract<ReturnType<Forge['api']['clone']>, { ok: true }>

/** 가져온 것 — 원본 레시피(리소스 표에 쓴다) · 휴지통으로 옮긴 옛 원본 파일 · 새로 가져온 파일. 원본을 못 읽으면 까닭 */
export async function carryFiles(
  forge: Forge,
  code: string,
  pick: OriginPick,
  rsc: string
): Promise<{ recipe: Cloned['recipe']; gone: string[]; took: string[] } | string> {
  const cloned = forge.api.clone(pick.origin, code)
  if (!cloned.ok) return cloned.error ?? '원본을 불러오지 못했습니다.'
  const root = forge.paths.REPO_ROOT
  const gone = await pruneCarried(root, code, pick.origin, rsc)
  const fresh = forge.commonfresh.freshPictures(pick.origin, rsc)
  const common = copyCommon(forge, pick.origin, code, pick.module, fresh)
  const carried = carrySame(forge, pick.origin, code, cloned.recipe, fresh)
  const took = [...common.took.map((t) => t.rel), ...carried.took]
  logCarried(root, code, pick.origin, rsc, took)
  pullCommonPlans(forge, code, pick.module)
  return { recipe: cloned.recipe, gone, took }
}
