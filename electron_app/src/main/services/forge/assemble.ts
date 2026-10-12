/**
 * 만들 것을 **모은다** — 배치표 → 원본 떠 오기 → 리소스 맞추기 → 사람이 정한 값.
 *
 * **만들어 보기(`--dry`)와 실제 쓰기가 같은 이것을 쓴다.** 두 벌로 두면
 * 「--dry 는 통과했는데 쓸 때는 다른 값이 들어간다」가 되고, 그것은 파일이
 * 이미 쓰인 뒤에야 드러난다.
 *
 * **앞 걸음이 넘어지면 거기서 멈춘다.** `prepare.ts` 와 반대다. 저쪽은 보여
 * 주기만 해서 자리마다 따로 실패해도 되지만, 여기는 앞 걸음의 결과를 뒤가
 * 받아 쓴다 — 원본을 못 떠 왔는데 맞추기를 돌리면 「0개 맞음」이라는 헛말이 난다.
 *
 * forge 를 부르는 규칙은 `runtime.ts` 하나뿐이다 — 여기서 `@/gen/...` 을 직접
 * import 하지 않는다. Electron 도 import 하지 않는다(services 규칙).
 */

import { dropAnswers, readAnswers } from './answer'
import { fixFamilies } from './assemblefamily'
import { applyValues } from './assemblevalues'
import { logCarried, pruneCarried } from './carrylog'
import { carryNote, carrySame } from './carryrsc'
import { fitOrigin } from './originfit'
import { sizeNote, withSizes, type SizeGroup } from './sizematch'
import { commonNote, copyCommon, freshNote } from './commonrsc'
import { pullCommonPlans } from './sortpaper'
import type { OriginDrop } from './originonly'
import { placeFromShots, placeNote, type ShotPlace } from './shotcoords'
import { fitSizes } from './imgsize'
import { settleNames } from './rscname'
import type { Step } from './step'
import type { Forge } from './runtime'
import { useWhole, type WholeUse } from './whole'
import type { SlotJudge } from '@/gen/reslot'
import type { Spec } from '@/gen/types'

/** 배치표가 실제로 정해 준 것. 못 정한 갈래는 걸음에서 이미 넘어졌다. */
export type Pick = Extract<ReturnType<Forge['api']['layoutFor']>, { ok: true }>

export interface Assembled {
  pick: Pick
  /** 크기 짝(`sizematch.ts`)이 실려 있다 — 같은 크기 묶음은 차례 카드가 된다 (`askasset.ts`) */
  swapped: ReturnType<Forge['swap']['swapResources']> & { sized?: { groups: SizeGroup[] } }
  /** 못 맞춘 자리를 갈래별로 가린 것. 가리지 못했으면 빈 배열 */
  judged: SlotJudge[]
  /** 그 모듈의 스펙. 못 읽었으면 null — 뒤에서 여러 곳이 쓰므로 한 번만 읽는다 */
  spec: Spec | null
  /** **원본을 떠 온 그대로의 값** — 맞추기도 답도 얹기 전. 「원본에서 그대로 온 값인가」의 출발점(`answerkey.ts`) */
  cloned: unknown
  /** 원본에만 있던 자리라 뺀 것 — 화면이 「되살리기」를 보인다 (`originonly.ts`) */
  dropped: OriginDrop[]
  /** 원본을 떠 온 레시피 통째 — 도구가 무엇을 바꿨나를 여기서부터 센다 (`changes.ts`) */
  start: unknown
  /** figma 화면으로 좌표를 넣은 것 — 화면이 없으면 null. 비교 캔버스가 화면마다의 이닝을 여기서 읽는다 (M6) */
  placed: ShotPlace | null
  /** AI 가 통째로 만든 레시피를 썼으면 그 기록 (`whole.ts`) — 그때 자리 · 짜임 카드는 옛 레시피 것이라 안 낸다 */
  whole: WholeUse | null
}

