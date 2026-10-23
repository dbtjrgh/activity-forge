/**
 * 폴더 아래에서 어느 때보다 늦게 고친 파일 — **도메인을 모른다.** 앱 · 양산 개념이 없다.
 *
 * 처음 쓰는 곳은 dev 앱의 앱 코드 바뀜 막대다(`ipc/index.ts` · `components/DevCodeBar.tsx`, 2026-10-14).
 * 1분마다 부르므로 **비동기로 훑는다** — 메인 스레드의 동기 계산은 화면 전체를 멈춘다(함정).
 * 훑는 파일 수에 상한을 두고, 걸리면 숨기지 않고 `truncated` 로 알린다.
 */

import { statSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

/** 훑을 파일 수 상한 — 앱 소스(main · preload · shared)는 250개쯤이다 */
const CAP = 5000

export interface Newer {
  /** `base` 기준 경로(`/`), 늦게 고친 것부터 */
  files: string[]
  /** 상한에 걸려 그 뒤는 안 봤다 */
  truncated: boolean
}

/** `base` 아래 `dirs` 에서 수정 시각이 `since`(ms) 보다 늦은 파일. 없는 폴더 · 못 읽는 파일은 건너뛴다 */
export async function newerThan(base: string, dirs: string[], since: number, cap = CAP): Promise<Newer> {
  const found: { rel: string; at: number }[] = []
  let seen = 0
  let truncated = false
  const walk = async (dir: string): Promise<void> => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (truncated) return
      const at = join(dir, e.name)
      if (e.isDirectory()) {
        await walk(at)
        continue
      }
      if (!e.isFile()) continue
      if (++seen > cap) {
        truncated = true
        return
      }
      try {
        const m = (await stat(at)).mtimeMs
        if (m > since) found.push({ rel: relative(base, at).replace(/\\/g, '/'), at: m })
      } catch {
        // 훑는 사이에 지워진 파일
      }
    }
  }
  for (const d of dirs) await walk(join(base, d))
  return { files: found.sort((a, b) => b.at - a.at).map((f) => f.rel), truncated }
}

/** 파일의 수정 시각(ms) — 못 읽으면 `fallback` */
export function mtimeOr(file: string, fallback: number): number {
  try {
    return statSync(file).mtimeMs
  } catch {
    return fallback
  }
}
