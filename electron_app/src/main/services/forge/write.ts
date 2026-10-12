/**
 * 실제로 파일을 쓴다 — **여기서부터 남의 폴더에 들어간다.**
 *
 * 2단계까지는 `--dry` 로만 돌았습니다. 이 파일이 그 빗장을 푸는 자리라,
 * 하는 일보다 **안 하는 일**이 더 중요합니다.
 *
 *   ① 만들어 보기가 통과하지 않으면 안 쓴다
 *   ② 쓰기 권한을 ACL 로 먼저 본다 — 모르면 「모른다」로 두고 막지는 않는다
 *   ③ 이미 있는 액티비티는 **덮어쓰겠다고 따로 말해야** 쓴다
 *   ④ 덮어쓸 때 그 자리가 git 으로 깨끗하지 않으면 **막는다**
 *   ⑤ 답도 확인도 안 된 요구 카드가 남아 있으면 **막는다**
 *
 * ⑤ 는 「짐작이 남은 채 남의 저장소에 파일이 들어가는 것」을 막는 자리입니다.
 * 값으로 채울 수 있으면 답을 넣고, 채울 수 없는 것(「사람이 봐야」)은 띄워서
 * 보고 **「확인했습니다」를 누릅니다.** 2026-09-16 에 글로 남기는 예외 메모를
 * 걷어냈습니다 — 적는 사람에게 일만 늘고 읽는 사람이 없었습니다.
 *
 * **「양산 시작」이 아니라 여기서 막습니다.** 카드는 「양산 시작」을 눌러야
 * 생깁니다 — 그것을 막으면 무엇이 모자란지 볼 길이 없어집니다. 막아야 하는
 * 것은 **짐작이 남은 채 남의 저장소에 파일이 들어가는 것**입니다.
 *
 * ④ 가 이 파일의 핵심입니다. 호 저장소는 git 이고, 커밋된 것이면 git 이 곧
 * 되돌릴 길입니다(저장소 CLAUDE.md 7번). 그런데 **커밋 안 된 남의 일감이
 * 그 자리에 있으면 덮어쓰는 순간 되돌릴 길이 없습니다.** 그때는 「이런 것이
 * 안 올라가 있습니다」를 보여 주고 사람이 정하게 합니다.
 *
 * ②③④ 를 재는 일은 `writecheck.ts` 에 있습니다.
 */

import { join } from 'node:path'
import type { WriteResult } from '../../../shared/forge'
import { BUTTON, blocking } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { assemble } from './assemble'
import { record } from './measure'
import { deliverResources } from './inbox'
import { DRY_ONLY, runDry } from './run'
import { loadForge } from './runtime'
import { sameNote, samePictures } from './samepics'
import { stepper, type Emit } from './step'
import { recordWrote, repoOf, writeCheck } from './writecheck'
import { keepFinished, markWrite, usedFiles } from './writeside'

/**
 * 실제로 쓴다.
 *
 * **만들어 보기를 처음부터 다시 돌린다.** 앞서 화면에서 통과한 것을 믿고
 * 바로 쓰지 않는다 — 그 사이에 리소스가 빠졌을 수도, 답이 바뀌었을 수도
 * 있다. 걸음이 다시 도는 몇 초가 남의 저장소를 고치는 값보다 싸다.
 *
 * `overwrite` 는 화면에서 사람이 「덮어쓰겠다」를 누른 것이다. 그 말이
 * 없으면 이미 있는 자리에는 쓰지 않는다.
 */
