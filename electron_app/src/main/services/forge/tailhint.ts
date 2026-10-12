/**
 * **폴더가 말하는 칸 수를 카드로** (2026-09-28).
 *
 * `ENL3M07W3S1` — 원본(6호) 거품은 5칸인데 이 회차 폴더엔 `icon01~04.png` 뿐이다. 짜임
 * 견주기(AI)는 figma 를 보고도 「어긋난 곳 없음」이라 했고, 그러자 `icon05`·`word05` 가
 * 「파일을 주세요」 카드로 남았다. **없는 파일을 달라는 것이 아니라 칸이 하나 준 것이다.**
 * `familytrim.ts` 는 GameData 가 그 이름을 부르는 동안 손대지 않으므로 칸이 먼저 줄어야 한다.
 *
 * 셈은 forge `gen/tailwit.ts` 하나다. **짐작이다** — 완성본에 대 보니 29번 중 18번 맞았다.
 * 그래서 AI 가 짚은 것처럼 저절로 얹지 않고(`sidestep.ts` 의 `cellsAnswers` 에 안 넣는다)
 * **칸 수 카드로만** 올린다. 사람이 figma 에서 세어 적으면 `cells.ts` 가 줄인다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { ShapeFinding } from '../../../shared/forge'
import type { Forge } from './runtime'

/** 레시피 값 자리 — 뿌리 이름을 붙인다(`quizData.chapter[1].bubble`). AI 가 짚은 것과 같은 꼴 */
function fullPath(root: string, where: string): string {
  if (!root) return where
  return where.startsWith('[') ? `${root}${where}` : `${root}.${where}`
}

/** 폴더가 꼬리 칸을 없애라고 말하는 자리. **이미 짚은 자리는 뺀다** — 한 자리에 카드 둘이 서지 않게 */
export function tailFindings(
  forge: Forge,
  code: string,
  recipe: { gameData?: unknown; assets?: Parameters<Forge['common']['relOf']>[0]['assets'] },
  root: string,
  taken: ShapeFinding[]
): ShapeFinding[] {
  const got = forge.files.listFiles(code)
  if (!got?.exists) return []
  const folder = new Set(
    got.files.map((f) => (f.base === 'root' ? f.name : `${f.base}/${f.name}`).toLowerCase())
  )
  const seen = new Set(taken.map((f) => f.where))
  return forge.tailwit
    .tailHints(recipe.gameData, forge.common.relOf(recipe), folder)
    .map((h) => ({
      where: fullPath(root, h.where),
      now: h.from,
      should: h.to,
      // 한 마디만 — 짐작의 적중률(29번 중 18번)은 머리말에 둔다
      why: `폴더에 ${h.family} 파일이 ${h.to}개뿐입니다.`
    }))
    .filter((f) => !seen.has(f.where))
}
