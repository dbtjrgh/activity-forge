/**
 * **놓은 것을 훑어 학습코드 폴더와 낱개 파일로 나눈다** — `sort.ts` 에서 옮김 (2026-09-29, M5, 동작 변화 없음).
 * `sort.ts` 가 200줄을 넘어 갈랐다. 가르는 단서(폴더 이름 · 파일 이름 앞머리)의 까닭은 `sort.ts` 머리말에 있다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import type { InboxHold } from '../../../shared/forge'

/** 폴더·파일 이름에 붙은 학습코드. `ENL1M07W1S3` · `enl1m07w1s3_crayon1.png` */
const CODE = /^([a-z]{2}l\dm\d\dw\ds\d)(?:$|[_-])/i

/** 훑을 폴더 수 상한. 통째로 놓을 수 있어 상한을 둔다. */
const MAX_DIRS = 4000

export interface Split {
  /** 차시 → 그 차시로 넘길 것들 (폴더째면 폴더, 낱개면 파일) */
  byCode: Map<string, string[]>
  /** 어느 차시인지 못 가린 낱개 파일 */
  loose: string[]
  truncated: boolean
}

/** 이름에서 학습코드를 뜯는다. 아니면 null. */
export function codeIn(name: string): string | null {
  const m = CODE.exec(name)
  return m ? m[1].toUpperCase() : null
}

/**
 * 놓은 것을 훑어 **학습코드 폴더**를 찾는다.
 *
 * 코드 폴더를 만나면 그 아래는 더 안 판다 — 통째로 넘겨야 `images/…` 가
 * 살아 있기 때문이다. 코드 폴더 밖에 있는 파일은 낱개로 모은다.
 */
export function split(drops: string[], out: Split, fails: InboxHold[]): void {
  const stack: string[] = []
  for (const one of drops) {
    if (!isAbsolute(one) || !existsSync(one)) {
      fails.push({ name: basename(one), from: one, why: '파일을 찾지 못했습니다.' })
      continue
    }
    stack.push(one)
  }

  let seen = 0
  while (stack.length) {
    const at = stack.pop() as string
    let st
    try {
      st = statSync(at)
    } catch {
      fails.push({ name: basename(at), from: at, why: '읽지 못했습니다.' })
      continue
    }

    if (st.isFile()) {
      out.loose.push(at)
      continue
    }
    if (!st.isDirectory()) continue

    // **이 폴더가 곧 차시인가.** 그러면 통째로 넘기고 안은 안 판다.
    const code = codeIn(basename(at))
    if (code) {
      const list = out.byCode.get(code) ?? []
      list.push(at)
      out.byCode.set(code, list)
      continue
    }

    if (++seen > MAX_DIRS) {
      out.truncated = true
      continue
    }
    try {
      for (const e of readdirSync(at, { withFileTypes: true })) {
        const abs = join(at, e.name)
        if (e.isDirectory()) stack.push(abs)
        else if (e.isFile()) out.loose.push(abs)
      }
    } catch {
      fails.push({ name: basename(at), from: at, why: '폴더를 읽지 못했습니다.' })
    }
  }
}
