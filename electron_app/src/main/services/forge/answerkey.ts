/**
 * **정답이 원본 것 그대로다** — 아무도 안 묻는 자리를 짚는다.
 *
 * 1단계 리허설에서 한 차시를 끝까지 돌렸더니 완성본과 19줄 달랐고, 그중 아홉이
 * **에러도 카드도 없이** 원본 값 그대로였다. 그래서 8호 완성본 103차시를 그
 * 원본과 자리별로 맞대 봤다 (`forge/src/tool/kept.ts`, AI 안 부른다) —
 *
 *   숫자·참거짓이 다른 차시 68 / 103  ·  자리 2,577개
 *   그중 자리·크기(x·y·width·height) 1,896자리는 figma 가 정본인 자리다
 *   **`correct` 는 22차시에 있고 그중 14차시에서 사람이 정답을 옮겼다**
 *
 * 마지막 줄이 이 파일의 까닭이다. 도구는 정답을 **정하지 않는다** — 원본 것을
 * 그대로 베낀다. 그런데 `exactly-one-correct` 는 **개수만** 본다(`resolve.ts`).
 * 그래서 정답이 딴 자리를 가리켜도 **개수는 1개라 통과하고, 빌드도 되고,
 * 화면도 멀쩡하다.** 틀린 답을 정답이라고 가르치는 액티비티가 조용히 나간다.
 *
 * **고치지 않는다 — 묻는다.** 이 회차의 정답이 무엇인지는 기획서와 리소스를
 * 봐야 알고, 그것은 사람의 일이다. 짚어서 카드 한 장으로 올리면 빗장 ⑤ 가
 * 붙잡으므로(`write.ts`), 사람이 보고 누르기 전에는 못 쓴다.
 *
 * **막는 검사로 만들지 않았다.** 8호 22차시 가운데 8차시는 사람도 원본 정답을
 * 그대로 뒀다 — 막았으면 그 여덟이 걸린다 (`forge/CLAUDE.md` 의 「막는 검사는
 * 표본 전부를 통과해야만 넣는다」).
 *
 * **차시마다 한 장이다.** 이닝마다 한 장씩 내면 네 장이 되는데, 사람이 하는
 * 일은 「띄워서 눌러 본다」 한 번이다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Ask } from '../../../shared/forge'

/**
 * 정답을 가리키는 열쇠 이름. **8호에서 실제로 쓰인 것만 적는다** —
 * 있을 법한 이름을 미리 적어 두면 엉뚱한 자리를 정답이라고 짚는다.
 *
 *   correct       `items[].correct: true`      M27 · M27_2 · M28 · ShowcaseQuiz · K34(`answer`)
 *   correctNum    `inningData[].correctNum: 1` M01 따위
 *   correctIndex  `inningData[].correctIndex`  K15
 *   answer        `key.consonant[].answer`     K34
 */
const NAMES = new Set(['correct', 'correctNum', 'correctIndex', 'answer'])

/**
 * 이름이 흔해서 위에 못 넣는 **정답 표 자리** (2026-09-28). M05 의 정답은 `M05_Answer.value`
 * (눌러야 할 단추 번호, M05_Answer.ts:92)인데 열쇠가 `value` 라 카드가 안 적었다 — 카드에는
 * 화면 그림 차례인 `M05_View.answer` 만 올라갔다. `value` 를 이름으로 넣으면 엉뚱한 자리를 짚는다.
 */
const TABLES = ['M05_Answer.value']

/** 너무 깊이 파지 않는다. 정답은 늘 위쪽에 있다. */
const MAX_DEPTH = 8

export interface AnswerLeaf {
  /** 칸 번호가 살아 있는 자리 — 이닝 1의 정답과 이닝 2의 정답은 다른 자리다 */
  path: string
  key: string
  value: boolean | number
}

/**
 * 정답 자리를 모은다.
 *
 * **참거짓과 숫자만 담는다.** `answer: "사과"` 처럼 글자인 자리는 정답 열쇠가
 * 아니라 낱말이고, 그것은 맞추기·자리 세우기가 이미 맡는다.
 */
