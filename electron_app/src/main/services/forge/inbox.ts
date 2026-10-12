/**
 * 리소스 인박스 — **끌어다 놓으면 제자리에 들어간다** (4단계).
 *
 * 여태 「리소스 폴더에 넣으면」의 그 폴더를 사람이 찾아 들어가야 했습니다.
 * 자리는 `files.ts` 의 `rscDir()` 이 아는데 사람은 모릅니다. 놓는 자리를
 * 화면에 두고, 갈래별로 나누는 일은 여기서 합니다.
 *
 * **안 하는 일이 더 중요합니다.**
 *
 *   ① 갈래를 못 가린 파일은 **안 넣고 묻는다** — 확장자로도 폴더 이름으로도
 *      못 가리면 짐작하지 않는다 (저장소 CLAUDE.md 6번)
 *   ② **다른 차시 이름이 붙은 파일은 안 넣는다** — `enl1m07w1s1_…` 은 그
 *      차시의 것이다. 이 화면이 보고 있는 차시와 다르면 붙들어 두고 말한다
 *   ③ **덮어쓰지 않는다** — 이름이 같은데 내용이 다르면 그대로 두고 목록에
 *      담는다. 덮어쓰기는 사람이 한 번 더 눌러야 한다 (CLAUDE.md 7번)
 *   ④ **원본은 건드리지 않는다.** 복사만 하고 지우지 않는다
 *
 * 여기는 흐름만 둡니다 — 어디로 갈지는 `rscplace.ts`, 복사와 양쪽 대조는
 * `rsccopy.ts` 가 합니다.
 *
 * 갈래와 폴더 이름의 정본은 forge 의 `files.ts` 입니다 — `kindOfRel`·
 * `dirForKind` 를 부릅니다. 여기서 확장자 표를 다시 적지 않습니다.
 */

