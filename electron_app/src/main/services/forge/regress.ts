/**
 * **빠른 모듈 회귀 검사** (2026-10-15, 「관리」 화면) — 공용 모듈을 고쳤을 때 그 모듈을 쓰는 개발 완료 완성본을 뒤에서 세 개씩 띄워
 * 끝 화면까지 가 보는지 본다. 사람이 미리보기로 하나하나 돌려 보던 일이다.
 *
 * - 대상은 `regresspick.ts`, 호마다 띄우는 vite 는 `regressserve.ts`, 완성본 하나(창 부르기 · 창 상한 · 결과 줄)는 `regressone.ts`,
 *   페이지에 넣는 글은 `regresspage.ts` · `regressdrivers.ts`
 * - 창은 Electron 이 있어야 해서 **부르는 쪽이 넘긴다**(`PageRunner`, `main/regress.ts`) — 여기는 차례 · 전체 상한 · 기록만
 * - 자동 진행이 있는 모듈은 끝 화면까지, 없는 모듈은 첫 이닝까지만 본다 — 짐작으로 「통과」라 하지 않는다(`mode` 를 같이 적는다)
 * - 시계를 `WARP` 배로 돌려 M28 하나가 80초 → 14초(2026-10-15 MAL2M08W2S2 에서 잼: 1배 80초 · 4배 23초 · 8배 14초, 이닝 · 오류 · 404 같음)
 * - 상한 — 한 완성본 시간(`regressone.ts`), 전체 시간(`TOTAL_LIMIT`), 개수(`MAX_TARGETS`), 적은 이름 수(`regresspick.ts`). 걸린 것은 결과에 적는다
 * - 한 번에 한 판만 돈다. 도는 중에 같은 이름으로 부르면 그 판을 같이 기다리고, **다른 이름이면 거절한다**(앞 판의 결과를 주지 않는다)
 * - 결과는 `_recipe/_regress.json` 에 남긴다 — 화면을 다시 열어도 보인다(잰 때 함께)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { RegressProgress, RegressResult, RegressRow } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { modeOf, rowOf, runOne, WARP, type PageRunner } from './regressone'
import { keysOfNames, targetsOf, type RegressTarget } from './regresspick'
import { startRegressServer } from './regressserve'
import { loadForge } from './runtime'

export type { PageRun, PageRunner, PageSnap } from './regressone'

/** 한 번에 띄우는 창 수 — 사람이 같은 PC 에서 양산 중이다 */
const AT_ONCE = 3
const TOTAL_LIMIT = 30 * 60_000
const MAX_TARGETS = 80

let running: Promise<RegressResult> | null = null
/** 도는 판이 받은 이름 — 견주는 꼴(소문자 · 차례 무관)과 보이는 꼴 */
let runningAsk = ''
let runningShown = ''
let progress: RegressProgress = { running: false, done: 0, total: 0, now: [] }
const servers = new Set<ChildProcess>()

export const regressBusy = (): boolean => running !== null
export const regressProgress = (): RegressProgress => ({ ...progress, now: [...progress.now] })

const blank = (error?: string): RegressResult => ({ at: null, modules: [], rows: [], took: 0, warp: WARP, ...(error ? { error } : {}) })
const askOf = (names: string[]): string => [...new Set(names.map((n) => n.trim().toLowerCase()))].sort().join(',')

async function fileOf(): Promise<string> {
  return join((await loadForge()).paths.REPO_ROOT, '_recipe', '_regress.json')
}

/** 지난번 결과. 안 돌렸으면 `at: null` */
export async function lastRegress(): Promise<RegressResult> {
  try {
    const at = await fileOf()
    return existsSync(at) ? (JSON.parse(readFileSync(at, 'utf8')) as RegressResult) : blank()
  } catch (error) {
    return blank(toMessage(error))
  }
}

/** 앱을 끌 때 — 띄운 vite 를 내린다(창은 앱과 같이 닫힌다) */
export function stopRegress(): void {
  for (const c of servers) c.kill()
  servers.clear()
}

