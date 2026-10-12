/**
 * 「양산 시작」 — 학습코드 하나로 끝까지 돌려 본다.
 *
 *   배치표 → 원본 떠 오기 → 리소스 맞추기 → 사람이 정한 값   (`assemble.ts`)
 *   → 만들어 보기(`--dry`) → 혼자만 다른 것
 *
 * **여기서는 실제로 쓰지 않는다.** 마지막 걸음까지 다 통과해도 `--dry` 에서
 * 멈추고, 왜 멈췄는지를 결과 맨 아래 늘 적는다 — 「통과」만 보이면 파일이
 * 생긴 줄 안다. 실제 쓰기는 `write.ts` 다.
 *
 * 옆 파일들과 이렇게 나눈다 —
 *
 *   `step.ts`      걸음 하나를 돌리고 알리는 뼈대
 *   `assemble.ts`  만들 것을 모으는 앞 네 걸음 (실제 쓰기와 같은 것을 쓴다)
 *   `report.ts`    돌린 결과를 화면이 쓸 만큼만 줄이기
 *   `ask.ts`       막힌 것을 사람에게 하는 요구로 바꾸기
 *   `runasks.ts`   그 요구를 모으는 차례 (원본 장면 · 자리 · 짜임 · 정답 · 변형 판 · 성우)
 *
 * forge 를 부르는 규칙은 `runtime.ts` 하나뿐이다 — 여기서 `@/gen/...` 을 직접
 * import 하지 않는다. Electron 도 import 하지 않는다(services 규칙).
 */

import type { RunResult, RunStep } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { readAnswers } from './answer'
import { assemble } from './assemble'
import { recipeChanges } from './changes'
import { seenIds } from './ask'
import { moduleCard } from './askmodule'
import { fillFromPlans } from './layoutfill'
import { runAsks } from './runasks'
import { readFindings } from './shapestore'
import { madeFiles, reportOdd, reportSwap, tagRelations } from './report'
import { sceneStep } from './scene'
import { staleOf } from './stale'
import { Stop, stepper, type Emit } from './step'
import { loadForge, type Forge } from './runtime'

/** `--dry` 만 돌렸을 때 결과 아래에 늘 붙이는 말 — 한 줄로(2026-09-21, 「실제로 쓰기」 단추가 바로 옆이다) */
export const DRY_ONLY = '아직 저장소에 반영하지 않았습니다.'

