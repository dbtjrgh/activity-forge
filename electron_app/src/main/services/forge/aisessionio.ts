/**
 * 이어 가는 대화(`aisession.ts`)의 **부를 인자와 받은 줄 읽기** — 200줄을 넘어 뗐다(2026-10-08, 동작 변화 없음).
 *
 * 울타리를 정하는 인자가 여기 있다 — 도구는 읽기 셋과 쓰기 둘뿐, 쓰기는 작업 폴더 안(`./**`)만, 나머지 폴더는 `--add-dir` 로 읽기만.
 * 셸(Bash)은 열지 않는다(머리말 까닭은 `aisession.ts`).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import { leanSettings, quoted } from './aiargs'
import { MODEL } from './aimodel'

export function sessionArgs(readDirs: string[], resume?: string | null): string[] {
  return [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--model',
    MODEL,
    '--strict-mcp-config',
    // 사람용 설정(조언자 모델)은 이 부름에서도 뗀다 — `aiargs.ts` 머리말
    '--settings',
    quoted(leanSettings()),
    '--tools',
    'Read,Glob,Grep,Edit,Write',
    '--allowedTools',
    quoted('Edit(./**)'),
    quoted('Write(./**)'),
    ...readDirs.flatMap((d) => ['--add-dir', quoted(d)]),
    ...(resume ? ['--resume', resume] : [])
  ]
}

export const base = (p: unknown): string => path.basename(String(p ?? ''))

/** 도구 한 번 → 사람이 읽을 한 줄 */
export function lineOf(name: string, input: Record<string, unknown>): string {
  if (name === 'Read') return `읽음: ${base(input['file_path'])}${input['pages'] ? ` (${String(input['pages'])}쪽)` : ''}`
  if (name === 'Write') return `씀: ${base(input['file_path'])}`
  if (name === 'Edit') return `고침: ${base(input['file_path'])}`
  if (name === 'Glob' || name === 'Grep') return `찾음: ${String(input['pattern'] ?? '')}`
  return name
}

/** stream-json 한 줄 */
export type StreamMsg = {
  type?: string
  subtype?: string
  session_id?: string
  result?: string
  is_error?: boolean
  total_cost_usd?: number
  usage?: { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number }
  permission_denials?: { tool_name?: string; tool_input?: Record<string, unknown> }[]
  message?: { content?: { type?: string; name?: string; text?: string; input?: Record<string, unknown> }[] }
}

export function usageOf(m: StreamMsg | null): { input: number; cacheWrite: number; cacheRead: number; output: number } | undefined {
  const u = m?.usage
  return u ? { input: u.input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, output: u.output_tokens ?? 0 } : undefined
}
