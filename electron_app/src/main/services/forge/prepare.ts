/**
 * 리소스 화면이 처음 보여 줄 것을 한 번에 모은다.
 *
 * **묻지 않고 알 수 있는 것을 먼저 채운다** — 학습코드 하나만 있으면 배치표가
 * 모듈과 원본을 정하고, 리소스 폴더 자리도 정해지고, 거기 놓인 파일도 셀 수 있고,
 * 쓰기 권한도 미리 볼 수 있다. 사람에게 물을 것은 그 뒤에 남는 것뿐이다.
 *
 * **자리마다 따로 실패한다.** 배치표를 못 읽어도 리소스 폴더는 보여 줄 수 있고,
 * 원본을 못 떠 와도 지금 놓인 파일은 셀 수 있다. 하나가 넘어졌다고 화면 전체를
 * 「읽지 못했습니다」로 덮으면, 정작 사람이 고쳐야 할 자리가 안 보인다.
 *
 * forge 를 부르는 규칙은 `runtime.ts` 하나뿐이다 — 여기서 `@/gen/...` 을 직접
 * import 하지 않는다. 까닭은 저장소 CLAUDE.md 의 「forge 를 불러 쓸 때」.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Prepare, RscFile } from '../../../shared/forge'
import { readPermissions } from '../permissions'
import { toMessage } from '../../lib/errors'
import { behindOf } from './behind'
import { isDummy, slotLine } from './dummy'
import { fillFromPlans } from './layoutfill'
import { originNow } from './originpick'
import { rscCount } from './rsccount'
import { loadForge } from './runtime'
import { poppler } from './poppler'
import { finishedOf } from './boardwork'
import { shotsOf } from './shot'
import { needsShot } from './shotfirst'

/** 아예 시작도 못 했을 때. 모르는 것은 모른다고 담아 돌려준다 — 화면이 멈추지 않게. */
function blank(code: string, error?: string): Prepare {
  const why = error ?? ''
  return {
    code,
    layout: { ok: false, module: '', origin: '', slot: '', verdict: '', why, sameSlot: false, alt: [] },
    rsc: { dir: '', exists: false, files: [], ...(error ? { error } : {}) },
    need: [],
    write: { dir: '', writable: null, why },
    hasSpec: false,
    planReader: '',
    shots: 0,
    needsShot: false,
    written: false,
    finished: null,
    ...(error ? { error } : {})
  }
}

