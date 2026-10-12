/**
 * **한 판이 실제로 걸린 시간 — 모듈별 기록** (2026-09-29, M5). 차례 줄의 「끝나는 시각 어림」이 읽는다.
 *
 * AI 시간 합(`aiTally().ms`)은 동시에 나간 묶음을 더해 벽시계보다 길다 — 그래서 `make.ts` 가 **판 앞뒤의 벽시계**를 잰다.
 * 입력이 그대로라 다시 안 만든 판(0초)은 적지 않는다 — 적으면 어림이 0 으로 끌려간다.
 * 기록이 없는 모듈은 **어림하지 않는다**(저장소 규칙 6 — 모르면 모른다).
 *
 * 자리는 `_recipe/_times.json`(커밋하지 않는 산출물). 모듈마다 최근 `KEEP` 판만 둔다. Electron 을 import 하지 않는다.
 */

import fs from 'node:fs'
import path from 'node:path'

const KEEP = 10

type Times = Record<string, number[]>

const fileOf = (repoRoot: string): string => path.join(repoRoot, '_recipe', '_times.json')

function read(repoRoot: string): Times {
  try {
    return JSON.parse(fs.readFileSync(fileOf(repoRoot), 'utf8')) as Times
  } catch {
    return {}
  }
}

export function recordTime(repoRoot: string, module: string, ms: number): void {
  if (!module || ms <= 0) return
  const all = read(repoRoot)
  all[module] = [...(all[module] ?? []), Math.round(ms)].slice(-KEEP)
  try {
    fs.writeFileSync(fileOf(repoRoot), JSON.stringify(all, null, 1) + '\n', 'utf8')
  } catch {
    // 기록을 못 남겨도 만든 것은 그대로다 — 다음 어림이 「모름」이 될 뿐
  }
}

/** 그 모듈 한 판의 어림(ms) — 지난 판들의 가운뎃값. 기록이 없으면 null */
export function typicalMs(repoRoot: string, module: string): number | null {
  const list = (read(repoRoot)[module] ?? []).slice().sort((a, b) => a - b)
  return list.length ? list[Math.floor(list.length / 2)] : null
}
