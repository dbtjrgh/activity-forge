/**
 * **공유 폴더에서 가져온 기록** — `_recipe/<코드>.share.json` (2026-10-15, `sharefetch.ts` 에서 뗐다. `_recipe` 는 커밋 안 함).
 *
 * - `files` — 리소스 폴더 자리마다 어디서 · 언제 · 저절로였나. **한 번 가져온 자리는 다시 저절로 안 가져온다** —
 *   사람이 필요 없어 지운 파일을 창을 열 때마다 또 넣으면 안 된다(단추로는 다시 가져올 수 있다)
 * - `auto` — 마지막으로 저절로 가져온 때와 종류별 수. 작업대 · 받을 리소스 창이 눈에 띄게 알린다(2026-10-15 사용자 말 —
 *   「자동으로 가져올 때 좀 잘 보이게 자동으로 공유 폴더에서 가져왔다 해라」)
 *
 * 못 읽으면 빈 기록, 못 남기면 그대로 둔다 — 가져온 파일은 기록과 상관없이 리소스 폴더에 있다.
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { InboxResult, ShareAuto, ShareItem } from '../../../shared/forge'

/**
 * 가져온 결과 한 줄 — 리소스 놓기 문구(`rsccopy.ts` `summary`)는 「다시 넣으세요」 · 「2000개까지만」처럼 놓을 때의 까닭을 대서
 * 가져오기 결과에 틀린 까닭을 보였다(2026-10-15 검토). `total` 넣으려던 수, `minutes` 시간 상한
 */
export function takeNote(put: InboxResult, total: number, minutes: number): string {
  const parts: string[] = []
  if (put.took.length) parts.push(`${put.took.length}개를 넣었습니다(${put.bytes.toLocaleString()}B).`)
  if (put.same.length) parts.push(`${put.same.length}개는 이미 같은 파일이 있습니다.`)
  if (put.clash.length) parts.push(`${put.clash.length}개는 리소스 폴더에 이름이 같은 다른 파일이 있어 그대로 두었습니다.`)
  if (put.failed.length) parts.push(`${put.failed.length}개는 넣지 못했습니다(${put.failed[0]?.why ?? ''}).`)
  const left = total - put.took.length - put.same.length - put.clash.length - put.failed.length
  if (put.truncated && left > 0) parts.push(`${minutes}분 안에 다 넣지 못해 ${left}개는 넣지 않았습니다. 다시 누르면 이어서 넣습니다.`)
  return parts.join(' ')
}

type Took = Pick<ShareItem, 'to' | 'where' | 'kind' | 'near'> & { abs: string }
/** `near` — 기획서 참고 이름으로 다른 학습코드 폴더에서 가져온 소리(`ShareItem.near`) */
type Entry = { from: string; where: string; at: string; auto?: boolean; near?: boolean }
export type ShareLog = { files: Record<string, Entry>; auto?: ShareAuto }

const fileOf = (repoRoot: string, code: string): string => path.join(repoRoot, '_recipe', `${code}.share.json`)

export function readLog(repoRoot: string, code: string): ShareLog {
  try {
    const j = JSON.parse(fs.readFileSync(fileOf(repoRoot, code), 'utf8')) as Partial<ShareLog>
    return { files: j.files ?? {}, ...(j.auto ? { auto: j.auto } : {}) }
  } catch {
    return { files: {} }
  }
}

/** 리소스 폴더에 아직 있는, 참고 이름으로 다른 학습코드 폴더에서 가져온 소리 — 사람이 지웠으면 빼고 센다 */
export function nearTaken(log: ShareLog, dir: string): string[] {
  return Object.entries(log.files)
    .filter(([to, e]) => e.near && fs.existsSync(path.join(dir, to)))
    .map(([to]) => path.basename(to))
}

/** 넣은 것을 남긴다 — `took` 은 실제로 들어간 자리. `auto` 면 마지막 저절로 가져온 것도 바꾼다 */
export function writeLog(repoRoot: string, code: string, picks: Took[], took: string[], auto: boolean): ShareLog {
  const log = readLog(repoRoot, code)
  if (!took.length) return log
  const at = new Date().toISOString()
  const done = picks.filter((p) => took.includes(p.to))
  for (const p of done) log.files[p.to] = { from: p.abs, where: p.where, at, ...(auto ? { auto: true } : {}), ...(p.near ? { near: true } : {}) }
  if (auto) {
    const kinds: ShareAuto['kinds'] = {}
    for (const p of done) kinds[p.kind] = (kinds[p.kind] ?? 0) + 1
    log.auto = { at, kinds }
  }
  try {
    fs.mkdirSync(path.dirname(fileOf(repoRoot, code)), { recursive: true })
    fs.writeFileSync(fileOf(repoRoot, code), JSON.stringify({ code, ...log }, null, 2) + '\n', 'utf8')
  } catch {
    // 남기지 못해도 넣은 파일은 그대로 둔다
  }
  return log
}
