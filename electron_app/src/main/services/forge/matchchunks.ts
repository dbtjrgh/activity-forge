/**
 * 맞추기 물음을 **묶음으로 나눈다** — 갈래로 먼저 가르고, 한 갈래가 많으면 15자리씩
 * (2026-09-30 에 `matchcalls.ts` 에서 옮김, 200줄이 넘어서. 동작 변화 없음).
 *
 * 왜 나누는지 · 잰 값은 `matchcalls.ts` 머리말에 있다. 부르는 것도 거기서 한다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { briefOf, type Look, type Slot } from './brief'
import { kindOf } from './briefslots'

/** 한 묶음에 넣을 자리 수. `matchcalls.ts` 머리말 표에서 15자리가 96초였다. */
const CHUNK = 15

export interface Chunk {
  slots: Slot[]
  spare: string[]
  /** 첫 판에 보낼 글 — **그림 없이** */
  brief: string
  /** 두 번째 판에 보낼 글 — 남은 자리만, **그림·기획서와 함께** */
  reask: (left: Slot[], look: Look) => string
}

/**
 * 물을 것을 묶음으로 나눈다. **고를 파일이 없는 갈래는 아예 안 묻는다** —
 * 답이 있을 수 없는 물음에 부르면 토큰만 나간다.
 */
export function chunksOf(
  code: string,
  module: string,
  origin: string,
  slots: Slot[],
  spare: string[],
  planLater = false
): Chunk[] {
  const out: Chunk[] = []
  for (const kind of [...new Set(slots.map((s) => s.kind))]) {
    const mine = slots.filter((s) => s.kind === kind)
    // 갈래가 안 잡히는 파일(확장자를 모르는 것)은 어느 묶음에서도 안 빠지게 둔다.
    const files = spare.filter((f) => {
      const k = kindOf(f)
      return k === null || k === kind
    })
    if (!files.length) continue
    for (let at = 0; at < mine.length; at += CHUNK) {
      const part = mine.slice(at, at + CHUNK)
      out.push({
        slots: part,
        spare: files,
        brief: briefOf(code, module, origin, part, files, { planLater }),
        reask: (left, look) => briefOf(code, module, origin, left, files, look)
      })
    }
  }
  return out
}

