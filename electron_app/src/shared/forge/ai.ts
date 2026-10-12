/** AI 짝 맞추기 · B단계 · 이름과 차례 · 짜임. 왜 모양을 여기 적는지는 `../forge.ts` 머리말. */

// ─── AI 짝 맞추기 (6단계) ───────────────────────────────────────────────
//
// 남은 일이 **뜻으로 맞추는 일**입니다 — `answer_bear` ↔ `item_bear_24.png`.
// 이름이 회차마다 통째로 바뀌어 규칙으로는 못 풉니다(8호 76개 중 59개가 여기서
// 막혔습니다). `claude -p` 를 그대로 쓰므로 **쓰던 계정에 API 키도 따로 과금도
// 없습니다.**
//
// **받은 답을 믿지 않습니다.** AI 는 빈칸을 싫어해서 억지로 채웁니다. 폴더에
// 실제로 있는 파일인지 · 겹쳐 쓰지 않았는지 · 갈래가 맞는지를 기계가 다시 봅니다.

/** AI 가 낸 짝 하나. `why` 는 예외 메모로 같이 남습니다 */
export interface MatchPair {
  alias: string
  file: string
  why: string
}

export interface MatchResult {
  code: string
  /** AI 를 실제로 불렀나. `claude` 가 없으면 false 이고 `brief` 만 옵니다 */
  ran: boolean
  /** AI 에게 준 글 그대로. 못 불렀으면 사람이 이것을 붙여넣습니다 */
  brief: string
  /** 브리프가 대략 몇 토큰인지 (글자 수로 센 어림) */
  tokens: number
  /** 부르고 받는 데 걸린 시간(ms) */
  took: number
  /** 검산을 통과해 실제로 얹은 짝 */
  taken: MatchPair[]
  /** 물린 줄과 왜 물렸는지 — 숨기지 않습니다 */
  refused: { alias: string; file: string; why: string }[]
  /**
   * **AI 가 「모르겠다」고 한 자리** (2026-09-21). 파일 자리에 `?` 를 쓰고
   * 무엇이 있으면 알겠는지 적은 줄입니다. 그대로 사람에게 갈 물음이 됩니다 —
   * 전에는 못 고른 자리가 **아무 데도 안 남아** 왜 못 했는지 알 길이 없었습니다.
   */
  unsure: { kind: string; alias: string; why: string }[]
  /** 물어본 자리 수 */
  slots: number
  /** 사람이 읽을 한 줄 */
  note: string
  error: string
  /**
   * 짜임이 원본과 다른 자리 (6단계). **맞추기와 같이 묻습니다** — 둘 다 원본을
   * 베낀 데서 오는 문제라 한 번에 보는 편이 낫습니다.
   *
   * **에러가 안 나는 갈래라 제일 위험합니다.** 칸 수가 달라도 생성기는
   * 통과시킵니다 — `ENL1M07W3S1` 은 에러 0 으로 통과하고도 자막 한 쌍이 빠진
   * 채 나왔습니다.
   */
  shape?: ShapeRunResult
  /**
   * **이름과 차례를 정한 것** — 자리 세우기의 앞단. 이 회차에 없어질 낱말
   * 자리에 폴더의 어느 파일이 오는지를, figma 화면을 같이 보고 정한다.
   *
   * 맞추기와 다른 물음이라 따로 담는다 — 저쪽은 「이 이름의 자리에 맞는
   * 파일」이고 이쪽은 **「없어질 자리를 무엇으로 갈아치우나」**다.
   */
  order?: OrderRunResult
}

/** 아직 아무것도 안 한 맞추기 결과 — `match.ts` 와 `ipc/resource.ts`(학습코드가 틀렸을 때)가 같이 쓴다 */
export const emptyMatch = (code: string, error = ''): MatchResult => ({
  code,
  ran: false,
  brief: '',
  tokens: 0,
  took: 0,
  taken: [],
  refused: [],
  unsure: [],
  slots: 0,
  note: '',
  error
})

