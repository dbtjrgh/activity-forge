/**
 * 리소스 복사의 바닥 — **찾아내기 · 복사 · 양쪽 대조 · 한 줄 요약.**
 *
 * `inbox.ts` 의 두 길(놓은 것 넣기 · 호 저장소로 따라 보내기)이 함께 쓴다.
 * **어디로 갈지 정하는 일은 여기 없다** — 그것은 `inbox.ts` 가 한다. 여기는
 * 정해진 자리로 옮기고, 옮긴 뒤에 양쪽을 센다 (저장소 CLAUDE.md 7번).
 * 견주는 규칙이 두 벌이 되면 한쪽만 고쳐지므로 여기 하나에 둔다.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'
import type { InboxResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'

/** 한 번에 보는 파일 수 상한. 폴더를 통째로 놓을 수 있어 상한을 둔다. */
const MAX_FILES = 2000

/** 이름이 같을 때 **내용까지** 견주는 크기 상한. 리소스는 이보다 훨씬 작다. */
const SAME_MAX = 16 * 1024 * 1024

/** 놓은 것에서 찾아낸 파일 하나. `rel` 은 놓은 자리에서부터의 길이다. */
export interface Found {
  from: string
  rel: string
  bytes: number
}

/** 넣을 자리까지 정해진 것. */
export interface Planned extends Found {
  /** 리소스 폴더 안에서의 자리 — `images/crayon1.png` */
  to: string
}

export function blank(dir: string, error?: string): InboxResult {
  return {
    dir,
    found: 0,
    took: [],
    same: [],
    clash: [],
    ask: [],
    failed: [],
    bytes: 0,
    truncated: false,
    note: '',
    ...(error ? { error } : {})
  }
}

/**
 * 폴더면 안까지, 파일이면 그것 하나. 상한에 걸리면 true 를 돌려준다.
 *
 * **상한에 걸린 것을 숨기지 않는다** — 화면이 「2000개만 봤습니다」를 말한다.
 */
export function gather(target: string, out: Found[]): boolean {
  const st = statSync(target)
  if (st.isFile()) {
    out.push({ from: target, rel: basename(target), bytes: st.size })
    return false
  }
  if (!st.isDirectory()) return false

  const stack = [target]
  while (stack.length) {
    const dir = stack.pop() as string
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= MAX_FILES) return true
      const abs = join(dir, e.name)
      if (e.isDirectory()) stack.push(abs)
      else if (e.isFile()) {
        out.push({ from: abs, rel: slashes(relative(target, abs)), bytes: statSync(abs).size })
      }
    }
  }
  return false
}

/**
 * 실제로 복사한다. **넣은 뒤에 크기를 견주고**, 이미 있는 것은 건드리지 않는다.
 */
export function put(dir: string, plan: Planned[], overwrite: boolean, out: InboxResult): void {
  for (const one of plan) {
    const to = join(dir, ...one.to.split('/'))
    try {
      if (existsSync(to)) {
        const mine = statSync(to).size
        if (sameBytes(to, one.from, mine, one.bytes)) {
          out.same.push(one.to)
          continue
        }
        if (!overwrite) {
          out.clash.push({ rel: one.to, from: one.from, mine, theirs: one.bytes })
          continue
        }
      }
      mkdirSync(dirname(to), { recursive: true })
      copyFileSync(one.from, to)
      // **양쪽에서 센다** (CLAUDE.md 7번). 반쯤 쓰인 파일은 브라우저에서
      // 깨진 그림으로만 드러나고, 그때는 어디서 깨졌는지 알 길이 없다.
      const wrote = statSync(to).size
      if (wrote !== one.bytes) {
        out.failed.push({
          name: one.to,
          from: one.from,
          why: `복사한 파일의 크기가 다릅니다(원본 ${one.bytes.toLocaleString()}B, 복사본 ${wrote.toLocaleString()}B).`
        })
        continue
      }
      out.took.push({ rel: one.to, from: one.from, bytes: wrote })
      out.bytes += wrote
    } catch (error) {
      out.failed.push({ name: one.to, from: one.from, why: toMessage(error) })
    }
  }
}

/**
 * 이미 있는 것과 **같은 파일인가.**
 *
 * 크기만 같아도 다른 그림일 수 있으므로 내용까지 본다. 리소스는 작아서
 * 읽어 견주는 값이 싸다 — 큰 파일은 크기만 보고 「같다」고 하지 않는다.
 * 반영한 뒤 바뀐 리소스를 찾을 때도 이 셈이다(`stale.ts`).
 */
export function sameBytes(to: string, from: string, mine: number, theirs: number): boolean {
  if (mine !== theirs) return false
  if (mine > SAME_MAX) return false
  try {
    return readFileSync(to).equals(readFileSync(from))
  } catch {
    return false
  }
}

/** 두 파일이 바이트까지 같은가 — 크기를 재서 위와 같이 본다. 못 읽으면 다르다 */
export function sameFile(a: string, b: string): boolean {
  try {
    return sameBytes(a, b, statSync(a).size, statSync(b).size)
  } catch {
    return false
  }
}

/** 윈도우 구분자를 `/` 로. 리소스 자리는 늘 `/` 로 적는다 (AssetTable 이 그렇다). */
function slashes(rel: string): string {
  return rel.split(sep).join('/')
}

/** 사람이 읽을 한 줄. **넣은 것만 세지 않는다** — 안 넣은 것이 더 중요하다. */
export function summary(out: InboxResult, overwrite: boolean): string {
  const bits = [`${out.took.length}개를 넣었습니다(${out.bytes.toLocaleString()}B).`]
  if (out.same.length) bits.push(`이미 있는 같은 파일 ${out.same.length}개는 건너뛰었습니다.`)
  if (out.clash.length) {
    bits.push(
      `이름은 같고 내용이 다른 ${out.clash.length}개는 ${
        overwrite ? '덮어쓰지 못했습니다.' : '그대로 두었습니다. 덮어쓰려면 다시 넣으세요.'
      }`
    )
  }
  if (out.ask.length) bits.push(`종류를 알 수 없는 ${out.ask.length}개는 넣지 않았습니다.`)
  if (out.failed.length) bits.push(`${out.failed.length}개는 넣지 못했습니다.`)
  if (out.truncated) bits.push(`한 번에 ${MAX_FILES}개까지만 확인합니다.`)
  return bits.join(' ')
}
