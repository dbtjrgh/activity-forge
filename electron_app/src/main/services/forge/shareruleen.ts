/**
 * **사내 공유 폴더에서 영어 학습코드의 소리 · 영상이 있는 자리** — 자리 규칙은 `sharerule*` 에만 둔다(공통과 국어 · 수학은 `sharerule.ts`, 고르기는 `shareen.ts`).
 * 2026-10-23 에 영어 자리가 늘어 `sharerule.ts` 가 200줄을 넘어 뗐다 — 옮긴 규칙은 동작 변화 없음.
 *
 * 영어 기획서는 소리 이름을 가르지 못한다(`plansound.ts`). 대신 **자리가 좁아 그 자리 소리 전부**를 고른다(2026-10-15).
 * 재 본 것(호 저장소 완성본이 실제로 쓴 파일과 견줬다. 10-23 에 더한 것은 10-19 공유 폴더 목록 · 해시와 m01~m08 · m11 개발 완료 완성본으로) —
 * - 학습코드 폴더 `05. 사운드/03. 영어/Level.<L>/EN-L<L>-M<MM>-W<W>-S<S>` — **다른 학습코드 폴더 안에 들어간 것이 있다**
 *   (`Level.1/EN-L1-M02-W1-S1/EN-L1-M08-W1-S1`). 그래서 한 겹 안까지 같은 이름을 찾고, 그 폴더 안의 다른 학습코드 · 다른 호 폴더는 안 들어간다
 * - 같은 칸(W · S) 다른 호 폴더 안의 그 호 폴더 — `<MM>호 단어 음원` 은 07호 넷(L1 W3S2 · L2 W1S1 · L2 W1S3 · L3 W1S1)이 8호 완성본과 바이트까지 같았다.
 *   10-23 에 `<MM>호` 와 `내레이션/` 아래 한 겹까지 넓혔다 — 새로 집는 73개(ENL2M04W3S3 · ENL3M04W3S3 의 `04호`, ENL3M07W1S3 · ENL3M07W3S2 의
 *   `내레이션/07호 단어 음원`)가 다 완성본과 같았고, 안 쓴 것은 ENL2M07W3S2 의 낱말 넷(L2 폴더에 든 L3 낱말)이다
 * - 활동 공통 폴더 `<활동 공통>/<활동>/Level.<L>/<MM>호` — 칸 짝은 `EN_ACTIVITY`(재 본 것은 그 위).
 *   Showcase Speak 칸(W4S1)은 그 Level 의 `내레이션` · `효과음, BGM` 도 본다(10-23). L1 · L2 는 공용 이름(`SL_en_com_`)뿐이라 실제로 고르는 것은
 *   Level.3 열한 개다 — L3 W4S1 완성본 넷 가운데 M05~M07 셋이 열한 개를 다 썼고(`sounds/sfx/` 에 둔 것도 있다) 방학호(M11) 하나는 안 썼다.
 *   그래서 방학호(호 표의 「(방학)」)에서는 이 Level 공통 자리를 열지 않는다
 * - **낱말 모듈**(`WORD_MODULES`, 10-23)은 Showcase Write 의 그 호 폴더와 `Level.<L>/00. 단어 음원/<MM>호` 도 본다 — 7호부터 영어 낱말 소리는
 *   Showcase Write · quiz · Speak 호 폴더에 있고 `00. 단어 음원` 은 06호까지뿐이다. 배치표 모듈을 아는 학습코드로 재면 Showcase Write(W4S2 밖)는
 *   자리 안 212개 중 191개를 34개 학습코드 완성본이 썼고, `00. 단어 음원` 은 640개 중 561개를 96개 학습코드가 썼다(공용 · 빈칸 이름은 뺐다)
 * - CreateSong 모듈(동요) — 반주 `MR 음원/<MM>. <제목> (MR).mp3` 를 `mr.mp3` 로(10-19, M01~M05 · M07 여섯 개가 바이트까지 같음, Level.1 · 3 에는 그 폴더가 없다),
 *   그 Level 의 `내레이션`(10-23, 완성본 27개 중 21개가 썼고 L1 M03~M05 와 방학호 셋은 안 썼다 — 방학호 다섯 가운데 둘은 써서 방학호에서도 연다. L3 `효과음, BGM` 의 `sfx02` 는 완성본이 하나도 안 써서 안 본다),
 *   동요 영상 · MR 영상 `06. 영상/03. 영어/Lv<L>/00. 동요 & 동요 MR영상 (로고 제거)/{00. 동요 영상 | 00. MR 영상}/<MM>. <제목>[ (MR)].mp4` 를
 *   `video.mp4` · `mr.mp4` 로(10-23, M01~M08 완성본 22개가 둘 다 바이트까지 같았다. 방학호(M11)는 앞 호 것을 다시 써 11번 파일이 없다)
 * - 스토리 영상 `06. 영상/03. 영어/Lv<L>/00. 스토리 영상 …/lv<L>_<MM>_<제목>.mp4` — VideoPlayer 모듈만, `video.mp4` 로.
 *   5 · 7 · 8호(M05~M07) W1S2 의 video.mp4 아홉 개가 다 바이트까지 같았다
 * - 말하기 AI 영상(2026-10-19) — `06. 영상/03. 영어/Lv<L>/02. Showcase Speak AI 영상/<MM>. <제목>/L<L>M<MM>W4S1_video_NN.mp4`. ShowcaseSpeakLv2 모듈만,
 *   이름 그대로 `images/` 로(`speakSpot`). 9호 2841 영상 여섯 개가 손으로 찾은 것과 같았다
 * 10-23 에 더한 자리를 다 넣고 영어 개발 완료 301개를 리소스 폴더가 빈 것처럼 다시 찾으면(지금 공유 폴더) 완성본과 이름 · 크기가 같은 파일이
 * 1,344개에서 1,991개로 늘고, 완성본에 없는 파일은 274개에서 367개로 는다. 9호 ENL3M08W3S1 은 완성본의 아홉 개(손으로 넣은 낱말 여섯 · 두 영상과 내레이션)를 다 골랐고 sha256 까지 같았다.
 * 영상 · 소리 이름에는 U+200B 가 섞여 온다 — 앞머리로만 고른다. 공유 폴더의 `02호.lnk` 같은 바로가기는 따라가지 않는다(폴더가 아니라 파일로 읽힌다).
 *
 * 경로와 파일 이름만 셈한다 — 파일을 읽지 않는다. Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import { isVacation } from '../../../shared/forge'
import { norm } from './plansound'
import { SUBJECT, type Spot, type Study } from './sharerule'

const EN = SUBJECT.EN
const EN_COMMON = '01. 영어 공통 활동 영어 내레이션, 효과음'
const SONG_ACT = '05. 영어 공통_Create Song'
const pad = (n: number): string => String(n).padStart(2, '0')

/** 영어 학습코드 폴더 이름 — `EN-L1-M08-W1-S1`, 줄표 없는 `ENL3M05W3S2` 도 있다. 호를 안 주면 아무 호 */
const enDir = (s: Study, month?: number): RegExp =>
  new RegExp(`^EN-?L${s.level}-?M${month === undefined ? '\\d\\d' : pad(month)}-?W${s.week}-?S${s.session}(?!\\d)`, 'i')

