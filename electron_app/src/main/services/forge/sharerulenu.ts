/**
 * **누리(NU) 공유 폴더 자리 — 자리 규칙은 `sharerule*` 에만** (2026-10-23, 사용자 말 — 「공유폴더 누리쪽도 가져오기 해놓으면 좋은데」).
 *
 * 누리 폴더는 공유 폴더 뿌리(`04. 콘텐츠`) 아래가 아니라 **그 옆**(`\\…\share\99. 누리과정`)이다 — 뿌리 아래에서 찾으면 0 이다.
 * 뿌리를 설정에서 바꿨으면 그 뿌리의 옆에서 찾는다. 그 폴더가 없으면 부르는 쪽이 「위치를 모릅니다」로 막는다(`sharefetch.ts`) —
 * 훑기(`sharefind.ts`)는 없는 폴더를 빈 것으로 읽어서, 막지 않으면 0 이 「없음」으로 보인다.
 * 재 본 것(2026-10-23, 1호 L1 개발 완료 11개와 만드는 중 1개의 리소스 366개를 공유 폴더 파일과 바이트까지 맞댐) —
 * - **내레이션만** 학습코드 자리가 있다 — `04. 사운드/02. 내레이션 음원/<M>호/Lv.<L>/NU_L<L>_M<MM>_W<W>_S<S>_narNN.mp3`.
 *   「N호」는 M 번호이고(1~3호 401개 전부 폴더와 이름의 호 · 레벨이 같았다) 폴더 이름에 0 을 안 붙인다. 레벨 폴더 안에 하위 폴더는 없다.
 *   완성본 7개 학습코드가 쓴 이 학습코드 이름 내레이션 34개가 다 여기 같은 이름으로 있었고(만드는 중 W3S3 까지 35/35),
 *   이 학습코드 이름으로 거르면 그 자리에서 안 쓴 것이 0개였다. 폴더째 고르면 같은 레벨 다른 학습코드 7개 것이 섞인다
 * - `공통/` · `프로토/` 는 안 본다 — 완성본이 공용 소리 이름을 바꿔 쓰고(`bgm.mp3` ← `NU_com_bgm_02(…)`), 프로토에는 같은 이름의 다른 판이 8개 있다
 * - 모르는 것(`sharerule.ts` `shareKnown`) — 누리 영상(N07)은 파일 이름이 제목뿐이라 학습코드로 자리를 셈할 수 없다(바이트로 맞은 것 3개 중 2개).
 *   누리 전자책(NU_ebook)은 그림을 webp 로 바꾸고 소리를 잘라야 해 복사로 끝나지 않는다. 학습코드 로티 자리는 공유 폴더에 없다(공용 3개뿐)
 *
 * 경로와 파일 이름만 셈한다 — 파일을 읽지 않는다. Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import { norm } from './plansound'
import { AUDIO, type Spot, type Study } from './sharerule'

/** 누리 공유 폴더 — 설정 뿌리의 형제 폴더. UNC 뿌리의 끝 빗금이 있든 없든, 공유 맨 위를 뿌리로 두었든 같은 자리다(재 봄) */
export const nuRootOf = (root: string): string => path.join(path.dirname(path.resolve(root)), '99. 누리과정')

/**
 * 학습코드 자리 규칙이 없는 누리 모듈 — 누리 전자책(책). 그림을 webp 로 바꾸고 소리를 잘라야 해 복사로 끝나지 않는다(위 머리말).
 * 제 내레이션도 없어 그대로 두면 「없음 0개」로만 보인다 — 부르는 쪽이 모른다고 한다(`sharefetch.ts`)
 */
export const nuNoSpot = (module: string): boolean => module === 'NU_ebook'

/** 누리 학습코드의 내레이션 자리 — `<M>호/Lv.<L>` 한 폴더. 누리가 아니면 null */
export function nuSoundSpot(nuRoot: string, s: Study): Spot | null {
  if (s.subject !== 'NU') return null
  return { base: path.join(nuRoot, '04. 사운드', '02. 내레이션 음원', `${s.month}호`, `Lv.${s.level}`) }
}

/** 이 학습코드 이름의 내레이션인가 — `NU_L1_M01_W1_S2_nar01.mp3`. 폭 없는 글자가 붙은 이름(`nar01​.mp3`)도 뗀 뒤 본다 */
export function isNuOwn(rel: string, s: Study): boolean {
  const head = `NU_L${s.level}_M${String(s.month).padStart(2, '0')}_W${s.week}_S${s.session}_`.toUpperCase()
  return AUDIO.test(rel) && norm(path.basename(rel)).toUpperCase().startsWith(head)
}
