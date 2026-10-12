/**
 * 「AI 에게 **앞 회차 것이 그대로 남은 자리** 고치게 하기」 (B단계).
 *
 * `match.ts` 는 **못 맞춘 자리**를 채운다. 여기는 다르다 — **도구가 맞춰 버린
 * 자리**를 본다. 도구는 앞선 호의 액티비티를 떠 와서 이름으로 짝을 맞추는데,
 * 이름이 맞아도 **이 회차의 것이 아닐 수 있다.** 6호가 `skirt`·`tshirt` 이고
 * 8호가 `crayon`·`fork` 인 자리가 그렇다. 에러도 카드도 안 나므로
 * **아무도 안 묻고 조용히 틀린 채 나간다.**
 *
 * 2026-09-17 에 76개를 재서 나온 값이다 — 도구가 완성본과 다른 줄의 **62%가
 * 「원본에서 그대로 온 칸」**이었다(`forge/src/tool/gamedata.ts`).
 *
 * **흐름은 `match.ts` 와 같다.**
 *
 *   ① 다시 모은다(`assemble`)     레시피가 여기서 나온다
 *   ② 브리프 한 장               경로 = 값 · 스펙 · 폴더에 실제로 있는 파일
 *   ③ 부른다(`ai.ts`)            없으면 브리프를 사람에게 준다
 *   ④ 검산한다                   준 경로인가 · 폴더에 있는 파일인가
 *   ⑤ 답으로 남긴다(`answer.ts`)  사람이 넣은 답과 **같은 길**을 탄다
 *
 * **②·④ 의 글은 `revisebrief.ts` 에 있다.** 여기는 흐름과 「모르겠다」 카드뿐이다.
 *
 * **붙여넣은 figma 화면이 있으면 그것을 보고 답한다** (2026-09-18). 여기가
 * 고리를 닫는 자리다 — 아래 `unsureAsks` 가 「화면을 달라」고 하는데, 넣어도
 * 이쪽이 안 보면 **같은 「모르겠다」가 또 난다.** 화면이 있을 때만 `Read` 를
 * 열고 리소스 폴더를 울타리(`cwd`)로 준다(`ai.ts` 의 `lookIn`). 자리 세우기
 * (`order.ts`)가 쓰는 화면과 **같은 한 장**이다(`shot.ts`).
 *
 * **파일 전문을 받지 않는다.** 받아 보니 AI 가 서식을 제 꼴로 다시 써서
 * `render.ts` 가 맞춰 둔 것이 도로 망가졌다. 바꿀 자리만 받고 **얹는 것은
 * 도구가 한다** — 서식이 안 망가지고 출력 토큰도 절반이다 (재서 확인).
 *
 * **경로 말은 얹는 쪽에서 가져온다.** `answer.ts` 의 `setAt` 이 받는 두 가지와
 * 자리 갈아 끼우기(`#slot`)뿐이다. 레시피 구조를 그대로 펴면
 * `assets.image[17].alias` 가 나오는데 **그것은 안 받는 말이라 한 개도 안 얹힌다.**
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Ask, ReviseResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { AI_SECONDS } from './ai'
import { saveAnswers } from './answer'
import { assemble } from './assemble'
import { roughTokens } from './brief'
import { briefOf, flatten } from './revisebrief'
import { specForBrief } from './revisespec'
import { checkEdits } from './revisecheck'
import { askParts, partsOf } from './revisecalls'
import { loadForge } from './runtime'
import { planGap, plansOf, shotNote, shotsOf } from './shot'
import { stepper, type Emit } from './step'

/** 답이 이보다 많으면 뭔가 잘못된 것이다 — 통째로 갈아엎으려는 것이다. */
const MAX_EDITS = 200

