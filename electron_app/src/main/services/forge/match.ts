/**
 * **뜻으로 맞추기** — 브리프를 만들고, 부르고, 검산해서 답으로 얹는다 (6단계).
 *
 * 맞추는 일은 층이 셋이고 **무엇을 보고 맞추느냐**로만 갈린다 —
 * **이름으로**(규칙, `swap.ts`) → **뜻으로**(여기, AI) → **사람이**(요구 카드).
 * 앞 층이 못 맞춘 것만 다음 층으로 간다.
 *
 * 흐름은 짧다 —
 *
 *   ① 다시 모은다(`assemble`)     못 맞춘 자리와 폴더에 남은 파일은 여기서 나온다
 *   ② 브리프 한 장(`brief.ts`)     그 차시에서 못 맞춘 것만. 5천 토큰 안쪽
 *   ③ 부른다(`ai.ts`)             `claude -p`. 없으면 브리프를 사람에게 준다
 *   ④ 검산한다(`brief.ts`)         폴더에 있는 파일인가 · 겹치지 않나 · 갈래가 맞나
 *   ⑤ 답으로 남긴다(`answer.ts`)   사람이 넣은 답과 **같은 길**을 탄다
 *
 * ⑤ 가 중요하다. AI 답을 따로 두면 「사람이 고친 것과 AI 가 넣은 것」이 두 벌이
 * 되고, 다시 돌릴 때 어느 쪽이 이기는지가 흐려진다. 같은 파일에 같은 꼴로
 * 남으므로 사람이 언제든 덮어쓸 수 있다.
 *
 * **까닭은 결과에 담아 화면으로 보낸다.** 「item_bear_24 는 bear 무리」 한 줄이
 * 화면에 그대로 보여야 고치는 사람이 **무엇이 AI 짐작인지** 안다. 보낸 글과
 * 받은 글은 `reply.ts` 가 `_recipe` 에 남긴다.
 *
 * **곁걸음 둘(이름·차례 · 짜임)은 `sidestep.ts` 에 있다.** 여기는 맞추기 흐름뿐이다.
 *
 * **차례가 중요하다** (2026-09-21) — 짜임을 **먼저** 묻고, 칸이 벌어지면 다시
 * 모은 뒤에 맞추기를 한다. 칸이 안 벌어진 채로 물으면 걸 자리가 없다.
 * 이름·차례만 맞추기와 나란히 돈다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { emptyMatch, type Answer, type MatchResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'

import { saveAnswers } from './answer'
import { assemble } from './assemble'
import { roughTokens } from './brief'
import { slotsOf } from './briefslots'
import { followHint } from './aliasfollow'
import { askChunks, askNote, askProgress } from './matchcalls'
import { chunksOf } from './matchchunks'
import { checkPairs, matchNote, pairPath, readPairs } from './pairs'
import { saveReply } from './reply'
import { loadForge } from './runtime'
import { wordAliases } from './slotask'
import { shotGate } from './shotfirst'
import { planGap, plansOf } from './shot'
import { askShapeStep, orderStep } from './sidestep'
import { stepper, type Emit } from './step'

export async function matchByAi(code: string, emit: Emit): Promise<MatchResult> {
  const out: MatchResult = emptyMatch(code)

  let forge: Awaited<ReturnType<typeof loadForge>>
  try {
    forge = await loadForge()
  } catch (error) {
    out.error = toMessage(error)
    return out
  }

  const step = stepper([], emit)
  try {
    // ─ ① 다시 모은다 ─
    // **조용히 하지 않는다.** 클론과 맞추기에 몇 초가 걸리는데 그동안 아무
    // 말이 없으면 「눌렀는데 아무 일도 안 일어난다」가 된다.
    const first = await assemble(code, forge, step)

    // ─ ①.5 **짜임을 먼저 묻는다** (2026-09-21) ─
    //
    // 2026-09-21까지는 짜임·이름차례·맞추기 셋을 **동시에** 불렀다. 서로의
    // 답을 안 쓴다고 봤기 때문인데, **틀렸다.** `MAL2M07W2S1` 이 그것을
    // 보여 줬다 — 폴더는 `view_0_0`…`view_4_2`(5×3)인데 원본에서 베껴 온
    // 자리는 3칸짜리라, 맞추기가 아무리 잘해도 **걸 데가 없어** 71자리 가운데
    // 58자리가 빈 채로 남았다. **칸이 먼저 벌어져야 짝이 생긴다.**
    //
    // 그래서 짜임만 먼저 기다린다. 얹은 것이 있으면 **다시 모은다** —
    // `applyCells` 는 `assemble` 안(③.55)에서 도는데 맞추기는 그보다 앞(③)이라,
    // 다시 모으지 않으면 벌어진 자리를 맞추기가 못 본다.
    const sized = await askShapeStep(code, first.pick.origin, first.swapped, forge, step, out, first.spec)
    const { pick, swapped, judged, spec } = sized ? await assemble(code, forge, step) : first

    // ─ ①.6 이름·차례는 **같이 돌린다. 기다리지 않는다** ─
    //
    // 이것은 맞추기와 정말로 재료를 나눠 쓴다 — 맞추기 브리프를 거르는
    // `wordAliases(judged)` 는 이 걸음 이전에 이미 정해져 있다. 줄 세워
    // 기다리면 한 바퀴가 그만큼 길어진다.
    //
    // **넘어져도 맞추기를 안 막는다**(`sidestep.ts`). 그래도 여기서 한 번 더
    // 감싸 두면 기다리기 전에 터지는 일이 없다.
    const side = orderStep(forge, code, judged, swapped, step, out).catch(() => {})

    // ─ ② 브리프 ─
    // **「고정」만 묻는다.** 낱말·개수·모름으로 가린 자리는 이름으로 맞출
    // 것이 아니라 자리를 세울 것이라, 브리프에 넣으면 답 없는 물음이 된다.
    // **차례만 남은 같은 크기 묶음도 묻는다 — 모르겠다는 답만 버린다** (2026-10-01에 고침, `sizematch.ts`).
    // 9-29 에는 안 물었다 — KOL1M08W1S3 에서 AI 가 「순서표가 있어야」라며 못 풀었고 사람 카드와 겹쳐 떴다. 그때는 그림을 열어 보라는 말이 없었다.
    // 9호 KOL1M08W2S2 는 낱말 그림 · 사물 그림 열 장이 다 122x137 이라 고르기 카드가 열 장 떴는데, 열어 보면 글자 · 사물이 다 보인다(`brief.ts` 「직접 열어」).
    // AI 가 고르면 카드가 안 뜨고, 모르면 고르기 카드만 뜬다(아래 `unsure` 에서 뺀다)
    const ordered = new Set((swapped.sized?.groups ?? []).flatMap((g) => g.aliases))
    const fixed = swapped.misses.filter((m) => !wordAliases(judged).has(m.alias))
    const slots = slotsOf(fixed, spec as Parameters<typeof slotsOf>[1], (a) => followHint(forge, swapped, spec, a))
    out.slots = slots.length

    // **맞추기가 없어도 짜임은 묻는다.** 칸 수가 다른 것은 에러가 안 나는
    // 갈래라, 「맞출 것이 없다」로 끝내면 그대로 조용히 틀린 채 넘어간다.
    // 그래서 아래 두 길로 빠질 때도 **곁걸음을 기다리고 나간다** — 안 기다리면
    // 답이 도착하기 전에 결과를 돌려줘 화면에 곁걸음이 통째로 안 보인다.
    if (slots.length === 0) {
      await side
      out.note = '맞추지 못한 리소스 항목이 없습니다.'
      return out
    }
    if (swapped.spare.length === 0) {
      await side
      out.note =
        '폴더에 남은 파일이 없어 AI 도 맞출 수 없습니다. 리소스를 먼저 넣으세요.'
      return out
    }

    // **붙여넣은 화면을 같이 본다** (2026-09-21). 전에는 `revise`·`order`·
    // `shape` 만 화면을 보고 **맞추기만 눈을 감고 있었다** — 이름으로 못 맞춘
    // 자리야말로 화면이 있어야 아는 자리인데 그랬다.
    //
    // `auto.ts` 는 화면이 없으면 아예 안 부르지만(`shotfirst.ts`), 양산 화면의
    // 「AI 에게 맡기기」 단추가 이 함수를 **따로** 부르기도 한다. 그 길에는
    // 문지기가 없으므로 여기서 한 번 더 본다 — 없으면 없는 대로 간다.
    const gate = await shotGate(code)
    // **한 번에 다 묻지 않고 나눠서 동시에 묻는다** (2026-09-21) — 잰 값은 `matchcalls.ts` 머리말
    // **기획서도 같이 본다** (2026-09-23). figma 와 똑같은 구멍이었다 — 기획서
    // 통로를 낸 날 이름·차례·값·짜임 셋에만 잇고 맞추기를 빠뜨렸다. 그런데
    // 「어느 칸에 무엇이 오나」를 정하는 것이 바로 이 걸음이다.
    const plans = gate.dir ? plansOf(gate.dir) : []
    const parts = chunksOf(code, pick.module, pick.origin, slots, swapped.spare, plans.length > 0)
    out.brief = parts.map((p) => p.brief).join('\n\n───────────────\n\n')
    out.tokens = roughTokens(out.brief)

    // ─ ③ 부른다 ─
    const reply = await step(
      'AI 에게 묻기',
      () => askChunks(parts, gate.dir || undefined, gate.shots, plans, gate.dir),
      (r) => ({
        name: 'AI 에게 묻기',
        state: r.ok ? (r.done < r.parts ? 'warn' : 'ok') : r.missing ? 'warn' : 'fail',
        note: askNote(r, slots.length, planGap(gate.dir, plans))
      }),
      // **도는 동안 무엇을 하는지 적는다.** 이 걸음이 제일 오래 걸린다.
      (s) => askProgress(s, slots.length, parts.length, gate.shots.length, plans.length)
    )
    out.took = reply.took
    // **여기서 곁걸음을 거둔다.** 아래는 답을 파일로 남기는 길인데, 이름·차례도
    // 같은 답 파일에 쓰므로 **겹쳐 쓰면 한쪽이 날아간다.** 아래 어느 길로
    // 빠지든 이 줄을 지나가게 둔다.
    await side
    // **받은 글을 그대로 남긴다 (`reply.ts`).** 못 불렀을 때도 남긴다 — 그때는
    // 까닭이 글 대신 들어간다. 이것이 없어서 「한 줄도 못 읽은」 차시 열하나의
    // 까닭을 못 가렸다 (2026-09-15).
    saveReply(forge.paths.REPO_ROOT, code, 'match', out.brief, reply.text, reply.error)
    if (!reply.ok) {
      out.error = reply.error
      // 브리프는 그대로 돌려준다 — 사람이 붙여넣을 수 있게.
      return out
    }
    out.ran = true

    // ─ ④ 검산 ─
    const checked = await step(
      '답 검산',
      () => checkPairs(readPairs(reply.text), slots, swapped.spare),
      (c) => ({
        name: '답 검산',
        state: c.taken.length === 0 ? 'fail' : c.refused.length ? 'warn' : 'ok',
        note: matchNote(c, slots)
      })
    )
    out.taken = checked.taken
    out.refused = checked.refused
    out.unsure = checked.unsure.filter((u) => !ordered.has(u.alias)) // 같은 크기 묶음은 고르기 카드가 맡는다 — 두 장 겹쳐 뜨지 않게
    out.note = matchNote(checked, slots)
    if (checked.taken.length === 0) return out

    // ─ ⑤ 답으로 남긴다 ─
    const answers: Answer[] = checked.taken.map((p) => ({
      path: pairPath(slots, p.alias),
      value: p.file
    }))
    saveAnswers(forge.paths.REPO_ROOT, code, answers, 'ai')
    // **까닭은 결과에 그대로 있다.** 전에는 예외 메모로도 남겨 `_note.md` 를
    // 내보냈는데 2026-09-16 에 걷어냈다. AI 가 왜 그렇게 골랐는지는 화면에
    // 보이고, 보낸 글과 받은 글은 `reply.ts` 가 `_recipe` 에 그대로 남긴다.
  } catch (error) {
    out.error = toMessage(error)
  }
  return out
}
