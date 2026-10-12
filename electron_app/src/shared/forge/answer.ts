/** 요구에 답하기 — 답 경로(`#module`·`#slot`·`#seen`·`#cells`)와 답 파일. 왜 모양을 여기 적는지는 `../forge.ts` 머리말. */

// ─── 요구에 답하기 (3단계 3-3 을 당겨 옴) ───────────────────────────────
//
// **요구만 하고 받을 자리가 없으면 반쪽입니다.** 사람이 답을 넣으면 그 값이
// 레시피에 들어가고 바로 다시 돌아야 합니다.
//
// **옛 화면의 폼 생성기는 그대로 못 씁니다.** 계획서는 「다시 쓰지 않고 그대로
// 쓴다」였는데, 실제로 열어 보니 `screen.js` 의 `renderField` 는 모듈 맨 위의
// 전역 `S`(화면 전체 상태)를 고치고 `renderGameData()`·`check()` 를 직접
// 부릅니다. 조각으로 떼어낼 수 있는 코드가 아니라 **그 화면 자체**입니다.
// 그래서 이렇게 갈랐습니다 —
//
//   모자란 칸 하나       앱이 작은 칸으로 받습니다 (아래 `AnswerShape`)
//   칸을 늘리고 줄이기   양산기 화면(forge-ui.bat)으로 넘깁니다. 위험한 자리는 옮겨 쓰지 않습니다
//   (배열 길이·posTable·variants)

/** 그 자리를 무엇으로 받아야 하나 */
export type AnswerShape =
  | 'figma' // 피그마 좌상단 x·y 와 너비·높이 네 칸
  | 'xy' // 화면 한가운데 기준 x·y 두 칸
  | 'number'
  | 'text'
  | 'pick' // 후보 가운데 고르기
  | 'none' // 앱이 받을 수 없는 것 (파일을 넣어야 하거나, forge-ui.bat 으로 가야 하거나)

/**
 * 배치표를 정하는 답의 `path`. 값 자리가 아니라 **차시 자체**를 정하는 것이라
 * 레시피 경로와 섞이면 안 된다. `#` 는 레시피 경로에 못 나오는 글자다.
 */
export const MODULE_PATH = '#module'

/**
 * **원본을 정하는 답**의 `path` (2026-10-02) — 값은 학습코드. 「figma 화면과 원본 장면이 다릅니다」 카드가 받는다.
 * 레시피에 남기지 않고 배치표에 적는다(`services/forge/originpick.ts`). 지금 원본을 고르면 그 카드를 확인한 것으로 닫는다
 */
export const ORIGIN_PATH = '#origin'

/**
 * **대사 성우 성별 답**의 `path` (2026-10-02) — `#voice|<학습코드>`, 값은 `여` · `남`. 이 학습코드이거나 대사를 가져올 앞 학습코드다.
 * 레시피가 아니라 스펙 `voices` 에 적는다(`services/forge/voice.ts`)
 */
export const VOICE_PREFIX = '#voice'

export function voicePath(code: string): string {
  return `${VOICE_PREFIX}|${code}`
}

/**
 * **자리를 새로 세우는 답**의 `path`. `#slot|<갈래>|<옛 별칭>` 이다.
 *
 * 값을 고치는 답이 아니라 **자리 이름 자체를 갈아치우는 답**이라, 레시피
 * 경로와 섞이면 `applyAnswers` 가 「자리를 못 찾았다」로 센다. `#` 는 레시피
 * 경로에 못 나오는 글자라 `MODULE_PATH` 와 같은 수를 쓴다.
 *
 * **갈래가 이름에 들어간다.** 한 별칭이 그림에도 소리에도 있다 — `skirt` 는
 * `fork.png` 로도 `SL_en_word_fork.mp3` 로도 간다. 갈래를 빼면 열두 자리가
 * 여섯으로 뭉개진다 (`forge/src/gen/restock.ts` 에서 실제로 그랬다).
 */
export const SLOT_PREFIX = '#slot'

export function slotPath(kind: string, alias: string): string {
  return `${SLOT_PREFIX}|${kind}|${alias}`
}

/**
 * **「확인했습니다」 한 번**을 남기는 답의 `path` — `#seen|<카드 id>`.
 *
 * 값으로 닫을 수 없는 카드(「사람이 봐야」)를 닫는 유일한 길이다. 글은 안 받는다.
 */
export const SEEN_PREFIX = '#seen'

export function seenPath(id: string): string {
  return `${SEEN_PREFIX}|${id}`
}

