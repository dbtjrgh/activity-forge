/**
 * **파일이 바뀌었나를 싸게 재는 도장** — 크기와 수정 시각 (2026-09-29, M3).
 *
 * 입력 지문을 뜨는 자리가 둘이다 — 좌표 찾기(`placecache.ts`)와 만들기(`make.ts`). 둘이 도장을 따로
 * 찍으면 한쪽만 고쳐진다(저장소 규칙 3). 내용을 다 읽지 않는다 — 그림 수백 장을 읽으면 그것이 또 느려진다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** `크기:수정시각`. 없으면 `x`, 경로가 비면 `-`. */
export function stamp(f: string | null): string {
  if (!f) return '-'
  try {
    const s = fs.statSync(f)
    return `${s.size}:${Math.round(s.mtimeMs)}`
  } catch {
    return 'x'
  }
}

/** 파일 내용의 sha1. 작은 글 파일(답 · 스펙)에 쓴다. 없으면 `x`. */
export function sha1Of(f: string): string {
  try {
    return crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex')
  } catch {
    return 'x'
  }
}

/** 폴더 아래 파일마다 `이름|도장`, 이름 차례로. `walk` 는 forge `files.ts` 것을 받는다(두 벌 금지). */
export function stampTree(dir: string | null, walk: (root: string, rel: string) => string[]): string[] {
  if (!dir || !fs.existsSync(dir)) return ['(없음)']
  return walk(dir, '')
    .sort()
    .map((rel) => `${rel}|${stamp(path.join(dir, rel))}`)
}
