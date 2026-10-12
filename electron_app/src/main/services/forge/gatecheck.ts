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
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { GateResult, GateRow } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { activities } from './hallwalk'
import { loadForge } from './runtime'

/** 이만큼 잴 때마다 한 번 쉰다 — 한 개가 5ms 안팎이다 */
const BREATHE = 20
const ISSUES_SHOWN = 3

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

/** 지난번에 잰 것. 안 쟀으면 `at: null` */
export async function lastGate(): Promise<GateResult> {
  try {
    const at = await fileOf()
    if (!existsSync(at)) return blank()
    return JSON.parse(readFileSync(at, 'utf8')) as GateResult
  } catch (error) {
    return blank(toMessage(error))
  }
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
    const { api, paths } = await loadForge()
    const done = activities(paths.workRoot()).filter((a) => a.finished === true)
    const out: GateResult = { ...blank(), finished: done.length }
    for (let i = 0; i < done.length; i += 1) {
      if (i % BREATHE === 0) await new Promise((ok) => setImmediate(ok))
      const a = done[i] as (typeof done)[number]
      try {
        const cloned = api.clone(a.code, a.code)
        if (!cloned.ok) {
          out.unmeasured.push({ code: a.code, why: cloned.error })
          continue
        }
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
