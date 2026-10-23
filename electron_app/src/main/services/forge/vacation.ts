/**
 * **방학호와 앞선 호 학습코드의 짝을 읽는다** (2026-10-20 사용자 말 — 「방학호랑 겹치는 원본 호의 학습코드들 따로 표기해놔」).
 *
 * 6호(방학, M11)는 1~5호 학습코드 하나를 거의 통째로 다시 썼다. 칸이 같지 않아 학습코드로는 짝을 모른다 —
 * forge `tool/vacation.ts` 가 리소스를 바이트까지 견주어 `_layout/vacation.json` 에 적는다(커밋하는 자료라 호 저장소를 다 안 받은 PC 도 같다).
 * 여기는 **읽기만** 한다. 진행판을 열 때마다 1GB 넘는 리소스를 다시 재지 않는다.
 * 파일이 없거나 못 읽으면 빈 짝이다 — 짝을 짐작하지 않는다(저장소 규칙 6).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { VacationLink } from '../../../shared/forge'
import type { Forge } from './runtime'

type Pair = { code: string; from: string; same: number; total: number }

/** 파일이 바뀔 때만 다시 읽는다 — 진행판은 30초마다 다시 읽는다 */
let kept: { at: string; mtime: number; links: Map<string, VacationLink[]> } | null = null

const isPair = (p: unknown): p is Pair => {
  const o = p as Partial<Pair> | null
  return typeof o?.code === 'string' && typeof o.from === 'string' && typeof o.same === 'number' && typeof o.total === 'number' && o.total > 0
}

/** 학습코드 → 그 학습코드의 짝들. 방학호 학습코드는 가져온 것 하나, 앞선 호 학습코드는 방학호에 쓰인 것들 */
export function vacationLinks(forge: Forge): Map<string, VacationLink[]> {
  const at = path.join(forge.paths.REPO_ROOT, '_layout', 'vacation.json')
  let mtime: number
  try {
    mtime = fs.statSync(at).mtimeMs
  } catch {
    return new Map()
  }
  if (kept?.at === at && kept.mtime === mtime) return kept.links

  const links = new Map<string, VacationLink[]>()
  const add = (code: string, link: VacationLink): void => {
    links.set(code, [...(links.get(code) ?? []), link])
  }
  try {
    const raw = JSON.parse(fs.readFileSync(at, 'utf8')) as { pairs?: unknown }
    for (const p of Array.isArray(raw.pairs) ? raw.pairs.filter(isPair) : []) {
      add(p.code, { code: p.from, side: 'from', same: p.same, total: p.total })
      add(p.from, { code: p.code, side: 'copied', same: p.same, total: p.total })
    }
  } catch {
    return new Map()
  }
  kept = { at, mtime, links }
  return links
}