export async function prepare(code: string): Promise<Prepare> {
  let forge: Awaited<ReturnType<typeof loadForge>>
  try {
    forge = await loadForge()
  } catch (error) {
    return blank(code, toMessage(error))
  }
  const { api, paths } = forge

  const out = blank(code)

  // ─ 배치표 — 어느 모듈, 어느 원본 ─
  // 못 정하는 것이 잘못이 아니다. 「갈림」인 차시는 사람이 정해야 한다.
  let pick = api.layoutFor(code)
  // 갈린 MA 칸은 그 학습코드에 이미 놓인 기획서의 모듈넘버로 먼저 채운다 (M7 · `layoutfill.ts`) — 묻기 전에 알 수 있는 것은 안 묻는다.
  // 작업대에 넣은 기획서(`PlanDrop` 이 다시 읽게 한다)와 진행판에 같은 기획서를 또 놓은 칸이 여기서 풀린다.
  // 2026-10-08 까지는 이전 방식의 `run.ts` 가 열 때마다 했다. pdftotext 가 메인 스레드를 잡으므로 갈린 MA 칸에서만 부른다
  if (!pick.ok && code.startsWith('MA')) {
    const filled = await fillFromPlans(forge, code).catch(() => '')
    if (filled) pick = api.layoutFor(code)
  }
  if (pick.ok) {
    // 원본은 만들 때 쓰는 원본 — 받은 그림 크기로 바꾼 것까지(`originNow`). 받을 리소스 창 · 원본 변경 · 부족 개수가 같은 원본을 본다
    const now = originNow(forge, code)
    const fit = typeof now === 'string' ? null : now
    out.layout = {
      ok: true,
      module: pick.module,
      origin: fit?.origin || pick.origin,
      slot: pick.slot,
      verdict: pick.verdict,
      why: fit?.fitNote ? `${pick.why} ${fit.fitNote}` : pick.why,
      sameSlot: pick.sameSlot,
      alt: pick.alt
    }
  } else {
    out.layout.why = pick.error ?? '모듈을 정하지 못했습니다.'
    // **왜 못 정했는지까지 말한다** (5단계). 「갈림」은 앞선 호마다 모듈이 달라
    // 기계가 못 고르는 것뿐이라 **사람이 고르면 끝난다** — 진행판의 「모듈 선택이 필요한
    // 학습코드」 카드가 그 자리다(2026-10-08 까지는 이전 방식의 카드). 화면이 그 칸을 닫아 걸면 안 된다.
    try {
      const at = forge.layout.placementFor(code)
      if (at) {
        out.layout.verdict = at.verdict
        out.layout.slot = at.slot
        // 모듈은 정했는데 그 모듈을 쓴 학습코드가 아직 하나도 없다 — 새 모듈의 첫 학습코드다(M38_1 · M38_2).
        // 원본이 없어 대화로는 못 만들지만, 세션에서 만든 것을 미리보기 · 검수 완료는 해야 한다. 안 그러면 개발 완료로 못 넘긴다
        if (at.module && at.verdict !== '갈림' && at.verdict !== '없음' && forge.layout.originChoices(code).choices.length === 0) {
          out.layout.module = at.module
          out.layout.first = true
          out.layout.why = `${at.module} 모듈로 만든 첫 학습코드라 원본이 없습니다.`
        }
      }
    } catch {
      // 배치표를 읽다 또 넘어지면 위 `why` 만 남는다.
    }
  }

  // ─ 스펙이 있나 ─
  if (out.layout.module) {
    const subject = code.slice(0, 2)
    const one = api.spec(subject, out.layout.module) as { ok?: boolean }
    out.hasSpec = one.ok !== false
    out.needsShot = needsShot(forge, subject, out.layout.module)
  }

  // ─ 리소스 폴더와 거기 놓인 파일 ─
  // **폴더를 여기서 만들지 않는다.** 화면의 「폴더 만들고 열기」가 할 일이다.
  // 화면을 열어 보기만 해도 남의 디스크에 폴더가 생기면 안 된다.
  const listing = api.files(code)
  if (listing.ok) {
    out.rsc = { dir: listing.dir, exists: listing.exists, files: listing.files as RscFile[] }
    out.shots = listing.exists ? shotsOf(listing.dir).length : 0
  } else {
    out.rsc.error = listing.error
  }

  // ─ 원본과 견준 모자란 것 ─
  // 원본을 통째로 떠 와서 그 파일 수와 지금 파일 수를 갈래별로 견준다(2026-10-01 까지는 별칭 수였다).
  if (out.layout.ok && out.layout.origin) {
    const cloned = api.clone(out.layout.origin, code)
    // 세는 곳은 `rsccount.ts` 하나 — 진행판 · 관리가 같은 수를 본다
    if (cloned.ok) out.need = rscCount(cloned.recipe, out.rsc.files).map(({ kind, origin, here }) => ({ kind, origin, here }))
    else out.needError = cloned.error
  } else if (out.layout.first) {
    out.needError = '첫 학습코드라 비교할 원본이 없습니다.'
  } else if (out.layout.why) {
    out.needError = '원본이 정해지지 않아 비교할 수 없습니다.'
  }

  // 이전 방식의 「만들어 봤나」(`run.json`)와 「열면 한 번 저절로 만들기」(M3)는 2026-10-08 에 걷었다 — 대화는 사람이 눌러 시작한다

  // ─ 기획서를 읽을 poppler ─ 실제로 돌려 본다(M5). 못 돌면 기획서 칸이 「기획서를 못 읽음」을 띄운다
  out.planReader = poppler().why
  out.finished = finishedOf(forge, code)

  // ─ 쓰기 권한 ─
  // 양산이 실제로 파일을 쓰는 자리는 액티비티 폴더다. 그 폴더는 아직 없을 수
  // 있으므로 **만들어질 자리(부모)** 의 권한을 본다.
  const month = /M(\d\d)/.exec(code)?.[1]
  if (month) {
    const repo = join(paths.workRoot(), `sparkon_m${month}`)
    const parent = join(repo, 'src', 'activity')
    // 그 자리의 형편 · 원격보다 뒤처졌나 (M7) — 열 때 한 번. 진행판 칸마다 git 을 부르면 72칸이 느려진다
    const [perm, seed, late] = await Promise.all([
      readPermissions(parent),
      existsSync(join(parent, code)) ? isDummy(repo, code) : null,
      existsSync(join(repo, '.git')) ? behindOf(repo) : null
    ])
    out.write = {
      dir: parent,
      writable: perm.writable,
      why:
        perm.error ??
        (perm.writable === null
          ? '쓰기 권한을 확인하지 못했습니다.'
          : perm.writable
            ? `${perm.currentUser ?? '현재 사용자'} 계정으로 쓸 수 있습니다.`
            : `${perm.currentUser ?? '현재 사용자'} 계정에는 쓰기 권한이 없습니다.`),
      slot: slotLine(seed),
      dummy: seed?.dummy ?? false,
      behind: late?.behind ?? null,
      behindNote: late?.note ?? '호 저장소가 git 저장소가 아닙니다.'
    }
    out.written = seed !== null && !seed.dummy
  } else {
    out.write.why = '학습코드에서 호를 읽지 못했습니다.'
  }

  return out
}