/**
 * 영어 활동 공통 폴더 ↔ 칸. 07호 폴더 파일을 8호(M07) 완성본 sounds 와 이름 · 바이트로 대 봤다(03~06호도 같은 짝) —
 * Explore Story · Quiz · Make 와 Showcase Speak · quiz 는 L1~L3 모두 그 칸 하나에만 전부 맞았다(Make L3 의 `326_s1_nar01` 은 W2S3 완성본도 썼다).
 * Showcase Write 의 낱말 6개(L3 4개)는 W1S1 · W1S3 · W3S2 · W4S2 · W4S3 에 다 있어 바이트로는 못 가른다 — 공용 뺀 소리가 **이 폴더 것뿐인** 칸이
 * 07호 L1~L3 · 03호 L1 모두 W4S2 하나이고(다른 칸은 이 폴더에 없는 소리가 1~9개 더 있다) 배치표 모듈도 ShowcaseWrite 라 W4S2 로 둔다.
 * 다른 칸은 낱말 모듈일 때만 연다(`WORD_MODULES`).
 * 넣지 않은 것 — Story Spark(호 폴더가 없고 공용 하나), Create Song(L1 · L2 에 호 폴더가 없다 — 반주 · 내레이션만 모듈로).
 * 이름의 번호는 칸을 못 가린다 — 8호 W4S1 L2 완성본이 `SL_en_227_s1_…`(W3 번호)을 썼다. 그래서 이름으로 거르지 않는다.
 * 사람이 잘못 둔 폴더도 있었다 — 06호 Explore Make L3 에 W2S2 파일(`322_s2_…`)이 그대로 들어 있다.
 * 9호(08호) Explore Story L3 에는 `SL_en_330_s3_…` 이 들어 있어 W2S1 로 가는 것이 맞는지 아직 모른다(2026-10-15)
 */
