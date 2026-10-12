/**
 * **폴더에 남은 다른 호 원본의 파일** — 지금 원본은 안 쓰는 것 (2026-10-02, 사용자 요청).
 *
 * 9호 KOL1M08W4S2 는 원본을 7호 → 2호로 바꾼 뒤에도 폴더에 7호 장면 파일(박사 · 책상 · 1호 로티 여섯)이 남아 있었다.
 * 앱이 가져온 것이 아니라(`carrylog.ts` 는 앱이 넣은 것만 안다) 사람이 받을 리소스 창을 보고 넣은 것이다.
 * 그 파일이 「이름 그대로」 짝을 지어 미리보기에 박사가 나왔다.
 *
 * - **바이트로 가른다** — 폴더 파일이 그 모듈의 **다른 완성본** 파일과 바이트까지 같고, **지금 원본에는 같은 바이트도 같은 이름도 없을 때만**
 * - 사람 · AI 답이 가리키는 파일은 안 센다 — 「대사 성우」로 다른 호 대사를 일부러 가져온 것(`voiceset.ts`)이 그렇다
 * - `_` 로 시작하는 폴더(`_figma` · `_원본`)는 안 본다
 * - **저절로 지우지 않는다.** 목록을 보이고 사람이 누르면 휴지통으로(`lib/trash.ts`). 누를 때 다시 센다 — 화면이 보낸 목록을 믿지 않는다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Leftover, LeftoverTrash } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { toTrash } from '../../lib/trash'
import { readAnswers } from './answer'
import { sameBytes } from './rsccopy'
import { loadForge, type Forge } from './runtime'

/** 폴더 안 파일 — `_` 폴더는 뺀다. 없으면 빈 목록 */
function filesIn(forge: Forge, dir: string): string[] {
  try {
    return forge.files.walk(dir, '').filter((rel) => !rel.split('/').some((m) => m.startsWith('_')))
  } catch {
    return []
  }
}

const sizeOf = (f: string): number => {
  try {
    return fs.statSync(f).size
  } catch {
    return -1
  }
}

/**
 * 완성본 하나의 파일을 크기별로 · 이름 모음. 바이트는 견줄 때 읽는다 —
 * forge `printOf` 는 경로마다 한 번만 재서 기억하므로, 사람이 바꾸는 리소스 폴더 쪽에 쓰면 옛 지문으로 가른다
 */
type Index = { bySize: Map<number, string[]>; rels: Set<string> }

/**
 * 완성본 폴더 목록은 **폴더 도장이 같으면 다시 안 훑는다** — 생성할 때마다 · 원본 변경 창을 열 때마다 부른다.
 * 수학 M05 처럼 완성본이 스무 곳이면 메인 스레드에서 파일 이천 개를 재게 된다(함정 — 동기 계산은 화면을 멈춘다)
 */
const indexes = new Map<string, { key: string; ix: Index }>()

function folderKey(dir: string): string {
  try {
    return [dir, ...fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)]
      .map((d) => `${d}|${Math.round(fs.statSync(d === dir ? dir : path.join(dir, d)).mtimeMs)}`)
      .join(';')
  } catch {
    return 'x'
  }
}

function indexOf(forge: Forge, code: string): Index {
  const dir = forge.common.rscOfDone(code)
  const key = folderKey(dir)
  const hit = indexes.get(code)
  if (hit && hit.key === key) return hit.ix
  const ix = buildIndex(forge, dir)
  indexes.set(code, { key, ix })
  return ix
}

function buildIndex(forge: Forge, dir: string): Index {
  const rels = filesIn(forge, dir)
  const bySize = new Map<number, string[]>()
  for (const r of rels) {
    const f = path.join(dir, r)
    const n = sizeOf(f)
    bySize.set(n, [...(bySize.get(n) ?? []), f])
  }
  return { bySize, rels: new Set(rels) }
}

/** 그 완성본에 바이트까지 같은 파일이 있나 */
const holds = (ix: { bySize: Map<number, string[]> }, file: string, n: number): boolean =>
  (ix.bySize.get(n) ?? []).some((f) => sameBytes(file, f, n, n))

export function leftoverFiles(forge: Forge, code: string, origin: string): Leftover[] {
  const dir = forge.files.rscDir(code)
  if (!dir || !origin || !fs.existsSync(dir)) return []
  let others: string[]
  try {
    others = forge.layout.originChoices(code).choices.map((c) => c.code).filter((c) => c !== code && c !== origin)
  } catch {
    return []
  }
  const mine = indexOf(forge, origin)
  const asked = new Set(readAnswers(forge.paths.REPO_ROOT, code).answers.map((a) => a.value).filter((v): v is string => typeof v === 'string'))
  const theirs = others.map((c) => ({ code: c, ...indexOf(forge, c) }))
  const out: Leftover[] = []
  for (const rel of filesIn(forge, dir)) {
    if (mine.rels.has(rel) || asked.has(rel)) continue
    const file = path.join(dir, rel)
    const n = sizeOf(file)
    if (n <= 0 || holds(mine, file, n)) continue
    const from = theirs.find((t) => holds(t, file, n))
    if (from) out.push({ rel, from: from.code })
  }
  return out
}

/** 다시 세어 휴지통으로. 하나가 안 돼도 나머지는 옮기고, 안 된 것을 알린다 */
export async function trashLeftovers(code: string, origin: string): Promise<LeftoverTrash> {
  const out: LeftoverTrash = { moved: [], failed: [] }
  try {
    const forge = await loadForge()
    const dir = forge.files.rscDir(code)
    if (!dir) return { ...out, error: '리소스 폴더를 찾지 못했습니다.' }
    for (const f of leftoverFiles(forge, code, origin)) {
      try {
        await toTrash(path.join(dir, f.rel))
        out.moved.push(f.rel)
      } catch (error) {
        out.failed.push({ rel: f.rel, why: toMessage(error) })
      }
    }
    return out
  } catch (error) {
    return { ...out, error: toMessage(error) }
  }
}
