/**
 * **원본에서의 차례와, 그 차례로 자리에 얹기.** `order.ts` 에서 갈라 나왔다
 * (2026-09-16, 200줄 규칙).
 *
 * 「몇 번째」라는 말이 두 곳에서 오는데 **뜻이 다르다** —
 *
 *   원본의 차례   `pants` 가 원본 gameData 의 **3번째 칸**에 있다
 *   새 차례       figma(또는 AI)가 **3번째 낱말은 scissors** 라고 한다
 *
 * 이 둘을 번호로 이어야 「`pants` 자리에 scissors 파일」이 나온다. 둘 중
 * 하나라도 못 읽으면 그 자리는 **그냥 안 채운다** — 억지로 채우면 조용히
 * 틀린 액티비티가 나간다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer } from '../../../shared/forge'
import { slotPath } from '../../../shared/forge'
import type { NamePick } from './name'
import type { SlotJudge } from '@/gen/reslot'
import type { AssetKind } from '@/gen/types'

/**
 * 그 별칭이 **몇 번째 칸**에 나오나. gameData 뿌리가 배열일 때만 알 수 있다.
 *
 * 원본의 차례를 여기서 읽어 두어야 「3번째」와 이을 수 있다 — `pants` 가
 * 원본에서 3번째 칸에 있었으니, 3번째라고 한 파일이 그 자리다.
 *
 * **못 읽으면 null 이다.** 뿌리가 배열이 아닌 모듈은 차례라는 것이 없거나
 * 짜임이 달라, 짐작하면 자리가 통째로 뒤섞인다.
 */
export function inningOf(gameData: unknown, alias: string): number | null {
  if (!Array.isArray(gameData)) return null
  for (let i = 0; i < gameData.length; i += 1) {
    if (hasText(gameData[i], alias)) return i + 1
  }
  return null
}

function hasText(v: unknown, want: string): boolean {
  if (typeof v === 'string') return v === want
  if (Array.isArray(v)) return v.some((x) => hasText(x, want))
  if (v && typeof v === 'object') return Object.values(v).some((x) => hasText(x, want))
  return false
}

export type Placed = { alias: string; kind: string; file: string; inning: number | null; why: string }

/**
 * 차례가 같은 것끼리 이어 붙인다. 짝이 없으면 그 자리는 그냥 안 채운다.
 *
 * 남기는 답은 사람이 카드에서 고른 것과 **같은 꼴**(`#slot|갈래|별칭`)이다.
 * 따로 두면 「사람이 고친 것」과 「도구가 넣은 것」이 두 벌이 되어 어느 쪽이
 * 이기는지 흐려진다.
 */
export function place(
  words: SlotJudge[],
  picks: NamePick[],
  seat: Map<string, number>,
  spare: string[],
  answers: Answer[]
): Placed[] {
  const byInning = new Map<number, NamePick>()
  for (const p of picks) if (p.inning !== null) byInning.set(p.inning, p)

  const out: Placed[] = []
  for (const j of words) {
    const n = seat.get(`${j.kind}|${j.alias}`)
    const p = n === undefined ? undefined : byInning.get(n)
    if (!p) continue
    // 브리프에는 파일 이름만 줬으므로 폴더가 붙은 본디 이름으로 되돌린다.
    const rel = spare.find((f) => (f.split('/').pop() ?? f) === p.file) ?? p.file
    answers.push({ path: slotPath(j.kind, j.alias), value: rel })
    out.push({ alias: j.alias, kind: j.kind as AssetKind, file: rel, inning: n ?? null, why: p.why })
  }
  return out
}
