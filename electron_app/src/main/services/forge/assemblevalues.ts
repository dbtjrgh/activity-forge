/**
 * 만들 것 모으기(`assemble.ts`)의 **③.5 ~ ③.6 — 자리를 가리고 세운 뒤 사람이 정한 값을 얹는 걸음들**
 * (2026-09-30 에 `assemble.ts` 에서 옮김, 409줄이라. 동작 변화 없음 — 걸음 이름 · 차례 그대로, 걸음은 얼렸다).
 *
 * 자리 가리기 → 자리 세우기 → 칸 수 맞추기 → 사람이 정한 값. **값보다 칸이 먼저, 칸보다 자리가 먼저다.**
 *
 * forge 를 부르는 규칙은 `runtime.ts` 하나뿐이다. Electron 도 import 하지 않는다(services 규칙).
 */

import type { Answer } from '../../../shared/forge'
import { SLOT_PREFIX } from '../../../shared/forge'
import { applyAnswers } from './answer'
import type { Assembled } from './assemble'
import type { Families } from './assemblefamily'
import { applyCells, isCellsAnswer } from './cells'
import { dropOrphans, followIndexes, namesIn } from './cellsindex'
import type { Forge } from './runtime'
import { judgeMisses, restockSlots } from './slots'
import type { Step } from './step'

type Ctx = {
  code: string
  forge: Forge
  step: Step
  module: string
  origin: string
  /** 원본을 떠 온 그대로의 레시피 — 배율을 다시 셈할 때 원본 값과 원본 그림을 본다 */
  start: Parameters<Forge['rescale']['rescale']>[1]
  swapped: Assembled['swapped']
  spec: Assembled['spec']
  kept: Answer[]
  families: Families
}

