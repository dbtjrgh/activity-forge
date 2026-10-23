/**
 * **사내 공유 폴더에서 학습코드의 소리 · 애니메이션 · 영상이 있는 자리 — 규칙은 `sharerule*` 에만** (2026-10-14, 사용자 요청 —
 * 「기획서를 읽고 사운드랑 애니, 영상을 찾아서 가져다 놓는 식으로. 폴더가 체계적으로 분류돼 있으니 규칙을 정해 놓고」).
 * 공통 이름 규칙과 국어 · 수학 · 애니메이션 자리는 여기, 영어 자리는 `shareruleen.ts`(2026-10-23, 200줄을 넘어 뗐다), 누리 자리는 `sharerulenu.ts`(2026-10-23).
 *
 * 폴더를 통째로 훑지 않고 **학습코드로 그 자리를 바로 셈한다** — 수학 소리를 통째로 훑으면 8,299개에 19초였고,
 * 아래 자리만 보면 학습코드 하나에 0.5초 안쪽이다. AI 를 부르지 않는다. 공유 폴더 뿌리는 설정이 정한다(`root`, 기본은 `SHARE_DEFAULT`).
 * 재 본 것(호 저장소 완성본이 실제로 쓴 파일과 견줬다) —
 * - **소리** — 이름의 주인 학습코드 자리(`planreuse.ts` `homeOf`)에서 이름으로 찾는다.
 *   M08 완성본이 쓴 이 학습코드 몫 소리 846개 전부가 그 자리에 있었고 크기도 같았다.
 *   앞 호 소리를 다시 쓴 이름은 M05~M08 1,749개 가운데 1,718개가 그 이름 주인의 자리에 있었다(크기까지 같은 것 1,645개)
 *   - 국어 — `05. 사운드/01. 한글/{01. 효과음&BGM | 02. 성우 내레이션 음원}/<M>호/` 아래 전부. **폴더의 「N호」는 M 번호다**
 *     (9호=M08 은 「8호」 폴더, 그 안 파일이 `SL_ko_129…`). 안쪽 폴더 이름은 제각각이라 파일 이름으로 찾는다
 *   - 수학 — `05. 사운드/02. 수학/Level.<L>/MA-L<L>-M<MM>-W<W>-S<S>…` 학습코드마다 폴더(끝에 「(영상)」 같은 꼬리가 붙기도 한다)
 *   - 기획서가 적은 **다른 번호 이름**이 이 학습코드 폴더(`ownSoundDir`)에 있으면 받는다(2026-10-23, K1 · M4a — 국어 114개 / 16 학습코드, 수학 39개 / 6).
 *     수학 숫자 읽기 이름(`SL_ma_main_` · `inc_` · `sel_`)은 이 학습코드 폴더, 없으면 숫자 읽기 공통 폴더(`numberSpot`)에서 이름으로 찾는다(M2 — 1,521개 / 73)
 *   - 2026-10-23 에 다시 잼 — 개발 완료 국어 272 · 수학 322 학습코드에 완성본 소리 · 로티 이름을 기획서 이름처럼 주고 빈 리소스 폴더로 찾았다.
 *     완성본과 이름 · 크기가 같은 파일이 국어 7,888 → 8,428, 수학 5,345 → 8,411 개로 늘었고 줄어든 학습코드는 없었다
 *     (인터북 소리 1,420 · 숫자 읽기 1,583 · 다른 번호 이름 386 · 넓힌 로티 이름 193 · 줄표 번호 24). 기획서는 실제 것이 아니라 완성본 이름이다
 *   - 영어 — 기획서로 이름을 못 가른다(`plansound.ts`). 대신 **자리가 좁아 그 자리 소리 전부**를 고른다(자리는 `shareruleen.ts`, 고르기는 `shareen.ts`)
 * - **애니메이션 · 영상** — `{04. 애니메이션 | 06. 영상}/<과목>/Lv<L>/W<누적 주>/S<S>…` 아래 전부. 누적 주는 소리 이름과 같은 셈(M08 W2 → `W30`)
 *   M08 완성본 로티 385개 중 152개가 여기 있었고, 여기 있는데 완성본이 안 쓴 로티는 72칸에 1개였다(M01~M07 은 514칸에 301개 —
 *   옛 호일수록 안 쓴 판이 남아 있다). 못 찾은 것은 대개 앞 학습코드 로티를 그대로 다시 쓴 것이다(이름이 앞 학습코드) —
 *   기획서가 그 이름을 적었으면 그 학습코드 자리에서 찾는다(`planreuse.ts`). 그 아래 `sounds/` 소리는 `animatecc/sounds/` 로(`isMotionSound`)
 * - 영상은 두 가지가 같은 폴더에 있다. 앱이 따로 띄우는 안내 영상(`<학습코드>.mp4` · `.png`, `가이드영상/`)은 액티비티가 안 쓴다 — 뺀다.
 *   액티비티 영상은 `<학습코드>_ani[_v판].mp4` 이고 완성본은 `video.mp4` 로 둔다(수학 14개 중 13개가 크기까지 같았다) — 판이 여럿이면 높은 판(이 이름 규칙은 `sharevideo.ts`)
 * - **영어** — 학습코드 폴더 · 같은 칸 다른 호 폴더 · 활동 공통 폴더, 모듈에 따라 낱말 · 동요 · 스토리 · 말하기 영상 자리(`shareruleen.ts` 머리말)
 * - **누리** — 뿌리의 형제 폴더 `99. 누리과정` 의 그 호 · 레벨 내레이션 폴더, 이 학습코드 이름의 소리만(`sharerulenu.ts` 머리말). 영상 · 애니메이션은 모른다(`shareKnown`)
 *
 * 경로와 파일 이름만 셈한다 — 파일을 읽지 않는다. Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import type { ShareItem } from '../../../shared/forge'
import { weekNo } from './planreuse'
import { norm, stem } from './plansound'

/** 소리 파일 */
export const AUDIO = /\.(mp3|wav|ogg|m4a)$/i
/**
 * 소리 파일 이름의 SL_ 이름 — 뒤에 붙은 설명 · 끝 밑줄은 이름이 아니다. **바로 붙은 줄표 번호(`nar05-1`)는 이름이다**(2026-10-23) —
 * 떼면 `nar05` · `-1` · `-2` 가 한 이름이 되어 크기가 다른 세 파일로 보고 아무것도 안 골랐다. 공유 폴더에 이런 짝이 65개(국어 8 · 9호, 수학 M01, 영어)이고
 * 완성본도 그 이름으로 쓴다(KOL2M01W4S2 `nar06-1` · `-2`, ENL3M03W4S1 `nar14-2`)
 */