/**
 * **AI 가 「모르겠다」고 한 것을 사람에게 묻는 카드로.**
 *
 * 흐름은 이렇다 — 도구가 규칙으로 걸러내고, **화면을 보고** AI 가 만들고,
 * 그 화면으로도 모르는 것만 사람에게 묻는다. **화면은 이미 받아 둔 상태다**
 * (2026-09-21, `shotfirst.ts` 가 없으면 부르지도 않는다). 그래서 이 카드는
 * 「화면을 주세요」가 아니라 **「그 화면에는 안 보입니다, 다른 장면을
 * 주세요」**가 되는 것이 보통이다 — 아래 `give` 가 두 꼴로 갈리는 까닭이다.
 *
 * **카드 하나로 묶는다.** 별칭마다 카드를 내면 한 학습코드에 열두 장이 된다 —
 * 사람이 줄 것은 어차피 **화면**이라 물음도 하나여야 한다
 * (`ask.ts` 의 `count`·`items` 가 그 약속이다).
 *
 * **값으로 못 닫는 카드다.** 스샷을 넣고 다시 돌리면 그때 풀리는 것이라
 * 「확인했습니다」로 닫는 꼴(`shape: 'none'`)로 둔다.
 */
export function unsureAsks(
  code: string,
  unsure: ReviseResult['unsure'],
  spot: string,
  shot: string,
  /**
   * 어느 걸음에서 온 물음인가. **맞추기도 같은 꼴로 묻는다** (2026-09-21) —
   * 사람이 할 일이 똑같기 때문이다(다른 장면을 한 장 더). 다만 **id 는 갈라
   * 둔다** — 같으면 한쪽 카드가 다른 쪽을 덮어 「확인했습니다」 한 번에 둘 다 닫힌다.
   */
  from: 'revise' | 'match' = 'revise',
  /** 기획서가 들어와 있나 — 없으면 화면을 더 달라기 전에 **기획서부터** 달라고 한다 (2026-10-01, `askorder.ts` 머리말) */
  hasPlan = false
): Ask[] {
  if (!unsure.length) return []
  const items = unsure.map((u) => `${u.kind} ${u.alias} — ${u.why}`)
  return [
    {
      id: `${from}-unsure|${code}`,
      want: '사람이 봐야',
      title: shot
        ? `AI 가 붙여넣은 화면${hasPlan ? '과 기획서' : ''}를 보고도 리소스 ${unsure.length}개 항목을 정하지 못했습니다.`
        : `AI 가 리소스 ${unsure.length}개 항목을 정하지 못했습니다. figma 화면이나 기획서를 넣으세요.`,
      where: `assets (${unsure.length}개)`,
      desc: unsure[0].why,
      // **같은 말을 두 번 하지 않는다.** 화면을 이미 넣은 사람에게 「화면을
      // 넣으세요」라고 하면 넣어도 안 풀리는 것처럼 보인다 — 이때는 **무엇이
      // 모자랐는지**(위 `desc`)를 들고 다른 장면을 달라고 해야 한다.
      // **「앞 장은 지워집니다」가 아니다** (2026-09-21). 이제 쌓인다 —
      // 그러니 「한 장 더 붙이세요」라고 말해야 맞다.
      // 화면을 이미 넣었으면 figma 어디를 찍으라는 안내(`spot`)는 뺀다 — 한 칸에 글이 넷 겹쳐 읽기 힘들었다(2026-10-01)
      give: shot && !hasPlan
        ? `기획서를 넣고 「다시 생성」을 누르세요. 지금 값이 맞으면 「확인」을 누르세요.`
        : shot
        ? `위 내용이 보이는 화면을 한 장 더 붙여넣고 「다시 생성」을 누르세요. 지금 값이 맞으면 「확인」을 누르세요.`
        : `해당 화면을 Ctrl+V 로 붙여넣고 「다시 생성」을 누르세요. 여러 장을 넣어도 됩니다.` +
          (spot ? ` ${spot}` : ''),
      options: [],
      shape: 'none',
      count: unsure.length,
      items,
      carry: false
    }
  ]
}

/**
 * 한 번 돌린다. **AI 가 없으면 브리프를 돌려준다** — 막히지는 않는다.
 */
