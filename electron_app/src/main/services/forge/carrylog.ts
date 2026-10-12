/**
 * **앱이 리소스 폴더에 가져온 파일의 기록 — 원본이 바뀌면 옛 원본에서 가져온 것을 치운다** (2026-10-01, 사용자 요청).
 *
 * 9호 KOL1M08W2S2 에서 원본이 8호(로켓) → 4호 → 6호(방학)로 바뀌는 동안, 공용 가져오기(`commonrsc.ts`)와
 * 돌려 쓴 파일(`carryrsc.ts`)이 원본마다 파일을 폴더에 넣었다. 지울 길이 없어 로켓 그림 · 3호 애니메이션이 9호 폴더에 남았고,
 * 그 옛 판이 「이름 그대로」 짝을 지었다(사용자 말 — 「원본바뀔때 기존에 있던건 없애야하는거 아닌가」).
 *
 * - 자리는 `_recipe/<코드>.carried.json` 이다(`_recipe` 는 커밋 안 함). 리소스 폴더에 두면 그 json 을 로티로 센다
 * - **원본이 지금과 다른 기록만** 치운다. 지금 원본에서 가져온 것은 그대로 둔다
 * - **사람이 바꾼 파일은 안 건드린다** — 크기가 기록과 다르면 기록에서만 뺀다
 * - 지우는 것은 휴지통으로(`lib/trash.ts`). 휴지통을 못 쓰면(Node 로만 돌 때) 안 지우고 기록도 남긴다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import { toTrash } from '../../lib/trash'

type Entry = { rel: string; origin: string; size: number }

function logFile(repoRoot: string, code: string): string {
  return path.join(repoRoot, '_recipe', `${code}.carried.json`)
}

function readLog(repoRoot: string, code: string): Entry[] {
  try {
    const got = JSON.parse(fs.readFileSync(logFile(repoRoot, code), 'utf8')) as { files?: Entry[] }
    return Array.isArray(got.files) ? got.files : []
  } catch {
    return []
  }
}

function writeLog(repoRoot: string, code: string, files: Entry[]): void {
  const file = logFile(repoRoot, code)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ code, files }, null, 2) + '\n', 'utf8')
}

/** 앱이 가져온 파일 자리 — 사람이 놓은 파일만 셀 때 뺀다(`variantcheck.ts`) */
export function carriedRels(repoRoot: string, code: string): Set<string> {
  return new Set(readLog(repoRoot, code).map((e) => e.rel))
}

/** 이번에 가져온 파일을 적는다 — 같은 자리는 덮는다 */
export function logCarried(repoRoot: string, code: string, origin: string, dir: string, rels: string[]): void {
  if (!rels.length) return
  const kept = new Map(readLog(repoRoot, code).map((e) => [e.rel, e]))
  for (const rel of rels) {
    try {
      kept.set(rel, { rel, origin, size: fs.statSync(path.join(dir, rel)).size })
    } catch {
      // 못 읽으면 적지 않는다 — 기록에 없으면 안 치운다
    }
  }
  writeLog(repoRoot, code, [...kept.values()])
}

/** 원본이 바뀌었으면 옛 원본에서 가져온 파일을 휴지통으로. 치운 자리를 돌려준다 */
export async function pruneCarried(repoRoot: string, code: string, origin: string, dir: string): Promise<string[]> {
  const log = readLog(repoRoot, code)
  const stay: Entry[] = []
  const gone: string[] = []
  for (const e of log) {
    if (e.origin === origin) {
      stay.push(e)
      continue
    }
    const at = path.join(dir, e.rel)
    let size: number | null = null
    try {
      size = fs.statSync(at).size
    } catch {
      continue // 이미 없다 — 기록에서만 뺀다
    }
    if (size !== e.size) continue // 사람이 바꿨다 — 이제 앱이 가져온 파일이 아니다
    try {
      await toTrash(at)
      gone.push(e.rel)
    } catch {
      stay.push(e) // 휴지통을 못 쓰면 안 지우고 다음에 다시
    }
  }
  if (gone.length || stay.length !== log.length) writeLog(repoRoot, code, stay)
  return gone
}
