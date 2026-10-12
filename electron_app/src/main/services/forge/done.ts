/**
 * **「끝」** (2026-09-29, M7) — 사람이 앱 안 창에서 보고 「이대로 좋습니다」를 누르면, 호 저장소의 그 학습코드
 * `activityInfo.json` 을 **개발 끝**으로 다시 쓴다. 검수 사이트가 이 칸을 보고 「제작 끝남」으로 올린다.
 *
 *   devFinished  true
 *   finishedDate 오늘(이 PC 의 날짜 — forge `user.today`)
 *   developer · devTeam  `.user.json` 값 (여쭐 것 9 — 허락). description 은 그 자리 것 그대로
 *
 * **이 칸만 쓴다.** 액티비티를 다시 만들지 않는다 — 사람이 본 그대로가 끝이다. 서식은 생성기와 같은 함수
 * (`render.renderActivityInfo`) 하나로 뽑는다 — 따로 쓰면 칸 차례 · 들여쓰기가 갈려 git diff 가 통째로 잡힌다.
 * 쓴 뒤에는 도구가 쓴 모습으로 적어 둔다(`recordWrote`) — 다음 덮어쓰기가 이것을 「사람 것」으로 오해하지 않게.
 * 그 뒤 다시 만들어 써도 「끝」 표시는 그 자리 것을 지킨다(`write.ts` `keepFinished`).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DoneResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { mark } from './measure'
import { loadForge } from './runtime'
import { recordWrote, writeCheck } from './writecheck'

type Info = { devFinished?: unknown; finishedDate?: unknown; devTeam?: unknown; developer?: unknown; description?: unknown }
const KEYS = ['devFinished', 'finishedDate', 'devTeam', 'developer'] as const

export async function markDone(code: string): Promise<DoneResult> {
  const fail = (error: string): DoneResult => ({ ok: false, file: '', changed: [], note: '', error })
  try {
    const forge = await loadForge()
    const check = await writeCheck(code)
    // **커밋 안 된 변경으로는 막지 않는다** (2026-10-08 사용자 말 — 「검수완료 하면 안되는데 되게끔 해놔」).
    // 그 점검은 반영이 사람 것을 덮을까 봐 있는 것인데, 여기서 쓰는 파일은 activityInfo.json 하나다. 대화로 만든 학습코드는
    // Claude 와 사람이 고친 파일이 늘 커밋 전이라 영영 막혔다 — 그 변경이 곧 검수한 것이고 「양산 완료 커밋」이 같이 올린다
    if (check.blocked && !check.dirtyHuman) return fail(check.blocked)
    if (!check.exists) return fail('아직 호 저장소에 없습니다. 먼저 대화로 생성하세요.')
    // **빈 뼈대는 끝이 아니다** (2026-09-29 시험에서 밟음) — 안 만든 9호 더미에 누르자 개발 끝으로 적혔다
    if (check.dummy) return fail('아직 빈 뼈대입니다. 대화로 생성한 뒤 누르세요.')
    const file = join(check.dir, 'activityInfo.json')
    let was: Info = {}
    try {
      was = JSON.parse(readFileSync(file, 'utf8')) as Info
    } catch {
      // 없거나 깨졌으면 새로 쓴다 — 칸은 생성기와 같은 꼴이다
    }
    const user = forge.user.loadUser()
    // **남의 팀 것은 끝으로 적지 않는다** (2026-09-29 시험에서 밟음) — KOL1M07W1S1(협력사 · 다른 개발자)에 누르자 만든 사람이
    // 내 이름으로 갈렸다. KO07 도 진행판에 있어 작업대에서 누를 수 있다. 빈 칸(9호 더미)이거나 같은 팀일 때만 적는다
    const team = typeof was.devTeam === 'string' ? was.devTeam : ''
    if (team && team !== user.devTeam) {
      return fail(`이 액티비티는 ${team}${typeof was.developer === 'string' && was.developer ? `(${was.developer})` : ''} 담당이라 개발 완료로 바꾸지 않습니다.`)
    }
    const info = {
      devFinished: true,
      finishedDate: forge.user.today(),
      devTeam: user.devTeam,
      developer: user.developer,
      description: typeof was.description === 'string' ? was.description : ''
    }
    const text = forge.render.renderActivityInfo(code, { info } as Parameters<typeof forge.render.renderActivityInfo>[1])
    const now = JSON.parse(text) as Info
    const changed = KEYS.filter((k) => was[k] !== now[k]).map((k) => `${k} ${JSON.stringify(was[k] ?? null)} → ${JSON.stringify(now[k])}`)
    if (!changed.length) return { ok: true, file, changed, note: '이미 개발 완료입니다.' }
    writeFileSync(file, text, 'utf8')
    await recordWrote(forge, code)
    mark(forge.paths.REPO_ROOT, code, '끝')
    const pending = check.dirtyHuman ? ` 커밋하지 않은 변경 ${check.git.dirty.length}건도 함께 올라갑니다.` : ''
    return { ok: true, file, changed, note: `개발 완료로 저장했습니다. 「양산 완료 커밋」을 누르면 저장소에 올라갑니다.${pending} (${changed.join(', ')})` }
  } catch (error) {
    return fail(toMessage(error))
  }
}