export async function reviseByAi(code: string, emit: Emit): Promise<ReviseResult> {
  const out: ReviseResult = { ran: false, brief: '', shot: '', tokens: 0, took: 0, taken: 0, refused: [], unsure: [], error: '' }
  try {
    const forge = await loadForge()
    const step = stepper([], emit)
    const got = await assemble(code, forge, step)
    const flat = flatten(got.swapped.recipe, got.spec?.gameData?.root ?? '')
    const listed = forge.api.files(code)
    // `name` 은 갈래 폴더 안에서의 자리 그대로다(`narration/x.mp3`). 레시피의 `file`
    // 과 같은 꼴이라 **자르지 않고** 보여 준다 — 잘라 보이면 AI 가 자른 이름으로 답한다.
    const names = listed.ok ? (listed.files as { name: string }[]).map((f) => f.name) : []

    // **붙여넣은 화면이 있으면 보게 한다.** 화면은 `_figma` 에 있고 그 폴더는
    // `listFiles` 가 리소스로 세지 않으므로(`files.ts` 의 `DIR_KIND`), 위
    // `names` 에 섞여 「이 자리에 스크린샷을 넣자」가 되는 일은 없다.
    const dir = forge.files.rscDir(code)
    // **여러 장을 다 넘긴다** (2026-09-21). 한 장만 보면 「다른 장면은 잘렸다」는
    // 까닭으로 사람이 더 붙인 화면이 그대로 안 읽힌다.
    const shots = dir ? shotsOf(dir) : []
    // **기획서가 있으면 값은 그쪽이 정본이다** (2026-09-21, `pasted.ts`).
    const plans = dir ? plansOf(dir) : []
    out.shot = shotNote(shots)

    // 규칙·관계는 같은 문장 목록으로 — 옮겨도 물음이 안 바뀐다 (`revisebrief.ts`)
    const spec = specForBrief(got.spec as Record<string, unknown> | null)
    // **묶음으로 나눠 동시에 묻는다** (2026-09-21). 한 장으로 물으면 181초였다
    // (`revisecalls.ts` 에 까닭). 못 부를 때 사람에게 주는 브리프도 이 묶음
    // 그대로다 — 화면이 보여 주는 것과 실제로 보낸 것이 달라지면 안 된다.
    const briefs = partsOf(flat.lines).map((lines) =>
      briefOf(code, { lines, known: flat.known }, spec, names, shots, plans, dir ?? '')
    )
    out.brief = briefs.join('\n\n───────────────\n\n')
    // **그림은 뺀 값이다.** 브리프 글자만 센다 — 화면 한 장이 그보다 크다.
    out.tokens = roughTokens(out.brief)

    // **걸음으로 낸다** (2026-09-21). 전에는 이 부름이 화면에 아예 안 보여서,
    // 맞추기가 끝난 뒤 몇 분 동안 **아무 줄도 안 늘고 그냥 멈춘 것처럼** 보였다.
    const at = Date.now()
    const said = await step(
      '앞 회차 값 고치기',
      () => askParts(briefs, out.shot || plans.length ? (dir as string) : undefined),
      (r) => ({
        name: '앞 회차 값 고치기',
        state: r.ok ? (r.done < r.parts ? 'warn' : 'ok') : r.missing ? 'warn' : 'fail',
        note: r.ok
          ? `값 ${flat.lines.length}줄을 ${r.parts}묶음으로 나눠 동시에 비교했습니다(${Math.round(r.took / 1000)}초).` +
            (r.done < r.parts ? ` ${r.parts - r.done}묶음은 AI 를 호출하지 못했습니다(${r.error}).` : '') +
            (planGap(dir ?? '', plans) ? ` ${planGap(dir ?? '', plans)}` : '')
          : r.error
      }),
      (s) => `값 ${flat.lines.length}줄(${briefs.length}묶음), 폴더 파일 ${names.length}개` +
        (shots.length ? `, figma 화면 ${shots.length}장` : '') +
        `을 확인하는 중입니다. ${s}초 경과(최대 ${AI_SECONDS}초)`
    )
    out.took = Date.now() - at
    if (!said.ok) {
      out.error = said.error
      return out
    }
    out.ran = true

    const { answers, refused, unsure } = checkEdits(said.text, flat, new Set(names))
    out.refused = refused
    out.unsure = unsure
    if (answers.length > MAX_EDITS) {
      out.error = `AI 가 고치려는 항목이 ${answers.length}개로 너무 많아 적용하지 않았습니다.`
      return out
    }
    if (answers.length) saveAnswers(forge.paths.REPO_ROOT, code, answers, 'ai')
    out.taken = answers.length
    return out
  } catch (error) {
    out.error = toMessage(error)
    return out
  }
}
