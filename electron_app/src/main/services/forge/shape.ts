/**
 * **짜임이 원본과 다른 자리를 AI 가 짚게 한다** (6단계).
 *
 * 맞추기(`brief.ts`)가 푸는 것은 「어느 파일이 어느 자리냐」다. 그런데 그것을
 * 다 맞춰도 남는 것이 있다 — **회차마다 걸음 수와 칸 수가 다르다.**
 *
 *   `ENL1M07W3S1`  원본은 자막 15칸인데 이 회차 폴더엔 13쌍뿐이다
 *   `ENL2M07W3S1`  원본에 있는 「캐릭터 고르기」 걸음이 이 회차엔 없다
 *
 * **이것이 제일 위험한 갈래다.** 맞추기는 안 맞으면 에러가 나서 막히기라도
 * 하는데, 칸 수가 다른 것은 **에러 없이 통과한다.** 앞서 `ENL1M07W3S1` 은
 * 에러 0 · 「혼자만 다른 것」까지 통과하고도 자막 한 쌍이 빠진 채 나왔다.
 * 화면은 전부 초록이었다.
 *
 * **실마리는 폴더와 figma 화면에 있다.** 폴더의 이름 무리 개수로 칸 수를
 * 짐작한다 — 자막이 15칸인데 `subtitle#_n.png` 가 13개면 13칸. 다만 8호에서
 * 폴더 개수가 칸 수와 그대로 맞는 자리는 0/53 이었다(기계 셈으로는).
 * 그런데 AI 는 파일 이름(`pos.3` 같은 것)까지 읽어, 폴더만 보고도 35자리 중 23을
 * 칸 수까지 맞혔다. 그래서 화면이 있으면 화면을, 없으면 폴더를 보게 한다.
 *
 * **여기서는 짚기만 한다. 고치는 것은 `cells.ts` 다** (2026-09-18). 칸들이 같은
 * 꼴인 자리는 카드가 칸 수를 숫자로 받고, 도구가 늘리고 줄인다. 꼴이 다른
 * 자리는 양산기 화면(forge-ui.bat)으로 간다. 어느 쪽이든 카드가 남아 있는 동안은
 * 5단계 빗장 ⑤ 가 붙잡는다.
 *
 * **폴더 개수가 칸 수를 말해 준다는 위 전제는 셋 중 하나만 맞았다** — 8호에서
 * 맨 윗단 53자리 중 17(32%). 그래서 AI 가 짚은 칸 수를 **그대로 얹지 않고**
 * 카드로 올린다. 사람이 figma 에서 세어 적는다.
 *
 * **AI 에게 주고받는 글(브리프·검산)은 `shapebrief.ts` 에 있다.** 여기는
 * 카드 · 묻는 흐름뿐이다. 짚은 것을 남기고 읽는 것은 `shapestore.ts`.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer, Ask, ShapeFinding, ShapeRunResult } from '../../../shared/forge'
import { cellsPath, parseCellsPath } from '../../../shared/forge'
import { valueAt } from './answer'
import { uniform } from './cells'
import { askAi } from './ai'
import { saveReply } from './reply'
import { shotNote } from './shot'
import { roughTokens } from './brief'
import { arrayRows, checkShape, fileFamilies, readShape, shapeBrief } from './shapebrief'

/**
 * 짚은 것을 **요구 카드**로.
 *
 * **칸들이 같은 꼴이면 칸 수를 숫자로 받는다** (2026-09-18). 답은
 * `#cells|<자리>` 로 남고 `cells.ts` 가 늘리고 줄인다 — 8호에서 칸 수가 다른
 * 자리의 맨 윗단 40/53 이 그런 자리였다. 꼴이 다르면 여태처럼 `none` 이고
 * 양산기 화면(forge-ui.bat)으로 간다 — 어느 칸을 넣고 뺄지 도구가 모른다.
 *
 * **그 자리에 칸 수 답이 이미 있으면 닫힌 카드다.** 안 닫으면 AI 가 짚어 둔
 * 것(`_recipe/<코드>.shape.json`)이 남아 있어 답을 넣어도 카드가 또 뜬다.
 */
/**
 * 그 자리가 **칸 수만 적으면 도구가 맞출 수 있는 자리인가.**
 *
 * 칸들이 같은 꼴이어야 늘리고 줄일 수 있다(`cells.ts` 의 `uniform`) — 칸마다
 * 꼴이 다르면 어느 것을 넣고 뺄지 모른다.
 *
 * **셈은 여기 하나다.** 카드를 만드는 `shapeAsks` 와 저절로 얹는
 * `sidestep.ts` 가 같은 눈으로 봐야 「카드는 숫자를 받는데 저절로는 안
 * 얹힌다」 같은 어긋남이 안 생긴다 (저장소 규칙 3).
 */