/**
 * **앞 회차 것이 그대로 남은 자리를 고친 결과** (B단계, `revise.ts`).
 *
 * `MatchResult` 와 다른 물음이다 — 저쪽은 「못 맞춘 자리」를 채우고, 이쪽은
 * **「맞췄지만 이 회차 것이 아닌 자리」**를 갈아 끼운다. 에러도 카드도 안 나는
 * 자리라 결과를 화면이 그대로 보여 줘야 사람이 무엇이 바뀌었는지 안다.
 */
export interface ReviseResult {
  ran: boolean
  /** AI 에게 준 글 그대로. 못 불렀으면 사람이 이것을 붙여넣는다 */
  brief: string
  /**
   * **AI 가 실제로 본 figma 화면.** 없으면 빈 글.
   *
   * 이것이 있어야 고리가 닫힌다 — 「모르겠다」 카드를 보고 스샷을 붙여넣으면
   * 다음 판에서 AI 가 그 그림을 보고 답한다. 없던 시절에는 스샷을 넣어도
   * 같은 「모르겠다」가 또 났다.
   */
  shot: string
  tokens: number
  took: number
  /** 검산을 통과해 실제로 얹은 자리 수 */
  taken: number
  /** 물린 줄과 왜 물렸는지 — 숨기지 않는다 */
  refused: string[]
  /**
   * **AI 가 「모르겠다」고 말한 자리.**
   *
   * 전에는 브리프가 「확신이 없으면 그 줄을 아예 쓰지 않는다」고만 했다.
   * 그래서 AI 가 모를 때 **아무 말 없이 빠졌고**, 에러도 카드도 안 나서
   * 원본에서 베껴 온 값이 그대로 나갔다. 이제 말하게 하고, 그 말을 카드로
   * 바꿔 **사람에게 figma 스샷이나 기획서를 달라고 한다.**
   */
  unsure: { kind: string; alias: string; why: string }[]
  error: string
}

/** 자리 하나를 무엇으로 세웠나 */
export interface OrderPick {
  alias: string
  kind: string
  file: string
  /** 원본에서 몇 번째 칸이었나 */
  inning: number | null
  why: string
}

export interface OrderRunResult {
  /** AI 를 실제로 불렀나 */
  ran: boolean
  /** 보고 정한 figma 화면. 없으면 빈 글 — 그때는 이름만 보고 정한 것이다 */
  shot: string
  brief: string
  took: number
  taken: OrderPick[]
  refused: { file: string; name: string; why: string }[]
  /**
   * 차례 검산 한 줄. **비어 있어야 받은 것이다** — 번호가 겹치거나 빠지면
   * 그 갈래는 통째로 물린다. 한 자리만 틀려도 나머지가 한 칸씩 밀린다.
   */
  orderNote: string
  note: string
  error: string
}

/** 짚은 자리 하나. 요구 카드가 되어 실제 쓰기를 막습니다 */
export interface ShapeFinding {
  /** 값 안의 자리 — `quizData.chapter_b2g[1].subtitle` */
  where: string
  /** 베껴 온 칸 수 */
  now: number
  /** 이 회차는 몇 칸이어야 하나 */
  should: number
  /** 왜 그렇게 봤나 */
  why: string
}

/** 폴더의 파일을 이름 무리로 묶어 센 것. AI 가 칸 수를 가늠하는 실마리 */
export interface ShapeFile {
  family: string
  n: number
}

export interface ShapeRunResult {
  ran: boolean
  brief: string
  /** 보게 한 figma 화면(`_figma/…`). 없었으면 빈 글 — 그때는 폴더 개수만 본 것이다 */
  shot: string
  tokens: number
  took: number
  taken: ShapeFinding[]
  refused: { where: string; why: string }[]
  note: string
  error: string
}