const SL_HEAD = /^SL_[A-Za-z0-9_]*[A-Za-z0-9](?:-\d+)*/i

/**
 * 가져와 둘 이름 — 폭 없는 글자를 떼고, 소리는 SL_ 이름 뒤의 꼬리를 뗀다. 공유 폴더 공용 소리가 `SL_ma_cor_sfx01​ (정답 공통) - 이닝 내 개별 정답 시.mp3`,
 * 완성본에 `SL_ko_305_s3_sfx01_.mp3` 처럼 온다(2026-10-15 — 꼬리째 가져오면 이름이 기획서와 안 맞고, 끝 밑줄 판을 「이미 있음」으로 못 알아봤다).
 * 빈칸 뒤 줄표(` - 이닝 내 …`)는 꼬리라 지금처럼 뗀다
 */
export function cleanName(file: string): string {
  const base = norm(path.basename(file))
  if (!AUDIO.test(base)) return base
  const ext = path.extname(base)
  const head = SL_HEAD.exec(base.slice(0, base.length - ext.length))?.[0]
  return head ? `${head}${ext}` : base
}

/** 같은 파일인지 보는 이름 — 다듬은 이름에서 소리는 확장자 빼고(mp3 · wav 가 섞여 온다), 나머지는 확장자째 */
export const keyOf = (file: string): string => (AUDIO.test(file) ? stem(cleanName(file)) : cleanName(file).toLowerCase())