const EN_ACTIVITY: Record<string, string> = {
  W2S1: '02. 영어 공통_Explore Story',
  W2S2: '03. 영어 공통_Explore Quiz',
  W2S3: '04. 영어 공통_Explore Make',
  W4S1: '06. 영어 공통_Showcase Speak',
  W4S2: '07. 영어 공통_Showcase Write',
  W4S3: '08. 영어 공통_Showcase quiz'
}

/** 스토리 영상을 쓰는 모듈 — 제 소리가 없다(M05~M07 완성본이 공용 소리만 쓴다) */
export const STORY_MODULE = 'VideoPlayer'
/** 동요 모듈 — 반주를 리소스 폴더 맨 위 `mr.mp3` 로 쓴다(완성본 AssetTable `{ alias: 'video_mp3', src: `${RscPath}/mr.mp3` }`) */
export const SONG_MODULE = 'CreateSong'
export const MR_NAME = 'mr.mp3'
/** 동요 MR 영상 — 완성본 AssetTable `{ alias: 'video_mr', src: `${RscPath}/mr.mp4` }`(동요 영상은 `video.mp4`) */
export const MR_FILM = 'mr.mp4'

/**
 * 낱말 모듈 — 그 호 낱말 소리를 쓴다. 2026-10-19 전수 조사에서 `00. 단어 음원` 을 쓴 완성본의 모듈 23개를 그대로 옮겼다.
 * 이 목록에 없는 모듈(E25 · E28 · E33 같은 새 모듈)은 근거가 없어 열지 않는다 — 쓴 완성본이 생기면 다시 잰다.
 * CreateSong 은 Lv3 만이다 — L1 · L2 완성본 12개는 두 자리 낱말 109개를 하나도 안 썼고, L3 은 44개를 썼다(안 쓴 것 8개)
 */
const WORD_MODULES = new Set(['WordSparkLv1', 'WordSparkLv3M2', 'CreateWordLv2', 'PlaySparkLv2M2', 'GameMap', 'ShowcaseQuiz', 'ShowcaseWriteLv1', 'ShowcaseWriteLv2', 'ShowcaseWriteLv3', SONG_MODULE, 'E05', 'E06', 'E07', 'E09', 'E10', 'E17', 'E30', 'E31', 'E32', 'E35', 'E36', 'E37', 'E37_1'])
const wordModule = (s: Study, module: string): boolean => WORD_MODULES.has(module) && (module !== SONG_MODULE || s.level === 3)

/**
 * 영어 학습코드의 소리 자리 — 학습코드 폴더(바로 아래 · 한 겹 안) · 같은 칸 다른 호 폴더 안의 그 호 폴더 · 활동 공통 폴더, 모듈에 따라 더(머리말).
 * 학습코드 폴더 먼저(같은 이름이면 앞 것). `module` 은 배치표가 정한 모듈 — 비면 모듈로 여는 자리는 안 본다
 */