export async function applyValues({ code, forge, step, module, origin, start, swapped, spec, kept, families }: Ctx): Promise<Assembled['judged']> {
  // ─ ③.5 자리가 갈리는 것 ─
  // **묻기 전에 가린다.** 못 맞춘 자리의 61%는 이 회차에 없어질 낱말 자리라
  // 「그 파일을 주세요」가 답이 없는 물음이 된다 (`slots.ts` 머리말).
  const judged = judgeMisses(forge, code, module, swapped)
  const picked = kept.filter((a) => a.path.startsWith(SLOT_PREFIX))
  if (judged.length) {
    await step(
      '자리 가리기',
      () => forge.reslot.countBy(judged),
      (n) => ({
        name: '자리 가리기',
        state: n['모름'] ? 'warn' : 'ok',
        note:
          `맞추지 못한 항목 ${judged.length}개를 분류했습니다. 리소스가 없는 항목 ${n['고정']}개, ` +
          `이번 회차에 없어질 항목 ${n['낱말']}개, 개수가 다를 수 있는 항목 ${n['개수']}개, 분류하지 못한 항목 ${n['모름']}개입니다.`
      })
    )
  }

  // 사람이 고른 것이 있으면 그것으로 자리를 세운다. 없으면 걸음을 안 낸다 —
  // 아직 아무것도 안 정한 사람에게 「0자리 세웠습니다」를 보일 까닭이 없다.
  // **파일만 답한 꼴도 넘긴다** — 이름을 바꿔야 하는 자리는 거기서 가린다 (`slots.ts`)
  // **한 것이 없으면 걸음을 안 낸다** — AI 답이 파일만 준 판마다 「0자리를 세웠습니다」가 뜨던 것
  const restocked =
    picked.length || kept.some((a) => a.path.startsWith('assets.')) ? restockSlots(forge, swapped, judged, kept, spec, code) : null
  const renamed = restocked?.renamed ?? []
  if (restocked && (restocked.casts.length || restocked.kept.length || restocked.missed.length || restocked.unsure.length)) {
    await step(
      '자리 세우기',
      () => restocked,
      (r) => ({
        name: '자리 세우기',
        state: r.unsure.length || r.missed.length ? 'warn' : 'ok',
        note:
          `${r.casts.length}개 항목을 새 이름으로 만들었습니다 (assets ${r.assets}개, 값 ${r.data.length}개).` +
          // 이름을 바꾸면 모듈이 못 찾는 자리 — 파일만 갈았다 (`rolename.ts`)
          (r.kept.length
            ? ` ${r.kept.length}개 항목은 이름을 유지하고 파일만 바꿨습니다 (${r.kept.slice(0, 3).join(', ')}).`
            : '') +
          (r.unsure.length
            ? ` 종류를 판단하지 못해 그대로 둔 항목이 ${r.unsure.length}개 있습니다 (${r.unsure.slice(0, 2).join(', ')}).`
            : '') +
          (r.missed.length ? ` 만들지 못한 항목이 ${r.missed.length}개 있습니다 (${r.missed.slice(0, 2).join(', ')}).` : '')
      })
    )
  }

  // ─ ③.55 칸 수 맞추기 ─
  // **값보다 먼저다.** `inningData` 가 6칸이 된 뒤에야 `inningData[5].word` 에
  // 값을 넣을 자리가 생긴다 (`cells.ts`).
  const sized = kept.filter(isCellsAnswer)
  // 칸을 잘라 아무도 안 부르게 된 별칭 — 그 자리의 답도 아래에서 걷어낸다 (`cells.ts`)
  let orphaned: string[] = []
  if (sized.length) {
    const before = namesIn(swapped.recipe)
    const fixed = new Set((spec?.assets.required ?? []).filter((r) => r.fixedAlias).map((r) => r.alias))
    await step(
      '칸 수 맞추기',
      () => {
        const r = applyCells(swapped.recipe, sized, spec?.gameData?.root ?? '', spec?.relations ?? [])
        // 자른 목록의 번호를 들고 있던 꼬리 칸도 (`cellsindex.ts`)
        r.done.push(...followIndexes(swapped.recipe, r.done, spec?.relations ?? [], spec?.gameData?.root ?? ''))
        if (r.done.some((d) => d.to < d.from)) orphaned = dropOrphans(swapped.recipe, before, fixed)
        return r
      },
      (r) => ({
        name: '칸 수 맞추기',
        state: r.refused.length ? 'warn' : 'ok',
        note:
          (r.done.length
            ? `개수를 바꿨습니다 (${r.done.map((d) => `${d.path} ${d.from}→${d.to}개`).join(', ')}).`
            : '바꿀 개수가 없었습니다.') +
          (r.synced.length ? ` 연결된 개수도 맞췄습니다 (${r.synced.join(', ')}).` : '') +
          (orphaned.length
            ? ` 잘린 칸에서만 쓰던 ${orphaned.length}개 항목을 뺐습니다 (${orphaned.map((p) => p.split('.').pop()).join(', ')}).`
            : '') +
          (r.refused.length
            ? ` 맞추지 못한 항목이 ${r.refused.length}개 있습니다 (${r.refused[0].path}: ${r.refused[0].why}).`
            : '')
      })
    )
  }

  // ─ ③.6 사람이 정한 값 얹기 ─
  // **맞추기 뒤, 만들어 보기 앞이다.** 앞에 두면 맞추기가 답을 덮고, 뒤에
  // 두면 답이 검사를 못 받는다. 답이 없으면 걸음을 내놓지 않는다 —
  // 처음 누르는 사람에게 빈 줄을 보일 까닭이 없다.
  //
  // **자리 답은 여기서 뺀다.** `#slot|…` 은 값 자리가 아니라 자리 이름을 갈아
  // 치우는 답이라 위에서 이미 썼다. 섞어 두면 「자리를 못 찾아 못 넣었습니다」로
  // 세어져 사람이 자기 답이 씹힌 줄 안다.
  // **`#` 로 시작하는 답은 레시피 값이 아니다** — 배치표(`#module`)·자리
  // 세우기(`#slot|…`)·확인 표시(`#seen|…`). 섞어서 넘기면 「1개를 얹었습니다」
  // 처럼 세어지거나 「자리를 못 찾아 못 넣었습니다」가 되어, 사람이 자기 답이
  // 씹힌 줄 안다 (2026-09-16 에 `#seen` 이 그렇게 세어지고 있었다).
  // **무리를 갈아 끼우며 없앤 자리의 답은 걷어낸다.** 도구가 없앤 자리인데
  // 「자리를 못 찾아 못 넣었습니다」로 세면, 사람이 자기 답이 씹힌 줄 안다.
  // **이름을 바꿔 세운 자리의 옛 답도** — 이미 그 파일로 세웠다 (`slots.ts`)
  const { famed, trimmed, followed, only } = families
  const gone = new Set([...[...famed, ...trimmed, ...followed].flatMap((f) => f.gonePaths), ...only.gonePaths, ...orphaned, ...renamed])
  const values = kept.filter((a) => !a.path.startsWith('#') && !gone.has(a.path))
  const dropped = kept.filter((a) => gone.has(a.path)).length
  // 그림 크기에 맞춰 정한 배율(스펙 scalesWith) — 원본 값 그대로이고 그림이 원본과 다른 크기면 다시 셈한다(forge rescale.ts).
  // 걸음을 늘리지 않고 이 걸음에 싣는다. 사람 · AI 답은 바로 뒤에 얹혀 이긴다
  const dir = forge.files.rscDir(code)
  const rescaled = spec && dir ? forge.rescale.rescale(spec, start, swapped.recipe, origin, dir) : []
  if (values.length || dropped || rescaled.length) {
    await step(
      '사람이 정한 값',
      () => applyAnswers(swapped.recipe, values, spec?.gameData?.root ?? ''),
      (r) => ({
        name: '사람이 정한 값',
        state: r.missed.length ? 'warn' : 'ok',
        note:
          (rescaled.length ? `그림 크기에 맞춰 배율 ${rescaled.length}개를 다시 계산했습니다(${rescaled[0]?.path} ${rescaled[0]?.from} → ${rescaled[0]?.to}). ` : '') +
          `${r.put}개를 적용했습니다.` +
          (dropped ? ` 이름이 바뀌거나 없어진 항목의 이전 답 ${dropped}개는 뺐습니다.` : '') +
          (r.missed.length
            ? ` ${r.missed.length}개는 항목을 찾지 못해 적용하지 못했습니다 (${r.missed.slice(0, 2).join(', ')}).`
            : '')
      })
    )
  }

  return judged
}