/**
 * **「이 자리는 N칸」** 답의 `path` — `#cells|<gameData 안의 배열 자리>` (2026-09-18).
 *
 * 값 자리가 아니라 **짜임을 바꾸는 답**이라 `#` 로 둔다. 값 답과 섞이면
 * `answer.ts` 가 그 배열 자리에 숫자를 넣어 버린다 — 배열이 통째로 숫자가 된다.
 */
export const CELLS_PREFIX = '#cells'

export function cellsPath(path: string): string {
  return `${CELLS_PREFIX}|${path}`
}

export function parseCellsPath(path: string): string | null {
  return path.startsWith(CELLS_PREFIX + '|') ? path.slice(CELLS_PREFIX.length + 1) : null
}

/**
 * **「이 자리는 빼지 마세요」** — `#keep|<갈래>|<별칭>` (2026-09-29, M3).
 *
 * 도구가 원본에만 있던 자리로 보고 뺀 것(`services/forge/originonly.ts`)을 사람이 되살리는 답이다.
 */
export const KEEP_PREFIX = '#keep'

export function keepPath(kind: string, alias: string): string {
  return `${KEEP_PREFIX}|${kind}|${alias}`
}

/** 꼴은 `#slot` 과 같다 — 가르는 셈도 그것 하나를 쓴다. */
export function parseKeepPath(path: string): { kind: string; alias: string } | null {
  return path.startsWith(KEEP_PREFIX + '|') ? parseSlotPath(SLOT_PREFIX + path.slice(KEEP_PREFIX.length)) : null
}

export function parseSlotPath(path: string): { kind: string; alias: string } | null {
  if (!path.startsWith(SLOT_PREFIX + '|')) return null
  const at = path.indexOf('|', SLOT_PREFIX.length + 1)
  if (at < 0) return null
  return { kind: path.slice(SLOT_PREFIX.length + 1, at), alias: path.slice(at + 1) }
}

/** 누가 답했나 (M4). 도구가 스스로 바꾼 것은 답 파일에 안 남으므로 `tool` 은 「AI 가 한 일」 쪽 셈에만 쓴다 */
export type AnswerBy = 'ai' | 'person' | 'tool'

/** 사람이 준 답 하나. `path` 는 요구 카드의 `where` 와 같다. */
export interface Answer {
  path: string
  value: unknown
  /** 누가 답했나 — 메인이 저장할 때 찍는다. **렌더러가 보낸 것은 안 믿는다**(2026-10-08 까지 `cleanAnswers` 가 버렸다 — 그 채널과 같이 걷었다). 옛 줄은 없다(모름) */
  by?: AnswerBy
  /**
   * 「이 모듈에서는 늘 이 값입니다」 — **다음 호부터 안 묻게 올린다** (5단계).
   *
   * 값 자리는 스펙의 `default` 로, 배치표(`#module`)는 `_layout` 으로 갑니다.
   * **까닭 없이는 안 올립니다.** 까닭이 없으면 나중에 「누가 왜 정했지」를
   * 다시 묻게 되고, 그것이 이 단계가 없애려는 것입니다.
   */
  carry?: { why: string }
}

/** 답 하나를 다음 호까지 남긴 결과. 못 남긴 것도 그대로 알린다. */
export interface Carried {
  path: string
  ok: boolean
  /** 어디에 남았나 — 스펙·배치표 파일 자리 */
  file: string
  /** 사람이 읽을 한 줄. 못 남겼으면 왜 못 남겼는지 */
  note: string
}

/**
 * 답을 남긴 자리. **레시피가 아니라 답만 남긴다.**
 *
 * 레시피를 통째로 남기면 리소스를 더 넣었을 때 맞추기(`swap`)가 다시 도는 길이
 * 막힌다. 답만 남기면 **매번 새로 클론·맞추기한 위에 답을 얹을** 수 있다.
 * 그리고 「무엇을 사람이 정했는지」가 글로 남는다 — 5단계가 요구하는 것이다.
 */
export interface AnswerFile {
  code: string
  answers: (Answer & { at: string })[]
}

// ─── 예외 메모는 없앴습니다 (2026-09-16) ────────────────────────────────
//
// 「값으로 못 채운 것을 글로 남기고 액티비티 옆 `_note.md` 로 내보낸다」를
// 5단계에 만들었다가 **통째로 걷어냈습니다.** 사용자 말 그대로 *「값 대신 글로
// 남기기 같은 쓸데없는 것들은 싹 없애, 메모는 진짜 필요없어」*.
//
// 그 자리가 하던 일 가운데 **하나만** 남깁니다 — 값으로 닫을 수 없는 카드를
// 닫는 것. 그것은 `Ask.done` 과 `#seen|<카드 id>` 답 한 줄이면 됩니다.