export function enSoundSpots(root: string, s: Study, module: string): Spot[] {
  if (s.subject !== 'EN') return []
  const sound = path.join(root, '05. 사운드', EN)
  const level = path.join(sound, `Level.${s.level}`)
  const lv = `Level.${s.level}`
  const mm = pad(s.month)
  const mine = enDir(s, s.month)
  // 학습코드 폴더 안에 다른 학습코드 폴더 · 다른 호 폴더(`09호 단어 음원`)가 같이 들어 있다 — 그것은 그 학습코드 것이다
  const skip = new RegExp(`^(?:EN-?L\\d-?M\\d\\d-?W\\d-?S\\d|(?!${mm}호)\\d\\d호)`, 'i')
  const issue = new RegExp(`^${mm}호(?:\\s*단어\\s*음원)?$`)
  const spots: Spot[] = [
    { base: level, pick: mine, skip },
    { base: level, within: /./, pick: mine, skip },
    { base: level, within: enDir(s), pick: issue },
    { base: level, within: [enDir(s), /^내레이션$/], pick: issue }
  ]
  const act = EN_ACTIVITY[`W${s.week}S${s.session}`]
  const common = (name: string, ...rest: string[]): string => path.join(sound, EN_COMMON, name, lv, ...rest)
  if (act) spots.push({ base: common(act, `${mm}호`) })
  // 말하기 칸의 Level 공통 자리는 방학호에서 안 연다 — ENL3M11W4S1 완성본은 열한 개를 하나도 안 썼다. 같은 칸 M05~M07 은 다 써서 모듈로는 못 가른다.
  // 동요 내레이션은 방학호에서도 연다 — 방학호 CreateSong 다섯 가운데 둘(ENL3M11W1S1 · W3S2)이 썼고 셋이 안 썼다(2026-10-23 검산)
  if (act === EN_ACTIVITY.W4S1 && !isVacation(mm)) spots.push({ base: common(act), pick: /^(?:내레이션|효과음.*|bgm.*)$/i })
  if (module === SONG_MODULE) spots.push({ base: common(SONG_ACT, '내레이션') })
  if (wordModule(s, module)) {
    if (act !== EN_ACTIVITY.W4S2) spots.push({ base: common(EN_ACTIVITY.W4S2, `${mm}호`) })
    spots.push({ base: level, within: /^\d+\.\s*단어\s*음원$/, pick: new RegExp(`^${mm}호$`) })
  }
  return spots
}

/** 이름에 빈칸이 든 꼬리(`SL_en_word_arms _g.mp3`) — 다듬으면 `_g` 가 떨어져 목소리 판이 맨 이름으로 들어간다. 고르지 않는다 */
export const hasGap = (file: string): boolean => /\s_/.test(norm(path.basename(file)))

/**
 * 맨 판이 있어 뺄 목소리 판인가 — `x_b` · `x_g` 는 `x` 가, `x_b_slow` 는 `x_slow` 가 있으면 뺀다(`keys` 는 `keyOf` 꼴).
 * `x_slow` 는 안 뺀다 — 느린 판은 짝으로 쓴다(5호 ShowcaseSpeak 완성본이 `x` 와 `x_slow` 를, 8호가 `x_b` 와 `x_b_slow` 를 같이 썼다)
 */
export function voiceTwin(key: string, keys: Set<string>): boolean {
  const bare = key.replace(/_[bg](?=(?:_slow)?$)/, '')
  return bare !== key && keys.has(bare)
}

/** 영어 스토리 영상 자리 — VideoPlayer 모듈일 때만(CreateSong 도 영상을 쓰지만 동요 영상이다, `songFilmSpot`) */
export function storySpot(root: string, s: Study, module: string): Spot | null {
  if (s.subject !== 'EN' || module !== STORY_MODULE) return null
  return { base: path.join(root, '06. 영상', EN, `Lv${s.level}`), pick: /스토리\s*영상/ }
}

