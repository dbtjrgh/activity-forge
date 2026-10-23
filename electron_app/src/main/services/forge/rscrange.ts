/**
 * **같은 모듈 완성본이 쓴 리소스 수의 범위** (2026-10-14) — 그림 · 로티는 기획서에 이름이 없어 모자란지를 말할 길이 없다.
 * 대신 같은 모듈 개발 완료 완성본이 종류마다 몇 개에서 몇 개를 썼는지를 참고로 보인다.
 * 원본 하나와 개수를 견주면 다 넣은 완성본에도 절반이 「부족」으로 떴다 — M27 그림이 15~51개, M05 그림이 45~162개다(`plansound.ts` 머리).
 *
 * 세는 꼴은 AssetTable 이 부르는 파일 이름 수다(forge `common.fileOf` — 그림 · 소리 · 로티, 영상은 따로). 글꼴은 공용이라 안 센다.
 * 한 모듈에 완성본이 스물 남짓이라 처음 한 번 1초 안팎이 걸린다(메인 스레드) — 모듈마다 10분 들고 있는다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { doneOf } from './chatothers'
import { cellCode, finishedAt } from './hallwalk'
import type { Forge } from './runtime'

/** 영상은 AssetTable 이 그림 목록에 올리지만 사람에게는 그림이 아니다 — 따로 센다 */
export const kindKey = (file: string, kind: string): string => (file.toLowerCase().endsWith('.mp4') ? 'video' : kind)

export interface RscRange {
  min: number
  max: number
  /** 견준 완성본 수 */
  n: number
}

const KEEP_MS = 10 * 60_000
const kept = new Map<string, { at: number; value: Map<string, RscRange> }>()

/** 완성본 하나가 종류마다 쓰는 파일 수 */
function countsOf(forge: Forge, code: string): Map<string, number> {
  const sets = new Map<string, Set<string>>()
  for (const [slot, rel] of forge.common.fileOf(code)) {
    const kind = kindKey(rel, slot.split('|')[0] ?? '')
    sets.set(kind, (sets.get(kind) ?? new Set()).add(rel.toLowerCase()))
  }
  return new Map([...sets].map(([k, s]) => [k, s.size]))
}

/** 종류마다 범위 — 개발 완료 완성본이 둘 밑이면 빈 표(범위라 할 수 없다) */
export function rangeOf(forge: Forge, subject: string, module: string): Map<string, RscRange> {
  const key = `${subject}|${module}`
  const hit = kept.get(key)
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.value
  const codes = forge.layout
    .scanCells(subject)
    .filter((c) => c.module === module)
    .map((c) => cellCode(subject, c))
    .filter((code) => finishedAt(doneOf(forge, code).act) === true)
  const value = new Map<string, RscRange>()
  if (codes.length >= 2) {
    const all = codes.map((code) => countsOf(forge, code))
    for (const kind of new Set(all.flatMap((m) => [...m.keys()]))) {
      const v = all.map((m) => m.get(kind) ?? 0)
      value.set(kind, { min: Math.min(...v), max: Math.max(...v), n: v.length })
    }
  }
  kept.set(key, { at: Date.now(), value })
  return value
}
