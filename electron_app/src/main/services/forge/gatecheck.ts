/**
 * **완성본 점검** — 호마다 개발 완료인 액티비티를 전부 스펙 검사에 넣는다 (2026-09-30, 「관리」 화면).
 *
 * forge `tool/donegate.ts` 와 같은 셈이다(`clone(코드, 코드)` → `check`, `asset-file-missing` 은 뺌).
 * 걸린 것은 대개 **그 완성본 쪽 흠**이다(없는 이름을 부름 — 2026-09-30 에 잰 9개가 다 그랬다). 그래서 보여 주기만 하고
 * 고치는 단추는 두지 않는다 — 남의 팀 저장소다.
 *
 * **메인 스레드를 오래 잡지 않는다.** 앱 안에서 853개가 5.3초였는데(2026-09-30), 그동안 온 IPC 가 쌓이면 화면이 멈춘 것처럼 보인다(함정) —
 * 몇 개마다 한 번씩 쉰다. 결과는 `_recipe/_gate.json` 에 남겨, 화면을 열 때는 지난 결과와 그 때를 보인다.
 *
 * **스펙이 바뀌면 하루를 안 기다린다** (2026-10-14). 스펙을 고쳐 막힘을 풀어도 화면은 다음 날까지 옛 「실패」를 보였다 —
 * 지난 결과를 읽을 때 스펙 파일 수정 시각을 보고 다시 잴 까닭(`stale`)을 붙인다. 잴 때는 잰 모듈마다
 * 스펙을 맞춰 본 뒤 공용 모듈이 바뀌었나(`drift`, forge `specdrift.ts`)도 같이 남긴다 — 막지 않는다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { GateResult, GateRow } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { activities } from './hallwalk'
import { loadForge } from './runtime'

/** 이만큼 잴 때마다 한 번 쉰다 — 한 개가 5ms 안팎이다 */
const BREATHE = 20
const ISSUES_SHOWN = 3
/** 이보다 오래된 결과는 다시 잰다 — 호 저장소는 하루에도 몇 번 바뀐다(전에는 화면 `useManage.ts` 에 있던 값) */
const STALE_MS = 24 * 60 * 60_000
const NAMES_SHOWN = 3

const blank = (error?: string): GateResult => ({
  at: null,
  finished: 0,
  passed: 0,
  failed: [],
  unmeasured: [],
  took: 0,
  ...(error ? { error } : {})
})

async function fileOf(): Promise<string> {
  const { paths } = await loadForge()
  return join(paths.REPO_ROOT, '_recipe', '_gate.json')
}

/** 지난번에 잰 것. 안 쟀으면 `at: null`. 다시 잴 까닭이 있으면 `stale` 에 — 파일에는 안 쓴다 */
export async function lastGate(): Promise<GateResult> {
  try {
    const at = await fileOf()
    if (!existsSync(at)) return blank()
    const last = JSON.parse(readFileSync(at, 'utf8')) as GateResult
    const stale = await staleWhy(last.at)
    return stale ? { ...last, stale } : last
  } catch (error) {
    return blank(toMessage(error))
  }
}

/** 스펙이 잰 뒤에 바뀌었으면 그 까닭이 먼저다. 스펙 폴더 자리는 forge `SPEC_ROOT` 하나만 본다 */
async function staleWhy(at: number | null): Promise<string | undefined> {
  if (!at) return undefined
  const { spec } = await loadForge()
  const changed = specsChangedSince(spec.SPEC_ROOT, at)
  if (changed.length) {
    const names = changed.slice(0, NAMES_SHOWN).join(', ') + (changed.length > NAMES_SHOWN ? ' 외' : '')
    return `점검한 뒤 스펙 ${changed.length}장이 바뀌어 다시 점검합니다(${names}).`
  }
  if (Date.now() - at > STALE_MS) return '점검한 지 하루가 지나 다시 점검합니다.'
  return undefined
}

/** 수정 시각이 `at` 보다 늦은 스펙 이름 — 과목 폴더 한 겹(`_common` 포함)만 본다 */
function specsChangedSince(root: string, at: number): string[] {
  const list = (dir: string): string[] => {
    try {
      return readdirSync(dir)
    } catch {
      return []
    }
  }
  const out: string[] = []
  for (const sub of list(root)) {
    for (const f of list(join(root, sub)).filter((x) => x.endsWith('.json'))) {
      try {
        if (statSync(join(root, sub, f)).mtimeMs > at) out.push(f.slice(0, -5))
      } catch {
        // 읽는 사이 지워진 파일 — 셀 것이 없다
      }
    }
  }
  return out.sort()
}

/** 도는 판이 있으면 그것을 같이 기다린다 — 두 번 눌러도 한 번만 잰다 */
let running: Promise<GateResult> | null = null
export function runGate(): Promise<GateResult> {
  running ??= measure().finally(() => {
    running = null
  })
  return running
}

async function measure(): Promise<GateResult> {
  const started = Date.now()
  try {
    const { api, paths, specdrift } = await loadForge()
    const done = activities(paths.workRoot()).filter((a) => a.finished === true)
    const out: GateResult = { ...blank(), finished: done.length }
    const measured: { subject: string; module: string }[] = []
    for (let i = 0; i < done.length; i += 1) {
      if (i % BREATHE === 0) await new Promise((ok) => setImmediate(ok))
      const a = done[i] as (typeof done)[number]
      try {
        const cloned = api.clone(a.code, a.code)
        if (!cloned.ok) {
          out.unmeasured.push({ code: a.code, why: cloned.error })
          continue
        }
        measured.push({ subject: cloned.recipe.subject ?? a.code.slice(0, 2), module: cloned.recipe.module })
        const g = api.check(cloned.recipe)
        if ('error' in g) {
          out.unmeasured.push({ code: a.code, why: g.error })
          continue
        }
        const errs = g.issues.filter((x) => x.level === 'error' && x.rule !== 'asset-file-missing')
        if (!errs.length) {
          out.passed += 1
          continue
        }
        const row: GateRow = {
          code: a.code,
          module: cloned.recipe.module,
          issues: [...new Set(errs.map((e) => `${e.rule} ${e.path}`))].slice(0, ISSUES_SHOWN),
          count: errs.length,
          team: a.team
        }
        out.failed.push(row)
      } catch (error) {
        out.unmeasured.push({ code: a.code, why: toMessage(error) })
      }
    }
    // git 을 모듈마다 비동기로 — 개발 완료 880여 개를 돌아도 모듈은 120개 안쪽이다(forge 에서 2초). 오류는 던지지 않고 그 모듈 글에 담긴다
    const drift = await specdrift.specDrifts(measured)
    out.drift = [...drift].filter(([, d]) => d.drift).map(([module, d]) => ({ module, note: d.note }))
    // 하나도 못 견줬으면(git 이 없음 · 공용 저장소가 없음) 빈 목록을 「바뀐 것 없음」처럼 두지 않는다
    const first = [...drift.values()][0]
    if (first && ![...drift.values()].some((d) => d.known)) out.driftNote = `공용 모듈 변경을 확인하지 못했습니다. ${first.note}`
    out.at = Date.now()
    out.took = out.at - started
    // `_recipe` 는 양산을 한 번도 안 돌린 PC(zip 으로 받은 앱)에는 없다
    const at = await fileOf()
    mkdirSync(dirname(at), { recursive: true })
    writeFileSync(at, JSON.stringify(out, null, 1) + '\n', 'utf8')
    return out
  } catch (error) {
    return { ...blank(toMessage(error)), took: Date.now() - started }
  }
}
