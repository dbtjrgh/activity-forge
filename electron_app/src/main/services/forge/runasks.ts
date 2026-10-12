/**
 * **한 번 돌린 결과에서 사람에게 물을 것을 모은다** — `run.ts` 가 208줄이 되어 갈랐다 (2026-10-02, 동작 변화 없음 · 카드 둘을 더하면서).
 *
 * **막힌 것을 요구로 바꾼다.** 에러 목록만 내놓으면 사람이 무엇을 해야 하는지 모른다 — 최종 목표 그림의 오른쪽 갈래다.
 * **짜임이 다르다고 짚어 둔 것도 요구다** (6단계). 칸 수가 다른 것은 에러가 안 나는 갈래라, 카드로 세우지 않으면 조용히 틀린 채 쓰인다.
 * **같은 자리를 두 번 묻지 않는다.** 낱말·개수·모름으로 가린 자리는 자리 카드가 맡는다 — 리소스 요구까지 같이 나가면 한 자리에
 * 「파일을 주세요」와 「무엇으로 바꿀까요」가 나란히 서서 어느 쪽이 맞는지 알 수 없다.
 *
 * 카드의 **차례**가 화면 차례다 — 원본이 틀렸다는 카드가 맨 앞이다(나머지는 옛 원본 것이다).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer, Ask, SceneCheck } from '../../../shared/forge'
import { answerAsk } from './answerkey'
import { asksOf, withDone } from './ask'
import type { Assembled } from './assemble'
import { listPaper } from './pasted'
import type { Forge } from './runtime'
import { sceneAsk } from './scene'
import { figmaSpot } from './section'
import { shapeAsks } from './shape'
import type { readFindings } from './shapestore'
import { shotsOf } from './shot'
import { slotAsks, wordAliases } from './slotask'
import { tailFindings } from './tailhint'
import { variantAsk } from './variantcheck'
import { voiceAsks } from './voiceask'
import { wholeCards } from './whole'

type Issues = Parameters<typeof asksOf>[0]

const one = (a: Ask | null): Ask[] => (a ? [a] : [])

export function runAsks(
  forge: Forge,
  code: string,
  got: Assembled,
  issues: Issues,
  ctx: { kept: Answer[]; seen: Set<string>; findings: ReturnType<typeof readFindings>; scene: SceneCheck | null }
): Ask[] {
  const { pick, swapped, judged, spec, cloned, start, whole } = got
  const root = spec?.gameData?.root ?? ''
  const dir = forge.files.rscDir(code)
  const slots = slotAsks(
    forge,
    judged,
    swapped,
    ctx.kept,
    // 카드 글이 「화면이 있나 없나」로만 갈리는 자리다 — 첫 장 이름이면 된다.
    dir ? (shotsOf(dir)[0] ?? null) : null,
    figmaSpot(forge.spec.parseStudyCode(code))
  )
  // **정답은 도구가 정하지 않는다** — 원본 것을 그대로 베낀다. 개수 검사는 통과하므로 묻지 않으면 틀린 정답이 조용히 나간다
  // (`answerkey.ts`. 8호 22차시 가운데 14차시에서 사람이 정답을 옮겼다).
  const key = answerAsk(cloned, swapped.recipe.gameData, root)
  return withDone(
    [
      // 원본이 틀렸으면 나머지 질문은 옛 원본 것이다 — 맨 앞에 (`scene.ts`)
      ...one(sceneAsk(forge, ctx.scene)),
      ...asksOf(issues, spec, swapped, forge.swap.familyOf, wordAliases(judged), swapped.sized?.groups, Boolean(dir && listPaper(dir, 'plan').length)),
      ...(whole ? wholeCards(whole.asks) : slots), // 통째로 맡긴 판이면 자리 · 짜임 카드는 옛 레시피 것 — AI 의 짐작만 (`whole.ts`)
      // 폴더가 말하는 칸 수도 같은 카드로 — 짐작이라 저절로는 안 얹는다 (`tailhint.ts`)
      ...(whole ? [] : shapeAsks([...ctx.findings, ...tailFindings(forge, code, swapped.recipe, root, ctx.findings)], swapped.recipe, root, ctx.kept)),
      ...one(key),
      // 받은 파일이 다른 변형 판(K32 ↔ K32Type2)과 훨씬 잘 맞으면 모듈부터 묻는다 (`variantcheck.ts`)
      ...one(variantAsk(forge, code, pick)),
      // 대사를 앞 학습코드에서 가져와야 하는데 성우 성별을 모르거나, 성별이 다른 학습코드의 대사가 들어 있으면 (`voiceask.ts`)
      ...voiceAsks(forge, code, pick.module, pick.origin, start, swapped.recipe)
    ],
    ctx.seen
  )
}