export async function writeNow(
  code: string,
  overwrite: boolean,
  emit: Emit,
  /**
   * 사람이 누른 것인가. **6단계가 대신 부를 때는 false 다** — 손길로 세면
   * 줄이려고 만든 것이 숫자를 늘린다 (`measure.ts`).
   */
  byHand = true
): Promise<WriteResult> {
  // 사람이 시킨 일 한 번 (1단계 시험대). 눌렀지만 빗장에 걸려 안 쓰이는
  // 일도 있으므로 **누른 것과 쓴 것을 따로** 적는다.
  if (byHand) await markWrite(code, overwrite ? '덮어쓰기' : '쓰기')

  const dry = await runDry(code, emit)
  const out: WriteResult = { ...dry, written: [], dirs: [] }
  if (!dry.ok) {
    out.writeNote = '생성을 진행할 수 없어 반영하지 않았습니다. 질문에 먼저 답하세요.'
    return out
  }

  const steps = out.steps
  const step = stepper(steps, emit)

  try {
    // ─ ⑤ 남은 물음 ─
    // **답도 확인도 없는 카드가 하나라도 있으면 안 쓴다.** 여기까지 온
    // 카드는 에러가 아닌 것들이다 — 「사람이 봐야」처럼 기계가 판정 못 하는
    // 자리. 그대로 쓰면 무엇이 확인된 것이고 무엇이 짐작인지 알 길이 없다.
    const left = await step(
      '남은 물음',
      // 검수 카드(AI 의 짐작)는 빼고 센다 — 반영해야 미리보기로 볼 수 있다 (`isReview`)
      () => blocking(dry.asks),
      (rest) => ({
        name: '남은 물음',
        state: rest.length ? 'fail' : 'ok',
        note: rest.length
          ? `남은 질문이 ${rest.length}개 있습니다. 답변을 입력하거나 「확인」을 누르세요.`
          : dry.asks.length
            ? `질문 ${dry.asks.length}개에 모두 답했습니다.`
            : '남은 질문이 없습니다.'
      })
    )
    if (left.length) {
      out.writeNote = `남은 질문 ${left.length}개가 있어 반영하지 않았습니다: ${left.map((a) => a.where).slice(0, 3).join(', ')}${left.length > 3 ? ' …' : ''}`
      return out
    }

    const check = await step(
      '쓸 수 있나',
      () => writeCheck(code),
      (c) => ({
        name: '쓸 수 있나',
        state: c.blocked ? 'fail' : c.exists ? 'warn' : 'ok',
        note:
          c.blocked ||
          (c.dummy ? c.slot : c.exists ? `이미 있는 액티비티입니다. ${c.git.note}` : `새로 만듭니다: ${c.dir}`) +
            (c.behind ? ` ${c.behindNote}` : '')
      })
    )
    out.check = check

    if (check.blocked) {
      out.writeNote = check.blocked
      return out
    }
    // 빈 뼈대(더미)는 「덮어쓰기」 없이 채운다 — 사람 것만 누르게 한다 (M7 · `dummy.ts`)
    if (check.exists && !overwrite && !check.dummy) {
      out.writeNote = `이미 있는 액티비티입니다. 다시 반영하려면 「${BUTTON.rewrite}」을 누르세요. ${check.git.note}`
      return out
    }

    // **다시 모으되 조용히 한다.** 걸음 이름이 같아 화면이 앞의 것을 덮어
    // 쓰는데, 이미 끝난 줄이 「도는 중」으로 되돌아갔다가 다시 차는 것은
    // 사람에게 「뭔가 잘못됐나」로 보인다. 결과 목록도 두 벌이 된다.
    const forge = await loadForge()
    const quiet = stepper([], () => {})
    const { swapped, pick } = await assemble(code, forge, quiet)
    // **덮어쓸 때는 그 자리의 「개발 끝」 표시를 지킨다** (2026-09-23). 정보는 원본(앞 회차)을
    // 떠 온 값이라, 사람이 끝냈다고 표시해 둔 MAL1M07W1S1 을 다시 만들자 `devFinished` 가
    // false 로 되돌아갔다. 그 표시는 이 회차의 사정이지 원본의 것이 아니다.
    if (check.exists) keepFinished(check.dir, swapped.recipe)

    const made = await step(
      '실제로 쓰기',
      () => {
        // 생성기가 여기서 검증을 **다시** 한다. 위 만들어 보기 뒤로 무엇이
        // 바뀌었으면 여기서 걸리고 파일은 안 쓰인다.
        const g = forge.api.generate(swapped.recipe, check.exists, true)
        if ('error' in g) throw new Error(g.error)
        if (!g.ok) throw new Error('검증을 통과하지 못해 반영하지 않았습니다.')
        return g
      },
      (g) => ({
        name: '실제로 쓰기',
        state: 'ok',
        note: `파일 ${g.files.length}개${g.dirs.length ? `, 폴더 ${g.dirs.length}개` : ''}를 반영했습니다.`
      })
    )

    out.written = made.files
    out.dirs = made.dirs
    out.wrote = true
    // **여기서 한 판이 끝난다.** 다음에 또 손대면 그것은 다음 판이다.
    record(forge.paths.REPO_ROOT, code, { wrote: true })

    // ─ 리소스 따라 보내기 (4단계) ─
    // **액티비티만 가면 반쪽이다.** 리소스를 호 저장소 밖에 두고 있으면
    // 그림·소리가 따라가지 않아 브라우저에서 404 가 된다. 원본은 그대로
    // 두고 복사만 한다 — 놓은 자리는 사람이 다시 쓸 수도 있다.
    if (check.warn) {
      const to = join(repoOf(forge.paths, code), 'public', 'sparklab', code)
      const sent = await step(
        '리소스 따라 보내기',
        // **쓰는 파일만** 보낸다 — 폴더에 남은 사본까지 따라가지 않게 (`inbox.ts`)
        () => deliverResources(code, to, check.exists, usedFiles(forge, swapped.recipe)),
        (r) => {
          // 올라간 그림이 이번 호 것인가 — 원본 호 그림과 바이트까지 같은 것을 적는다 (`samepics.ts`, 사용자 규칙)
          const same = r.error ? [] : samePictures(forge, code, pick.origin, swapped.recipe, to)
          return {
            name: '리소스 따라 보내기',
            state: r.error || r.failed.length || r.clash.length || same.length ? 'warn' : 'ok',
            note: r.error || [`${to}: ${r.note}`, sameNote(same, pick.origin)].filter(Boolean).join(' ')
          }
        }
      )
      out.delivered = sent
    }

    // 도구가 남긴 모습을 적어 둔다 — 다음 덮어쓰기가 「도구 것」임을 알게 (`writecheck.ts`)
    await recordWrote(forge, code)

    out.writeNote = check.exists ? '덮어썼습니다. 되돌리려면 호 저장소에서 git 으로 되돌리세요.' : '새로 만들었습니다.'
  } catch (error) {
    out.error = toMessage(error)
    out.writeNote = DRY_ONLY
  }
  return out
}
