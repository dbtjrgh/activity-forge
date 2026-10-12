/**
 * **학습코드별 기록 표** — 사람 손 · AI 부름 · 값 · 캐시 읽기 · 걸린 때 (2026-09-30, M9 의 「학습코드당 표」).
 *
 * 세는 것은 `measure.ts` 가 이미 `_recipe/<코드>.run.json` 에 쌓는다. 여기는 **읽기만** 한다 — 판(`now` · `past`)을 다 더한다.
 * 채팅 방식과 견주려는 표라(`_document/차례표.md` 「왜 채팅 대신 앱인가」) 한 학습코드의 모든 판을 합친다 —
 * 다시 만든 판까지가 그 학습코드를 만드는 데 든 손이다.
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { RunRow } from '../../../shared/forge'
import type { RunPass } from './measure'
import { readRun } from './measure'
import { loadForge } from './runtime'

export async function runTable(subject: string, issue: string): Promise<RunRow[]> {
  const forge = await loadForge()
  const dir = path.join(forge.paths.REPO_ROOT, '_recipe')
  const pat = new RegExp(`^(${subject}L\\dM${issue}W\\dS\\d)\\.run\\.json$`)
  let names: string[] = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  const out: RunRow[] = []
  for (const name of names) {
    const code = pat.exec(name)?.[1]
    const log = code ? readRun(forge.paths.REPO_ROOT, code) : null
    if (!code || !log) continue
    const passes: RunPass[] = [...log.past, log.now]
    const count = new Map<string, number>()
    for (const m of passes.flatMap((p) => p.marks)) count.set(m.what, (count.get(m.what) ?? 0) + 1)
    const spent = passes.map((p) => p.spent).filter((s) => s !== undefined)
    const sum = (f: (s: (typeof spent)[number]) => number): number | null => (spent.length ? spent.reduce((a, s) => a + f(s), 0) : null)
    out.push({
      code,
      touches: passes.reduce((a, p) => a + p.marks.length, 0),
      what: [...count].map(([w, n]) => `${w} ${n}`).join(', '),
      calls: sum((s) => s.calls),
      cost: sum((s) => s.cost),
      cacheRead: sum((s) => s.cacheRead),
      tokens: sum((s) => s.input + s.cacheWrite + s.cacheRead + s.output),
      seconds: passes.reduce((a, p) => a + (p.seconds ?? 0), 0),
      wrote: passes.some((p) => p.wrote)
    })
  }
  return out.sort((a, b) => a.code.localeCompare(b.code))
}