export function sizableAt(recipe: unknown, where: string, gameDataRoot: string): boolean {
  const now = valueAt(recipe, where, gameDataRoot)
  return Array.isArray(now) && now.length > 0 && uniform(now)
}

export function shapeAsks(
  findings: ShapeFinding[],
  recipe: unknown,
  gameDataRoot: string,
  kept: Answer[]
): Ask[] {
  const answered = new Set(kept.map((a) => parseCellsPath(a.path)).filter(Boolean))
  return findings.map((f) => {
    const now = valueAt(recipe, f.where, gameDataRoot)
    const sizable = sizableAt(recipe, f.where, gameDataRoot)
    return {
      id: `shape|${f.where}`,
      want: '짜임' as const,
      where: sizable ? cellsPath(f.where) : f.where,
      title: `원본은 ${f.now}개인데 이번 학습코드는 ${f.should}개로 보입니다.`,
      desc: f.why,
      give: sizable
        ? '항목의 구조가 모두 같아 개수만 입력하면 도구가 맞춥니다. 늘어난 항목은 앞 항목을 복사하고 값은 나중에 다시 채웁니다. ' +
          'figma 화면에서 개수를 세어 입력하세요.'
        : '항목마다 구조가 달라 도구가 어느 항목을 넣고 뺄지 정할 수 없습니다. 양산기 화면(forge-ui.bat)에서 ' +
          '항목을 맞추세요.',
      options: [],
      shape: sizable ? ('number' as const) : ('none' as const),
      // 지금 칸 수를 보여 준다 — 「고치기 전 값」 자리다.
      ...(sizable ? { now: (now as unknown[]).length } : {}),
      count: 1,
      items: [],
      carry: false,
      ...(answered.has(f.where) ? { done: true } : {})
    }
  })
}

// ─── 물어보기 ──────────────────────────────────────────────────────────

export type ShapeRun = ShapeRunResult

/**
 * `look` 을 주면 **그 리소스 폴더의 figma 화면을 보고** 센다 (2026-09-18).
 *
 * 폴더 개수만으로는 칸 수를 못 안다 — 8호에서 칸 수가 다른 맨 윗단 53자리 중
 * 폴더에 같은 개수의 무리가 있던 것이 **0** 이었다(`forge/src/tool/cells.ts`).
 * 칸 수가 다른 학습코드는 49개인데 카드가 뜬 것은 18개였다. 화면에는 걸음과
 * 칸이 그대로 보이므로, 있으면 보게 한다. **없어도 부른다** — 폴더만 보고 짚은
 * 35자리 중 23이 칸 수까지 맞았다(2026-09-18, 안 부르게 했다가 이 숫자로 되돌림).
 * 어느 쪽이든 **답은 카드로 올린다** — 얹는 것은 사람이 칸 수를 적은 뒤다.
 */
export async function askShape(
  code: string,
  origin: string,
  gameData: unknown,
  files: { name: string; base: string }[],
  familyOf: (rel: string) => string,
  // 받은 글을 남길 자리. 안 주면 안 남긴다 — 조사용으로 부를 때가 그렇다.
  repoRoot?: string,
  look?: { dir: string; shots: string[]; plans?: string[] }
): Promise<ShapeRun> {
  const out: ShapeRun = {
    ran: false,
    brief: '',
    shot: look ? shotNote(look.shots) : '',
    tokens: 0,
    took: 0,
    taken: [],
    refused: [],
    note: '',
    error: ''
  }
  const rows = arrayRows(gameData)
  const families = fileFamilies(files, familyOf)
  if (rows.length === 0) {
    out.note = '원본에서 가져온 값에 배열 항목이 없어 확인할 것이 없습니다.'
    return out
  }

  out.brief = shapeBrief(code, origin, rows, families, look?.shots ?? [], look?.plans ?? [], look?.dir ?? '')
  // 그림은 뺀 값이다 — 브리프 글자만 센다 (`revise.ts` 와 같다).
  out.tokens = roughTokens(out.brief)

  const reply = await askAi(out.brief, look?.dir)
  out.took = reply.took
  // 맞추기와 같이, 받은 글을 그대로 남긴다 (`reply.ts`).
  if (repoRoot) saveReply(repoRoot, code, 'shape', out.brief, reply.text, reply.error)
  if (!reply.ok) {
    out.error = reply.error
    return out
  }
  out.ran = true

  const checked = checkShape(readShape(reply.text), rows)
  out.taken = checked.taken
  out.refused = checked.refused
  const by = look ? 'figma 화면을 보고 ' : '폴더의 파일 개수만으로 '
  out.note = checked.taken.length
    ? `${by}${rows.length}개 항목을 비교해 ${checked.taken.length}개가 이번 학습코드와 다르다고 판단했습니다.`
    : `${by}${rows.length}개 항목을 비교했으며 다른 항목은 없습니다.`
  return out
}