export function answerLeaves(gameData: unknown): AnswerLeaf[] {
  const out: AnswerLeaf[] = []
  const walk = (v: unknown, at: string, key: string, depth: number): void => {
    if (depth > MAX_DEPTH) return
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${at}[${i}]`, key, depth + 1))
      return
    }
    if (v !== null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        walk(x, at ? `${at}.${k}` : k, k, depth + 1)
      }
      return
    }
    if (!NAMES.has(key) && !TABLES.some((t) => at.startsWith(`${t}[`))) return
    if (typeof v === 'boolean' || typeof v === 'number') out.push({ path: at, key, value: v })
  }
  walk(gameData, '', '', 0)
  return out
}

/**
 * 사람이 읽을 한 줄로 바꾼다.
 *
 * 참거짓은 **몇 번째가 정답인가**로 묶는다 — `items[0].correct: false` 를
 * 줄줄이 늘어놓으면 정작 볼 것(정답 자리)이 안 보인다.
 */
export function answerLines(leaves: AnswerLeaf[], root: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const leaf of leaves) {
    const head = root ? `${root}.` : ''
    if (typeof leaf.value === 'number') {
      out.push(`${head}${leaf.path} — 정답 ${leaf.value}`)
      continue
    }
    // 참거짓은 그 배열에서 참인 칸만 적는다.
    const m = /^(.*)\[(\d+)\]\.[A-Za-z_]+$/.exec(leaf.path)
    if (!m) {
      if (leaf.value) out.push(`${head}${leaf.path} — 정답`)
      continue
    }
    const arr = m[1] as string
    if (seen.has(arr) && !leaf.value) continue
    if (!leaf.value) continue
    seen.add(arr)
    out.push(`${head}${arr} — ${Number(m[2]) + 1}번째가 정답`)
  }
  return out
}

/**
 * 원본에서 그대로 온 정답이 있으면 카드 한 장.
 *
 * @param origin 원본을 떠 온 그대로의 값 (`api.clone` 의 recipe)
 * @param made   맞추기와 답까지 얹은 값 (지금 쓰려는 것)
 * @param root   `quizData` 처럼 GameData 가 내보내는 이름. 없으면 빈 글
 */
export function answerAsk(origin: unknown, made: unknown, root = ''): Ask | null {
  const mine = answerLeaves(made)
  if (!mine.length) return null

  const was = new Map(answerLeaves(origin).map((l) => [l.path, l.value]))
  // **한 자리라도 원본 그대로면 묻는다.** 사람이 이닝 하나만 고치고 나머지를
  // 그대로 둔 경우가 제일 위험하다 — 고친 자리가 있다고 카드를 거두면
  // 안 고친 자리가 확인 없이 나간다.
  const kept = mine.filter((l) => was.has(l.path) && was.get(l.path) === l.value)
  // **다 바뀌었어도 묻는다** (2026-09-28). 값 고치기 AI 가 기획서에서 정답을 읽어 바꾸게 했다
  // (`revisebrief.ts`) — 전에는 바뀌면 카드가 사라져, AI 가 고른 정답이 확인 없이 나갈 뻔했다.
  // 「정답은 사람이 닫는다」는 그대로다. 사람은 띄워서 눌러 보고 한 번 닫는다.
  if (!kept.length) {
    const lines = answerLines(mine, root)
    return {
      id: 'answer-key-changed',
      want: '사람이 봐야',
      title: 'AI 가 기획서대로 정답을 바꿨습니다.',
      where: root || '정답 항목',
      desc: '정답이 맞는지는 직접 눌러 봐야 알 수 있습니다.',
      give: '미리보기에서 정답을 눌러 보고 맞으면 「확인」을 누르세요.',
      options: [],
      shape: 'none',
      count: lines.length,
      items: lines,
      carry: false
    }
  }

  // **바꾼 칸도 같은 카드에 적는다** (2026-09-28). 전에는 원본 그대로인 칸만 적어서, MAL2M07W2S1 에서
  // AI 가 기획서를 보고 바꾼 13칸(3~5이닝이 완성본과 달랐다)이 **확인 없이** 나갈 뻔했다 — 카드에는
  // 안 바뀐 두 칸만 있었다. 사람이 눌러 볼 것은 정답표 전체다.
  const changed = mine.filter((l) => !kept.includes(l))
  const lines = [
    ...answerLines(changed, root).map((l) => `${l} (AI 가 바꿈)`),
    ...answerLines(kept, root).map((l) => (changed.length ? `${l} (원본 그대로)` : l))
  ]
  return {
    id: 'answer-key-from-origin',
    want: '사람이 봐야',
    title: changed.length
      ? `정답 ${changed.length}개는 기획서대로 바꿨고 ${kept.length}개는 원본 그대로입니다.`
      : '정답이 원본 그대로입니다. 이번에도 맞는지 확인하세요.',
    where: root || '정답 항목',
    desc: '정답이 틀려도 에러가 나지 않습니다.',
    // M4 — 고치는 길을 작업대 쪽으로. AI 가 바꾼 칸이 틀렸으면 「AI 가 한 일」의 그 줄을 되돌리면 되고,
    // 원본 그대로인 칸이 틀렸으면 기획서가 정본이라 기획서를 주고 다시 만든다(칸에 직접 치는 길은 forge-ui.bat 뿐)
    give:
      '미리보기에서 정답을 눌러 보고 맞으면 「확인」을 누르세요. 틀린 정답이 AI 가 바꾼 것이면 「AI 가 한 일」에서 「원본으로」를, ' +
      '원본 그대로인 것이면 기획서를 넣고 「다시 생성」을 누르세요.',
    options: [],
    shape: 'none',
    count: lines.length,
    items: lines,
    // 눈으로 보는 일은 호마다 다시 해야 한다. 「봤음」을 물려주면 안 본 다음
    // 호가 본 것이 된다 (`ask.ts` 의 「사람이 봐야」와 같은 까닭).
    carry: false
  }
}