/** 도는 판이 있으면 같은 이름일 때만 그것을 같이 기다린다 — 두 번 눌러도 한 번만 돈다. `names` 는 모듈 열쇠(MA/M28)나 이름(M28) */
export function runRegress(names: string[], runner: PageRunner, onProgress: (p: RegressProgress) => void): Promise<RegressResult> {
  if (running && askOf(names) !== runningAsk) return Promise.resolve(blank(`다른 모듈(${runningShown})을 확인하는 중입니다. 끝난 뒤 다시 실행하세요.`))
  if (!running) {
    runningAsk = askOf(names)
    runningShown = names.join(', ')
    running = measure(names, runner, onProgress).finally(() => {
      running = null
      progress = { ...progress, running: false, now: [] }
      onProgress(regressProgress())
    })
  }
  return running
}

/** 상한 알림 한 문장 — 다 돈 뒤 한 번에 만든다(일꾼마다 덮어쓰면 늘 「1개」가 되고 개수 상한 알림도 지워졌다) */
function limitNote(all: number, skipped: number): string {
  const over = all > MAX_TARGETS ? `완성본이 ${all}개라 앞 ${MAX_TARGETS}개만 골랐` : ''
  const late = skipped ? `전체 상한 ${TOTAL_LIMIT / 60_000}분에 걸려 ${skipped}개는 돌리지 않았습니다.` : ''
  return over && late ? `${over}고, 그 가운데 ${late}` : over ? `${over}습니다.` : late
}

async function measure(names: string[], runner: PageRunner, onProgress: (p: RegressProgress) => void): Promise<RegressResult> {
  const started = Date.now()
  try {
    if (!names.length) return blank('모듈 이름을 적지 않았습니다.')
    const forge = await loadForge()
    const { keys, lost, note } = keysOfNames(forge, names)
    if (!keys.length) return { ...blank(`공용 저장소에서 그 모듈을 찾지 못했습니다: ${(lost.length ? lost : names).join(', ')}`), took: Date.now() - started }
    const all = targetsOf(forge, keys)
    // 돌릴 것이 없으면 지난 결과를 덮지 않는다
    if (!all.length) return { ...blank(`${keys.join(', ')} 모듈을 쓰는 개발 완료 완성본이 없습니다.`), modules: keys, took: Date.now() - started }
    const targets = all.slice(0, MAX_TARGETS)
    const out: RegressResult = { ...blank(), modules: keys, ...(note ? { names: note } : {}) }
    progress = { running: true, done: 0, total: targets.length, now: [] }
    onProgress(regressProgress())
    const rows = new Map<string, RegressRow>()
    const left = new Map<string, number>()
    targets.forEach((t) => left.set(t.month, (left.get(t.month) ?? 0) + 1))
    const serving = new Map<string, Promise<{ port: number; child: ChildProcess } | { error: string }>>()
    const serverOf = (t: RegressTarget) => {
      if (!serving.has(t.month)) {
        serving.set(t.month, startRegressServer(t.repo, t.month).then((s) => ('error' in s ? s : (servers.add(s.child), s))))
      }
      return serving.get(t.month) as Promise<{ port: number; child: ChildProcess } | { error: string }>
    }
    const release = async (t: RegressTarget): Promise<void> => {
      left.set(t.month, (left.get(t.month) ?? 1) - 1)
      if ((left.get(t.month) ?? 0) > 0) return
      const s = await serving.get(t.month)
      if (s && !('error' in s)) {
        s.child.kill()
        servers.delete(s.child)
      }
    }
    const queue = [...targets]
    let skipped = 0
    const worker = async (): Promise<void> => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        if (Date.now() - started > TOTAL_LIMIT) {
          skipped += 1
          rows.set(t.code, rowOf(t, modeOf(t), null, `전체 상한 ${TOTAL_LIMIT / 60_000}분에 걸려 돌리지 않았습니다.`))
        } else {
          progress.now.push(t.code)
          onProgress(regressProgress())
          rows.set(t.code, await runOne(t, await serverOf(t), runner))
          progress.now = progress.now.filter((c) => c !== t.code)
        }
        await release(t)
        progress.done += 1
        onProgress(regressProgress())
      }
    }
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, targets.length) }, worker))
    const limited = limitNote(all.length, skipped)
    if (limited) out.limited = limited
    out.rows = targets.map((t) => rows.get(t.code) as RegressRow)
    out.at = Date.now()
    out.took = out.at - started
    const at = await fileOf()
    mkdirSync(dirname(at), { recursive: true })
    writeFileSync(at, JSON.stringify(out, null, 1) + '\n', 'utf8')
    return out
  } catch (error) {
    stopRegress()
    return { ...blank(toMessage(error)), took: Date.now() - started }
  }
}
