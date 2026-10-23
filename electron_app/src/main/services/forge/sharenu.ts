/**
 * **누리 — 공유 폴더에서 무엇을 가져올지 고르기** (2026-10-23, `sharefetch.ts` 가 부른다. 자리는 `sharerulenu.ts`).
 *
 * 누리 기획서는 공유 폴더에 없다(`01. 기획` 이 비어 있다). 대신 내레이션 이름이 학습코드를 통째로 든다(`NU_L1_M01_W1_S2_nar01.mp3`) —
 * 그 레벨 폴더에서 **이 학습코드 이름으로 시작하는 소리만** 이름 그대로 `sounds/` 에 고른다(완성본 34개가 다 그 자리 그 이름이었다).
 * - 제 내레이션이 없는 학습코드(S1 의 누리 영상 · 누리 전자책)는 0 이 맞다 — 「못 찾음」을 띄우지 않는다
 * - 같은 이름이 크기가 다르게 여럿이면 고르지 않고, 리소스 폴더나 호 저장소에 같은 이름이 있으면 안 가져온다(`sharepick.ts` `putEach`)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import { empty, listAll, putEach, type Ctx, type Picked } from './sharepick'
import { isNuOwn, nuSoundSpot } from './sharerulenu'

/** 누리 학습코드의 내레이션 — `nuRoot` 는 누리 공유 폴더(`nuRootOf`). 비었거나 누리가 아니면 빈 것 */
export async function pickNuSounds(c: Ctx, nuRoot: string): Promise<Picked> {
  const out = empty()
  const s = nuRoot ? c.forge.spec.parseStudyCode(c.code) : null
  const spot = s ? nuSoundSpot(nuRoot, s) : null
  if (!s || !spot) return out
  const seen = await listAll(c, [spot], (h) => isNuOwn(h.rel, s))
  // 화면에 보일 자리는 누리 폴더부터 — 설정 뿌리(`04. 콘텐츠`) 밖이라 그 앞머리로는 안 떼어진다
  putEach({ ...c, root: path.dirname(nuRoot) }, out, seen.hits, 'sound')
  return out
}