import { existsSync, readdirSync, rmSync, rmdirSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import type { InboxResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { loadForge, type Forge } from './runtime'
import { mark } from './measure'
import { blank, gather, put, summary, type Found, type Planned } from './rsccopy'
import { destOf } from './rscplace'

/**
 * 끌어다 놓은 것을 그 차시의 리소스 폴더에 넣는다.
 *
 * `drops` 는 파일이든 폴더든 된다. 폴더면 안까지 훑는다.
 */
export async function takeInbox(
  code: string,
  drops: string[],
  overwrite: boolean
): Promise<InboxResult> {
  const got = await rscOf(code, '')
  if ('failed' in got) return got
  const { forge, rsc: dir } = got

  // 리소스를 놓는 것도 사람이 시킨 일이다 (1단계 시험대).
  mark(forge.paths.REPO_ROOT, code, '리소스', `${drops.length}개 놓음`)

  const out = blank(dir)

  // ─ ① 놓은 것에서 파일을 찾아낸다 ─
  const found: Found[] = []
  for (const one of drops) {
    if (!isAbsolute(one) || !existsSync(one)) {
      out.failed.push({ name: basename(one), from: one, why: '파일을 찾지 못했습니다.' })
      continue
    }
    if (gather(one, found)) out.truncated = true
  }
  out.found = found.length
  if (!found.length && !out.failed.length) {
    out.note = '넣은 폴더가 비어 있습니다.'
    return out
  }

  // ─ ② 어디로 갈지 정한다. 못 정한 것은 안 넣는다 ─
  const plan: Planned[] = []
  for (const one of found) {
    const where = destOf(code, one, forge)
    if ('why' in where) out.ask.push({ name: one.rel, from: one.from, why: where.why })
    else plan.push({ ...one, to: where.to })
  }

  // ─ ③ 복사하고 양쪽 크기를 견준다 ─
  put(dir, plan, overwrite, out)
  out.note = summary(out, overwrite)
  return out
}

/**
 * 리소스를 **호 저장소로 따라 보낸다** — 「실제로 쓰기」가 반쪽이 되지 않게.
 *
 * 리소스를 호 저장소 밖(`.user.json` 의 `rscRoot`)에 두면 액티비티만 저장소로
 * 가고 그림·소리는 남아 브라우저에서 404 가 된다. 위와 **같은 복사**를 쓴다 —
 * 견주는 규칙이 두 벌이 되면 한쪽만 고쳐진다.
 *
 * `dest` 는 부르는 쪽(`write.ts`)이 이미 셈해 둔 `public/sparklab/<코드>` 다.
 */
export async function deliverResources(
  code: string,
  dest: string,
  overwrite: boolean,
  /**
   * 액티비티가 **실제로 쓰는** 파일(리소스 폴더 안 경로). 주면 그것만 보낸다 (2026-09-23).
   * 폴더를 통째로 보냈더니, 사람이 두 번 넣은 영상 사본과 이름을 바꾸기 전 썸네일이
   * 호 저장소에 그대로 따라가 놀고 있었다.
   */
  used?: Set<string>
): Promise<InboxResult> {
  const got = await rscOf(code, dest)
  if ('failed' in got) return got
  const src = got.rsc
  if (src === dest || !existsSync(src)) {
    return { ...blank(dest), note: '따로 옮길 리소스가 없습니다.' }
  }

  const out = blank(dest)
  const found: Found[] = []
  if (gather(src, found)) out.truncated = true
  out.found = found.length

  // **자리는 그대로 옮긴다.** 이미 갈래별로 나뉘어 있는 폴더라 다시 가릴
  // 것이 없다. `_figma` 는 사람이 보려고 둔 것이지 액티비티가 읽는 것이
  // 아니므로 저장소로 보내지 않는다.
  const plan = found
    .filter((f) => !f.rel.startsWith('_') && !isPlaceholder(f.rel))
    .filter((f) => !used || used.has(f.rel.toLowerCase()))
    .map((f) => ({ ...f, to: f.rel }))

  put(dest, plan, overwrite, out)
  const tidied = tidy(dest)
  out.note = summary(out, overwrite) + (tidied ? ` ${tidied}` : '')
  return out
}

/**
 * **빈 폴더를 git 에 남기려던 `readme.md`** — 리소스가 들어오면 할 일이 끝난 것이다
 * (2026-09-23, 사용자 결정). 호 저장소의 `public/sparklab/<코드>/{images,sounds,animations}`
 * 마다 하나씩 있어서(커밋 「리소스 더미 폴더 추가」), 그대로 두면 완성본 폴더에
 * 쓰레기로 남고 아무것도 안 들어온 `animations/` 가 빈 채로 남는다.
 */
const isPlaceholder = (rel: string): boolean => basename(rel).toLowerCase() === 'readme.md'

/**
 * 받는 쪽을 정리한다 — 자리 표시 `readme.md` 를 지우고, 그러고 나서 **빈 폴더**를 지운다.
 * 둘 다 git 이 되돌릴 수 있는 것만이다(자리 표시는 커밋돼 있고, 빈 폴더는 git 이 안 센다).
 * 한 일을 한 줄로 돌려준다.
 */
function tidy(dest: string): string {
  let notes = 0
  let dirs = 0
  const walk = (dir: string): boolean => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (walk(p)) {
          rmdirSync(p)
          dirs += 1
        }
      } else if (isPlaceholder(e.name)) {
        rmSync(p)
        notes += 1
      }
    }
    return dir !== dest && readdirSync(dir).length === 0
  }
  try {
    walk(dest)
  } catch {
    return '정리하다가 중단되었습니다. 폴더를 직접 확인하세요.'
  }
  const said = [notes ? `readme.md 파일 ${notes}개` : '', dirs ? `빈 폴더 ${dirs}개` : ''].filter(Boolean)
  return said.length ? `${said.join('와 ')}를 삭제했습니다.` : ''
}

/** forge 를 부르고 그 학습코드의 리소스 자리를 셈한다. 못 하면 `dir` 에 오류를 담은 결과. */
async function rscOf(code: string, dir: string): Promise<{ forge: Forge; rsc: string } | InboxResult> {
  let forge: Forge
  try {
    forge = await loadForge()
  } catch (error) {
    return blank(dir, toMessage(error))
  }
  const rsc = forge.files.rscDir(code)
  if (!rsc) return blank(dir, `${code} 학습코드의 리소스 폴더를 정하지 못했습니다.`)
  return { forge, rsc }
}