/** 과목 → 공유 폴더의 과목 폴더 이름(영어 자리는 `shareruleen.ts` 가 같이 쓴다) */
export const SUBJECT: Record<string, string> = { KO: '01. 한글', MA: '02. 수학', EN: '03. 영어' }
const ALL: ShareItem['kind'][] = ['sound', 'lottie', 'video']
/**
 * 과목마다 자리 규칙이 있는 종류 — 없는 종류는 찾지 않고 모른다고 해야 0개가 「없음」으로 읽히지 않는다.
 * 누리(2026-10-23)는 내레이션만 안다 — 누리 영상은 파일 이름이 제목뿐이라 학습코드로 셈할 수 없고, 누리 전자책은 복사로 끝나지 않고,
 * 학습코드 로티 자리는 공유 폴더에 없다(`sharerulenu.ts` 머리말)
 */
const KINDS: Record<string, ShareItem['kind'][]> = { KO: ALL, MA: ALL, EN: ALL, NU: ['sound'] }
/** 자리 규칙이 있는 과목인가 — `kind` 를 주면 그 종류의 자리를 아는가 */
export const shareKnown = (subject: string, kind?: ShareItem['kind']): boolean => (kind ? (KINDS[subject] ?? []).includes(kind) : Boolean(KINDS[subject]?.length))

/** forge `parseStudyCode` 의 결과 가운데 쓰는 것 */
export type Study = { code: string; subject: string; level: number; month: number; week: number; session: number }

/**
 * 찾을 자리 하나 — `pick` 이 있으면 `base` 바로 아래 폴더 가운데 이름이 맞는 것들, 없으면 `base` 그 자체.
 * `within` 이 있으면 바로 아래가 아니라 **그 겹만큼 안** — `base` 아래로 `within` 에 맞는 폴더를 차례로 들어간 뒤 그 안에서 `pick` 을 찾는다
 * (하나면 한 겹, 배열이면 그 수만큼 — 영어 `내레이션/<MM>호`, 2026-10-23). `skip` 은 훑을 때 들어가지 않는 폴더 이름
 */
export type Spot = { base: string; pick?: RegExp; within?: RegExp | RegExp[]; skip?: RegExp }

/** 그 학습코드 이름의 소리가 있는 자리. 영어(`shareruleen.ts` `enSoundSpots`) · 모르는 과목은 빈 목록 */
export function soundSpots(root: string, s: Study): Spot[] {
  const subj = SUBJECT[s.subject]
  if (s.subject === 'KO') {
    const base = path.join(root, '05. 사운드', subj)
    return ['01. 효과음&BGM', '02. 성우 내레이션 음원'].map((d) => ({ base: path.join(base, d, `${s.month}호`) }))
  }
  if (s.subject === 'MA') {
    const head = `MA-L${s.level}-M${String(s.month).padStart(2, '0')}-W${s.week}-S${s.session}`
    return [{ base: path.join(root, '05. 사운드', subj, `Level.${s.level}`), pick: new RegExp(`^${head}(?!\\d)`, 'i') }]
  }
  return []
}