export async function assemble(code: string, forge: Forge, step: Step): Promise<Assembled> {
  const { api, paths, swap: swapper } = forge

  // ─ ① 배치표 — 어느 모듈, 어느 원본 ─
  const pick = await step(
    '배치표',
    () => {
      const p = api.layoutFor(code)
      if (!p.ok) throw new Error(p.error ?? '모듈을 정하지 못했습니다.')
      if (!p.module || !p.origin) throw new Error(p.why || '모듈이나 원본이 비어 있습니다.')
      // 같은 모듈도 판이 갈린다 — 받은 그림 크기가 더 맞는 같은 칸 원본이 있으면 그것을 뜬다 (`originfit.ts`)
      const fit = fitOrigin(forge, code, p.origin, p.alt)
      return fit ? { ...p, origin: fit.origin, fitNote: fit.note } : { ...p, fitNote: '' }
    },
    (p) => ({
      name: '배치표',
      // 「갈림」은 사람이 정해야 하는 자리다. 첫 후보로 밀고 나가되 그렇다고 말한다.
      state: p.verdict === '갈림' || !p.sameSlot ? 'warn' : 'ok',
      note:
        `${p.module} 모듈과 원본 ${p.origin} 학습코드를 사용합니다 (${p.verdict}).` +
        (p.fitNote ? ` ${p.fitNote}` : '') +
        (p.sameSlot ? '' : ' 원본이 다른 위치(레벨, 주, 순서)의 학습코드라 값의 구조가 다를 수 있습니다.')
    })
  )

  // ─ ② 원본 떠 오기 ─
  // 맞추기(`swapResources`)가 안에서 또 떠 온다. 그래도 여기서 한 번 부르는
  // 까닭은 **실패를 가려내려는 것**이다 — 맞추기는 클론이 넘어지면 그대로
  // 던져서, 원본을 못 읽은 것인지 리소스를 못 맞춘 것인지 구별이 안 된다.
  const clone = await step(
    '원본 떠 오기',
    () => {
      const c = api.clone(pick.origin, code)
      if (!c.ok) throw new Error(c.error)
      return c
    },
    (c) => ({
      name: '원본 떠 오기',
      state: c.notes.length ? 'warn' : 'ok',
      note: c.notes.length ? c.notes.join(' ') : `${c.from} 학습코드의 값을 그대로 가져왔습니다.`
    })
  )

  // ─ ②.5 공용 파일 가져오기 ─ 맞추기가 짝을 짓도록 **그 앞에서** 폴더에 넣는다 (`commonrsc.ts`)
  // 공용 EN 기획서도 여기서 가져온다(M5, `sortpaper.ts`) — 걸음 이름을 늘리지 않으려고 같은 걸음에 싣는다
  await step(
    '공용 파일 가져오기',
    // 돌려 쓰는 파일은 `carryrsc.ts`, 새 판이 다른 이름으로 와 있으면 둘 다 옛 판을 안 가져온다(forge `commonfresh.ts`).
    // 원본이 바뀌었으면 옛 원본에서 가져온 파일부터 휴지통으로(`carrylog.ts`)
    async () => {
      const dir = forge.files.rscDir(code) ?? ''
      const pruned = dir ? await pruneCarried(forge.paths.REPO_ROOT, code, pick.origin, dir) : []
      const fresh = forge.commonfresh.freshPictures(pick.origin, dir)
      const files = copyCommon(forge, pick.origin, code, pick.module, fresh)
      const carried = carrySame(forge, pick.origin, code, clone.recipe, fresh)
      if (dir) logCarried(forge.paths.REPO_ROOT, code, pick.origin, dir, [...files.took.map((t) => t.rel), ...carried.took])
      return { files, carried, plans: pullCommonPlans(forge, code, pick.module), fresh, pruned }
    },
    ({ files: r, carried, plans, fresh, pruned }) => ({
      name: '공용 파일 가져오기',
      state: r.error || r.failed.length || carried.failed.length ? 'warn' : 'ok',
      note: [
        pruned.length ? `원본이 바뀌어 이전 원본에서 가져온 파일 ${pruned.length}개를 휴지통으로 옮겼습니다.` : '',
        commonNote(r, pick.origin),
        carryNote(carried, pick.origin),
        freshNote(fresh),
        plans.length ? `공용 기획서를 가져왔습니다 (${plans.join(', ')}).` : ''
      ].filter(Boolean).join(' ')
    })
  )

  // ─ ③ 이름으로 맞추기 ─
  const swapped = await step(
    '이름으로 맞추기',
    // 이름으로 못 맞춘 그림은 크기로 한 번 더 — 딱 떨어지는 것만 넣는다 (`sizematch.ts`)
    () => withSizes(forge, swapper.swapResources(pick.origin, code)),
    (s) => {
      const slots = s.hits.length + s.misses.length + s.sized.taken.length
      const bySize = sizeNote(s.sized)
      return {
        name: '이름으로 맞추기',
        state: s.misses.length ? 'warn' : 'ok',
        note:
          `${slots}개 항목 중 ${s.hits.length}개를 맞췄습니다.` +
          (bySize ? ` ${bySize}` : '') +
          (s.misses.length ? ` 맞추지 못한 ${s.misses.length}개 항목은 원본 이름을 그대로 둡니다.` : '') +
          (s.spare.length ? ` 폴더에 남은 파일이 ${s.spare.length}개 있습니다.` : '')
      }
    }
  )

  // ─ ③.1 파일 이름을 원본 이름으로 ─ 이름이 다르게 온 영상 · 사람이 고른 파일 (`rscname.ts`).
  // 바꾼 게 있으면 **맞추기를 한 번 더** 돌린다 — 이제 ①(그대로)로 짝이 지어진다.
  // **스펙은 여기서 한 번만 읽는다.** 자리 세우기(갈래 가리기)·답 얹기·요구
  // 카드가 다 같은 스펙을 본다. 자리마다 읽으면 같은 파일을 네 번 읽고,
  // 「스펙이 없다」를 세는 자리가 넷으로 늘어난다.
  const got = api.spec(code.slice(0, 2), pick.module)
  const spec = 'ok' in got && got.ok === false ? null : (got as Spec)

  const named = settleNames(forge, code, swapped, readAnswers(paths.REPO_ROOT, code).answers, spec)
  if (named.renamed.length || named.removed.length || named.clash.length || named.failed.length) {
    await step(
      '파일 이름 맞추기',
      () => named,
      (r) => ({ name: '파일 이름 맞추기', state: r.clash.length || r.failed.length ? 'warn' : 'ok', note: r.note })
    )
  }
  if (named.renamed.length || named.removed.length || named.consumed.length) {
    dropAnswers(paths.REPO_ROOT, code, named.consumed)
    Object.assign(swapped, swapper.swapResources(pick.origin, code))
  }

  // ─ ③.2 그림 크기 맞추기 ─ 스펙이 크기를 정한 그림(영상 썸네일 1280×720) (`imgsize.ts`).
  // 이름이 맞춰진 **뒤**다 — `thumb.png` 가 되어야 스펙의 자리와 이어진다.
  // 원본 그림의 딱 두 배로 온 것(2x 내보내기)도 원본 크기로 — 사용자 규칙 (2026-09-30)
  const fitted = fitSizes(forge, code, swapped, spec, { code: pick.origin, recipe: clone.recipe })
  if (fitted.note) {
    await step(
      '그림 크기 맞추기',
      () => fitted,
      (r) => ({ name: '그림 크기 맞추기', state: r.odd.length ? 'warn' : 'ok', note: r.note })
    )
  }

  // ─ ③.45 ~ ③.49 이름으로 맞춘 뒤 무리를 손본다 ─ 차례와 까닭은 `assemblefamily.ts`
  // **답은 여기서 읽는다.** ③.46 이 「이미 정해진 형제」를 증인으로 쓰므로 자리 세우기보다 먼저 있어야 한다.
  const kept = readAnswers(paths.REPO_ROOT, code).answers
  const families = await fixFamilies({ code, forge, step, module: pick.module, swapped, spec, kept })

  // ─ ③.5 ~ ③.6 자리 가리기 · 자리 세우기 · 칸 수 맞추기 · 사람이 정한 값 ─ `assemblevalues.ts`
  const judged = await applyValues({ code, forge, step, module: pick.module, origin: pick.origin, start: clone.recipe, swapped, spec, kept, families })

  // ─ ⑤ 좌표는 figma 화면으로 ─ **사람이 정한 값 뒤**다 — 정답표가 이 회차 것이어야 칸마다 그림을 안다 (`shotcoords.ts`)
  const placed = placeFromShots(forge, code, swapped, spec, kept, clone.recipe.gameData)
  if (placed) {
    await step('화면으로 좌표 넣기', () => placed, (p) => ({ name: '화면으로 좌표 넣기', state: p.slot || p.notes.length ? 'warn' : 'ok', note: placeNote(p) }))
  }

  // ─ ⑥ 통째로 맡긴 것이 맞으면 그것을 쓴다 ─ 사람 답은 그 위에 (`whole.ts`, 2026-10-02 사용자 결정)
  const whole = await useWhole(forge, code, pick, swapped, spec?.gameData?.root ?? '', step)
  return { pick, swapped, judged, spec, cloned: clone.recipe.gameData, dropped: families.only.dropped, start: clone.recipe, placed, whole }
}
