/**
 * **리소스 폴더 한 번에 정리** — 진행판 맨 위 (2026-10-14 사용자 말 — 「모든 학습코드 리소스 정리 버튼을 메인화면에 놔도 될 듯,
 * 매 학습코드 내에 리소스 정리 버튼은 없애고」). 작업대 검수 칸의 단추(2026-10-12)를 걷고 여기로 옮겼다.
 *
 * 학습코드 하나의 셈과 옮기기는 그대로 `rscclean.ts` 다 — 조건(개발 완료 · 내 것 · 대화 안 돎 · 호 저장소 커밋 끝)도 거기 하나다.
 * 여기는 리소스 자리(`rscRoot`) 아래 학습코드 폴더를 훑어 그 셈을 부르고, 옮길 수 있는 것과 못 하는 것을 가른다.
 * 남이 끝낸 학습코드는 여기서 풀지 않는다(`force` 없음) — 작업대의 「그래도 고치기」는 그 학습코드 하나에만 있다.
 *
 * - 리소스 자리를 안 정했으면(리소스 폴더가 곧 호 저장소 안) 하지 않는다 — 그것은 완성본 자체다
 * - 옮길 때는 학습코드마다 **다시 재고 화면에 보인 항목만** 옮긴다(`cleanRsc`)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import type { RscCleanAll, RscCleanAllDone } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { cleanRsc, rscCleanPlan } from './rscclean'
import { loadForge } from './runtime'

const CODE = /^[A-Z]{2}L\d+M\d{2}W\d+S\d+$/
/** 한꺼번에 재는 학습코드 수 — 학습코드마다 호 저장소 git status 가 하나씩 돈다 */
const AT_ONCE = 6

const total = (entries: { size: number }[]): number => entries.reduce((n, e) => n + e.size, 0)

export async function rscCleanAll(): Promise<RscCleanAll> {
  const out: RscCleanAll = { root: '', ready: [], blocked: [], clean: 0 }
  try {
    const forge = await loadForge()
    out.root = forge.files.rscRoot()
    if (!out.root) return { ...out, error: '리소스 폴더 자리를 정하지 않아 정리할 것이 없습니다. 지금 리소스는 호 저장소 안에 있습니다.' }
    if (!fs.existsSync(out.root)) return { ...out, error: `리소스 폴더(${out.root})가 없습니다.` }
    const codes = fs
      .readdirSync(out.root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && CODE.test(e.name))
      .map((e) => e.name)
      .sort()
    for (let i = 0; i < codes.length; i += AT_ONCE) {
      const plans = await Promise.all(codes.slice(i, i + AT_ONCE).map(async (code) => ({ code, plan: await rscCleanPlan(code) })))
      for (const { code, plan } of plans) {
        if (plan.error) out.blocked.push({ code, why: plan.error, size: 0 })
        else if (!plan.entries.length) out.clean++
        else if (plan.why) out.blocked.push({ code, why: plan.why, size: total(plan.entries) })
        else out.ready.push({ code, entries: plan.entries })
      }
    }
    return out
  } catch (error) {
    return { ...out, error: toMessage(error) }
  }
}

/** 두 번째 누름 — `shown` 화면이 보인 `<학습코드>/<항목 이름>`. 학습코드마다 다시 재고 겹치는 것만 휴지통으로 */
export async function cleanRscAll(shown: string[]): Promise<RscCleanAllDone> {
  const byCode = new Map<string, string[]>()
  for (const k of shown) {
    const at = k.indexOf('/')
    const code = k.slice(0, at)
    if (at > 0 && CODE.test(code)) byCode.set(code, [...(byCode.get(code) ?? []), k.slice(at + 1)])
  }
  const out: RscCleanAllDone = { rows: [] }
  try {
    for (const [code, names] of byCode) {
      const r = await cleanRsc(code, names)
      out.rows.push({ code, moved: r.moved.length, failed: r.failed, ...(r.error ? { error: r.error } : {}) })
    }
    return out
  } catch (error) {
    return { ...out, error: toMessage(error) }
  }
}