/** 국어 세션 폴더 — `[스파크온] 한글스파크_음원_Lv3_08호_3주_주제탐색(내레이션 & 효과음)`. 레벨이 둘인 `Lv2,3` 도 있다. 「N호」는 M 번호 */
const KO_SESSION = /_Lv(\d(?:,\d)*)_(\d\d)호_(\d)주_([^([]*?)\s*(?:[([]|$)/
/** 그 제목 → 세션(S) — 공유 폴더 파일 번호로 셌다(2026-10-19 전수 조사). 쓰기는 1 · 3주가 2, 2 · 4주가 3 이다 */
const KO_TITLE_S: Record<string, number> = { 주제탐색: 1, 낱말탐색: 1, 문장탐색: 1, 낱말경험: 1, 듣기: 2, 말하기: 2, 읽기: 3 }
const koTitleS = (title: string, week: number): number | undefined => (title === '쓰기' ? (week % 2 ? 2 : 3) : KO_TITLE_S[title])

/**
 * `soundSpots` 에서 찾은 소리(`rel` 은 그 자리에서부터)가 **이 학습코드 폴더** 것인가 — 수학은 자리가 곧 학습코드 폴더라 늘 참,
 * 국어는 호 폴더 아래 세션 폴더 이름의 레벨 · 호 · 주 · 제목으로 가린다(2026-10-23, K1). 9호 Lv3 3주 주제탐색 폴더는 소리가 다 Lv2 번호(`SL_ko_231_…`)라
 * 이 학습코드 번호 이름이 든 폴더로는 못 가린다
 */
export function ownSoundDir(rel: string, s: Study): boolean {
  if (s.subject !== 'KO') return s.subject === 'MA'
  return rel.split('/').slice(0, -1).some((seg) => {
    const m = KO_SESSION.exec(norm(seg))
    return Boolean(m && m[1].split(',').map(Number).includes(s.level) && Number(m[2]) === s.month && Number(m[3]) === s.week && koTitleS(m[4], s.week) === s.session)
  })
}

/** 수학 숫자 읽기 공통 폴더 둘(`02. 수학 공통_메인 캐릭터 …` · `03. 수학 공통_성인 여성 …`, 2026-10-23 M2b) — 200개 남짓이라 이름으로만 찾는다(폴더째는 학습코드마다 대부분 안 쓴다) */
export const numberSpot = (root: string): Spot => ({ base: path.join(root, '05. 사운드', SUBJECT.MA), pick: /숫자 읽기 내레이션/ })

/** 그 학습코드의 애니메이션 · 영상이 있는 자리 — 세션 폴더는 `S1`, `S1 주제탐색` 처럼 꼬리가 붙는다. `tops` 로 둘 중 하나만 볼 수 있다 */
export function motionSpots(root: string, s: Study, tops = ['04. 애니메이션', '06. 영상']): Spot[] {
  const subj = SUBJECT[s.subject]
  if (!subj) return []
  const week = `W${weekNo(s.month, s.week)}`
  return tops.map((top) => ({
    base: path.join(root, top, subj, `Lv${s.level}`, week),
    pick: new RegExp(`^S${s.session}(?!\\d)`, 'i')
  }))
}

/** 공용 소리 — 고르지 않는다(국어 · 수학과 같이 대화를 시작할 때 원본에서 가져온다). 영어 학습코드 폴더의 `효과음, BGM` 에 같이 들어 있다 */
export const isCommonSound = (file: string): boolean => /^SL_[a-z]{2}_(?:com|cor|quiz)_/i.test(cleanName(file))

/**
 * 애니메이션 세션 폴더 안의 소리(`sounds/` · `인터북/sounds/`, 2026-10-23 M1) — 인터북이 부르는 소리라 완성본은 `animatecc/sounds/<이름>` 에 둔다
 * (수학 Lv2 · Lv3 M01 · M02 · M05 만 있다). 공용은 뺀다. **이름은 꼬리를 떼지 않는다** — 인터북은 파일 이름을 그대로 부른다(`SL_ma_315_s1_nar12_.mp3`
 * 하나만 꼬리가 있고 완성본도 그 이름이다)
 */
export const isMotionSound = (rel: string): boolean => AUDIO.test(rel) && /(^|\/)sounds\//i.test(rel) && !isCommonSound(rel)
export const MOTION_SOUND_DIR = 'animatecc/sounds/'
export const motionSoundTo = (rel: string): string => `${MOTION_SOUND_DIR}${norm(path.basename(rel))}`

/** 화면에 보일 짧은 자리 — 공유 폴더 앞머리를 뗀다 */
export const shortOf = (abs: string, root: string): string => (abs.startsWith(root) ? abs.slice(root.length).replace(/^[\\/]+/, '') : abs)