/** `again` — 기획서로 배치표를 채운 뒤 한 번 더 도는 판(두 번은 안 돈다) */
export async function runDry(code: string, emit: Emit, again = false): Promise<RunResult> {
  const steps: RunStep[] = []
  const out: RunResult = {
    code,
    ok: false,
    steps,
    issues: [],
    asks: [],
    preview: [],
    wrote: false,
    writeNote: DRY_ONLY
  }

  let forge: Forge
  try {
    forge = await loadForge()
  } catch (error) {
    out.error = toMessage(error)
    return out
  }
  const { api, paths, swap: swapper, odd: oddly } = forge
  const step = stepper(steps, emit)
  // 사람이 「확인했습니다」를 누른 카드. **글이 아니라 누른 사실만** 남는다 (2026-09-16 에 예외 메모를 걷어냈다)
  const kept = readAnswers(paths.REPO_ROOT, code).answers
  const seen = seenIds(kept)
  // AI 가 짚어 둔 「짜임이 다른 자리」. 고쳐서 다시 물으면 갈아치워진다.
  const findings = readFindings(paths.REPO_ROOT, code)

  try {
    const got = await assemble(code, forge, step)
    const { pick, swapped, spec, dropped, start, whole } = got
    // figma 화면과 원본 장면 — 틀렸으면 생성 전에 묻는다 (`scene.ts`). 단계는 늘리지 않고 배치표 줄에 덧붙인다
    const scene = await sceneStep(forge, code, pick.origin, steps, emit)
    out.swap = reportSwap(swapper, swapped)
    // 무엇이 바뀌었나는 **도구가 센다** — 막혀도 센다, 무엇을 하려 했는지 봐야 한다 (`changes.ts`)
    out.changes = recipeChanges(start, swapped.recipe, spec?.gameData?.root ?? '', kept, whole ? 'ai' : 'tool')
    out.dropped = dropped
    if (whole) out.whole = { at: whole.at, notes: whole.notes.map((n) => ({ path: n.path, why: n.why ?? '' })), asks: whole.asks.length, cost: whole.cost, seconds: whole.seconds }

    // ─ 만들어 보기 (`--dry`) ─
    // 스펙에 적은 「관계」(1단계 1-2)가 여기서 함께 돈다 — `resolve.ts` 가
    // `runRelations` 를 부른다. 그래서 걸음을 따로 두지 않고, 낸 것에 표만 붙인다.
    const made = await step(
      '만들어 보기',
      () => {
        const g = api.check(swapped.recipe)
        // 생성기가 아예 못 돈 경우(스펙이 없다·깨졌다)와 검증에 걸린 경우는 다르다.
        // 앞쪽은 걸린 자리가 없고 까닭 한 줄뿐이라 걸음 자체를 넘어뜨린다.
        if ('error' in g) throw new Error(g.error)
        return g
      },
      (g) => {
        const errors = g.issues.filter((i) => i.level === 'error').length
        const warns = g.issues.length - errors
        return {
          name: '만들어 보기',
          state: errors ? 'fail' : warns ? 'warn' : 'ok',
          note: errors
            ? `에러 ${errors}개가 있어 반영할 수 없습니다.`
            : `에러가 없습니다${warns ? `(주의 ${warns}개)` : ''}. 파일 ${Object.keys(g.preview ?? {}).length}개를 생성했습니다.`
        }
      }
    )
    out.issues = tagRelations(spec, made.issues)
    // 사람에게 물을 것 — 차례가 화면 차례다 (`runasks.ts`)
    out.asks = runAsks(forge, code, got, made.issues, { kept, seen, findings, scene })
    // **에러가 나도 담는다.** 통과했으면 `preview`, 막혔으면 `draft` 에 있다(check:repro 가 preview 가 비었나로 가른다)
    out.preview = madeFiles(made.preview ?? made.draft ?? {}, paths, pick.origin)
    // 이미 반영한 것과 다른가 — 반영 뒤에 리소스 · 답을 바꾸면 다시 반영하라고 한다 (`stale.ts`)
    if (made.preview) out.stale = staleOf(forge, code, made.preview, swapped.recipe)
    if (made.issues.some((i) => i.level === 'error')) throw new Stop()
    out.ok = true

    // ─ 혼자만 다른 것 (1단계 1-1) ─
    // **막지 않는다.** 일부러 다르게 만든 자리도 걸리므로 사람이 볼 자리를
    // 좁혀 줄 뿐이다 (`forge/src/gen/odd.ts` 머리말).
    out.odd = await step(
      '혼자만 다른 것',
      () => reportOdd(oddly, code, pick.module),
      (o) => ({
        name: '혼자만 다른 것',
        state: !o.ran ? 'skip' : o.mine.length ? 'warn' : 'ok',
        note: !o.ran
          ? o.note
          : o.mine.length
            ? `같은 모듈 ${o.samples}개와 다른 곳이 ${o.mine.length}군데 있습니다.`
            : `같은 모듈 ${o.samples}개와 다른 곳이 없습니다.`
      })
    )
  } catch (error) {
    if (!(error instanceof Stop)) out.error = toMessage(error)
    // **배치표에서 막힌 것은 오류가 아니라 물음이다** (5단계). 앞선 호마다
    // 모듈이 달라 기계가 못 고르는 자리다 — 사람이 정하면 되는 것을 「양산기가
    // 터졌다」로 보이게 두지 않는다.
    // **기획서가 먼저 와 있으면 그 모듈넘버로 채우고 한 번 더 본다** (M7 · `layoutfill.ts`) — 묻기 전에 알 수 있는 것은 안 묻는다
    const filled = !again && !out.asks.length ? await fillFromPlans(forge, code) : ''
    if (filled) return runDry(code, emit, true)
    if (!out.asks.length) {
      const one = moduleCard(forge, code, out.error ?? "")
      if (one) {
        out.asks = [one]
        out.error = undefined
        // 걸음에 남은 붉은 줄은 명령줄용 문장이라 「_layout 을 손으로 고치세요」로
        // 끝난다. 이제 그 자리에서 고를 수 있으므로 같은 이름으로 다시 보내
        // 짧은 말로 바꾼다 — 화면은 걸음을 이름으로 갈아끼운다.
        const fixed: RunStep = {
          name: '배치표',
          state: 'fail',
          note: '모듈을 정하지 못했습니다. 아래에서 고르세요.'
        }
        const at = steps.findIndex((s) => s.name === '배치표')
        if (at >= 0) steps[at] = fixed
        emit(fixed)
      }
    }
  }

  return out
}
