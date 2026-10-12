/**
 * AI 가 짚은 짜임(`shape.ts`)을 **남기고 읽기** (2026-09-30 에 `shape.ts` 에서 옮김, 200줄이 넘어서. 동작 변화 없음).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ShapeFinding } from '../../../shared/forge'

// ─── 남기기 ────────────────────────────────────────────────────────────
//
// 답·메모와 **같은 자리**(`_recipe`)에 둔다. 새 창고를 만들지 않는다.

function fileOf(repoRoot: string, code: string): string {
  return path.join(repoRoot, '_recipe', `${code}.shape.json`)
}

export function readFindings(repoRoot: string, code: string): ShapeFinding[] {
  const at = fileOf(repoRoot, code)
  if (!fs.existsSync(at)) return []
  try {
    const got = JSON.parse(fs.readFileSync(at, 'utf8')) as { findings?: ShapeFinding[] }
    return Array.isArray(got.findings) ? got.findings : []
  } catch {
    return []
  }
}

/** **통째로 갈아치운다.** 다시 물었으면 앞의 답은 낡은 것이다. */
export function saveFindings(repoRoot: string, code: string, findings: ShapeFinding[]): void {
  const at = fileOf(repoRoot, code)
  fs.mkdirSync(path.dirname(at), { recursive: true })
  fs.writeFileSync(
    at,
    JSON.stringify({ code, at: new Date().toISOString(), findings }, null, 2) + '\n',
    'utf8'
  )
}