/** 그 호 스토리 영상인가 — `lv1_08_Instruments​​.mp4`(폭 없는 글자를 떼고 앞머리로) */
export const isStoryFilm = (file: string, s: Study): boolean =>
  new RegExp(`^lv${s.level}_${pad(s.month)}_.*\\.mp4$`, 'i').test(norm(path.basename(file)))

/** 영어 동요 반주 자리 — CreateSong 모듈일 때만. Create Song 폴더의 그 Level 에서 `MR 음원` 폴더만 들어간다(Level.1 · 3 은 없어 빈 목록) */
export function songSpot(root: string, s: Study, module: string): Spot | null {
  if (s.subject !== 'EN' || module !== SONG_MODULE) return null
  return { base: path.join(root, '05. 사운드', EN, EN_COMMON), within: /create\s*song/i, pick: new RegExp(`^Level\\.?\\s*${s.level}\\s*$`, 'i'), skip: /^(?!MR\s*음원\s*$)/i }
}

/** 그 호 반주인가 — `MR 음원/08. Dancing Animals (MR).mp3`. 앞 번호가 M 번호다(「N호」 폴더와 같다) */
export const isSongMr = (rel: string, s: Study): boolean => new RegExp(`^MR\\s*음원\\s*/${pad(s.month)}\\.\\s[^/]*\\(MR\\)[^/]*\\.mp3$`, 'i').test(norm(rel))

/** 영어 동요 영상 자리(2026-10-23) — CreateSong 모듈일 때만. `06. 영상/03. 영어/Lv<L>/00. 동요 & 동요 MR영상 (로고 제거)/` 아래 둘(`isSongFilm`) */
export function songFilmSpot(root: string, s: Study, module: string): Spot | null {
  if (s.subject !== 'EN' || module !== SONG_MODULE) return null
  return { base: path.join(root, '06. 영상', EN, `Lv${s.level}`), pick: /동요/ }
}

/** 그 호 동요 영상(`mr` 면 MR 영상)인가 — `00. 동요 영상/08. I have a Fever.mp4` · `00. MR 영상/08. I have a Fever (MR).mp4`. 앞 번호가 M 번호다 */
export const isSongFilm = (rel: string, s: Study, mr: boolean): boolean =>
  new RegExp(`^[^/]*${mr ? 'MR' : '동요'}\\s*영상/${pad(s.month)}\\.[^/]*\\.mp4$`, 'i').test(norm(rel))

/** 말하기 모듈(Lv2) — Lv1 · 3 의 ShowcaseSpeak 은 AI 영상을 안 쓴다. AI 아이 영상을 `images/` 에 공유 폴더 이름 그대로 쓴다(6호 · 7호 완성본 `images/L2M07W4S1_video_01.mp4`) */
export const SPEAK_MODULE = 'ShowcaseSpeakLv2'

/** 영어 말하기 AI 영상 자리(2026-10-19) — `06. 영상/03. 영어/Lv<L>/02. Showcase Speak AI 영상/<MM>. <제목>/`. 지금은 Lv2 에만 있다 */
export function speakSpot(root: string, s: Study, module: string): Spot | null {
  if (s.subject !== 'EN' || module !== SPEAK_MODULE) return null
  return { base: path.join(root, '06. 영상', EN, `Lv${s.level}`), within: /showcase\s*speak/i, pick: new RegExp(`^${pad(s.month)}\\.`) }
}

/** 그 학습코드 AI 영상인가 — 학습코드에서 EN 을 뗀 이름으로 시작한다(`L2M08W4S1_video_01.mp4`) */
export const isSpeakVideo = (rel: string, code: string): boolean =>
  new RegExp(`^${code.replace(/^EN/i, '')}_video_\\d+\\.mp4$`, 'i').test(norm(path.basename(rel)))
