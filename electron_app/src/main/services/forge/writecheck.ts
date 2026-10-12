/**
 * 쓰기 전에 **쓸 수 있나** — 권한(ACL) · 되돌릴 길(git) · 리소스 자리 (`write.ts` 에서 떼어 냄).
 *
 * 막는 까닭과 막지 않는 까닭은 `write.ts` 머리말의 ①~⑤ 가 정본입니다. 여기는
 * 그중 ②③④ 를 재서 `WriteCheck` 로 돌려줍니다. 화면이 쓰기 전에 따로 부르고,
 * `writeNow` 도 쓰기 직전에 다시 부릅니다.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { WriteCheck } from '../../../shared/forge'
import { readPermissions } from '../permissions'
import { toMessage } from '../../lib/errors'
import { git, lines } from '../../lib/git'
import { behindOf } from './behind'
import { isDummy, slotLine } from './dummy'
import { loadForge, type Forge } from './runtime'

/** git 이 굼뜰 때 화면을 붙잡아 두지 않는다. 못 물어봤으면 「모른다」다. */
const GIT_TIMEOUT = 10_000

/** 호 저장소 자리 — `<작업폴더>/sparkon_mNN`. 학습코드에서 호를 읽는다. */
export function repoOf(paths: Forge['paths'], code: string): string {
  const month = /M(\d\d)/.exec(code)?.[1]
  return month ? join(paths.workRoot(), `sparkon_m${month}`) : ''
}

export async function writeCheck(code: string): Promise<WriteCheck> {
  const blank: WriteCheck = {
    dir: '',
    exists: false,
    writable: null,
    why: '',
    git: { repo: false, dirty: [], note: '' },
    safe: false,
    dummy: false,
    slot: '',
    behind: null,
    behindNote: '',
    blocked: ''
  }

  let forge: Forge
  try {
    forge = await loadForge()
  } catch (error) {
    return { ...blank, blocked: toMessage(error) }
  }

  const repo = repoOf(forge.paths, code)
  if (!repo) return { ...blank, blocked: '학습코드에서 호를 읽지 못했습니다.' }
  if (!existsSync(repo)) return { ...blank, blocked: `호 폴더가 없습니다: ${repo}` }

  const parent = join(repo, 'src', 'activity')
  const dir = join(parent, code)
  const out: WriteCheck = { ...blank, dir, exists: existsSync(dir) }

  // ─ 쓰기 권한 (ACL) ─
  // `fs.access(W_OK)` 는 Windows 에서 ACL 을 안 본다 — 저장소 CLAUDE.md 의 함정.
  const perm = await readPermissions(parent)
  out.writable = perm.writable
  out.why =
    perm.error ??
    (perm.writable === null
      ? '쓰기 권한을 확인하지 못했습니다.'
      : perm.writable
        ? `${perm.currentUser ?? '현재 사용자'} 계정으로 쓸 수 있습니다.`
        : `${perm.currentUser ?? '현재 사용자'} 계정에는 쓰기 권한이 없습니다.`)

  // ─ 되돌릴 길 ─
  out.git = await gitState(repo, code, out.exists)
  // ─ 그 자리의 형편 · 원격보다 뒤처졌나 (M7) ─
  const [seed, late] = await Promise.all([out.exists ? isDummy(repo, code) : null, behindOf(repo)])
  out.dummy = seed?.dummy ?? false
  out.slot = slotLine(seed)
  out.behind = late.behind
  out.behindNote = late.note

  // ─ 리소스가 호 저장소 밖에 있나 ─
  // **막지 않는다.** 만들어진 액티비티 자체는 맞다. 리소스는 쓰기가 끝나고
  // **따라 보낸다**(4단계) — 그러지 않으면 그림·소리가 남아 브라우저에서
  // 조용히 404 가 된다. 그래도 어디서 어디로 가는지는 미리 말한다.
  const mine = forge.files.rscRoot()
  if (mine) {
    out.warn = `반영할 때 리소스를 ${join(repo, 'public', 'sparklab', code)} 폴더로 복사합니다.`
  }

  if (out.writable === false) {
    out.blocked = '쓰기 권한이 없습니다. 폴더 권한을 확인하세요.'
    return out
  }
  // **커밋 안 된 것이 전부 도구가 지난번에 쓴 그대로면 막지 않는다** (2026-09-23 사용자 말
  // 「걍 ㄱㅊ다 해」). 막는 까닭은 **사람이 고친 것**을 덮을까 봐서다 — 도구가 쓴 것은
  // 다시 쓰면 그만이고, 그 전에 커밋돼 있던 사람의 것은 git 에 그대로 있다.
  // 그 사이 사람이 한 글자라도 고쳤으면 지문이 달라져 여전히 막힌다.
  if (out.exists && out.git.dirty.length > 0 && (await ours(forge, repo, code))) {
    out.git.note = `커밋하지 않은 ${out.git.dirty.length}건은 지난번 반영 그대로라 덮어써도 됩니다.`
  } else if (out.exists && out.git.dirty.length > 0) {
    out.blocked = '커밋하지 않은 변경이 있습니다. 호 저장소에서 커밋하거나 되돌린 뒤 다시 누르세요.'
    out.dirtyHuman = true
    return out
  }
  // 새로 만드는 것이면 확인 없이 써도 된다. 지울 것이 없다.
  // **빈 뼈대도 그렇다** (M7 · 여쭐 것 5 허락) — 덮이는 것은 ffad230 이 깐 원형뿐이고 그것은 git 에 있다
  out.safe = !out.exists || out.dummy
  return out
}

// ─── 도구가 쓴 것인가 ─────────────────────────────────────────────────────

/** 도구가 쓰고 난 뒤 그 자리의 커밋 안 된 것 — 경로 → 지문(지워졌으면 `-`). */
const wroteFile = (forge: Forge, code: string): string => join(forge.paths.REPO_ROOT, '_recipe', `${code}.wrote.json`)

/** 그 자리의 커밋 안 된 것을 **파일 하나씩**(`-uall`), 한글 이름이 따옴표로 안 싸이게. */
async function dirtyOf(repo: string, code: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const got = lines(
    await git(
      repo,
      ['-c', 'core.quotepath=off', 'status', '--porcelain', '--untracked-files=all', '--', `src/activity/${code}`, `public/sparklab/${code}`],
      GIT_TIMEOUT
    )
  )
  for (const line of got) {
    const rel = line.slice(3).replace(/^"|"$/g, '')
    const file = join(repo, ...rel.split('/'))
    out.set(rel, existsSync(file) ? printOf(file) : '-')
  }
  return out
}

function printOf(file: string): string {
  const st = statSync(file)
  return `${st.size}:${createHash('sha1').update(readFileSync(file)).digest('hex')}`
}

/**
 * 도구가 방금 쓴 뒤의 모습을 적어 둔다 — 다음 쓰기가 「이것은 도구 것」임을 알게.
 * 못 적어도 쓰기는 이미 끝났다 — 다음에 한 번 막힐 뿐이다.
 */
export async function recordWrote(forge: Forge, code: string): Promise<void> {
  try {
    const got = await dirtyOf(repoOf(forge.paths, code), code)
    mkdirSync(dirname(wroteFile(forge, code)), { recursive: true })
    writeFileSync(wroteFile(forge, code), JSON.stringify(Object.fromEntries(got), null, 1), 'utf8')
  } catch {
    // 적지 못했다 — 다음 덮어쓰기가 여느 때처럼 막힌다(나빠지는 것은 없다)
  }
}

/** 지금 커밋 안 된 것이 **하나도 빠짐없이** 도구가 적어 둔 그대로인가. 모르면 false. */
async function ours(forge: Forge, repo: string, code: string): Promise<boolean> {
  try {
    const was = JSON.parse(readFileSync(wroteFile(forge, code), 'utf8')) as Record<string, string>
    const now = await dirtyOf(repo, code)
    return now.size > 0 && [...now].every(([rel, p]) => was[rel] === p)
  } catch {
    return false
  }
}

/**
 * 그 액티비티 자리가 git 으로 깨끗한가.
 *
 * **못 물어봤으면 「깨끗하다」고 하지 않는다.** git 이 없거나 굼떠서 답을
 * 못 받은 것과, 물어봐서 깨끗한 것은 다르다. 앞쪽은 되돌릴 길이 없는 것으로
 * 본다 — 덮어쓰기는 그때 막힌다.
 */
async function gitState(
  repo: string,
  code: string,
  exists: boolean
): Promise<WriteCheck['git']> {
  if (!existsSync(join(repo, '.git'))) {
    return { repo: false, dirty: exists ? ['(git 저장소가 아닙니다)'] : [], note: 'git 저장소가 아니라 되돌릴 수 없습니다.' }
  }
  try {
    const dirty = lines(
      await git(
        repo,
        ['status', '--porcelain', '--', `src/activity/${code}`, `public/sparklab/${code}`],
        GIT_TIMEOUT
      )
    )
    return {
      repo: true,
      dirty,
      note: dirty.length
        ? `커밋하지 않은 변경이 ${dirty.length}건 있습니다.`
        : '모두 커밋되어 있어 git 으로 되돌릴 수 있습니다.'
    }
  } catch (error) {
    return {
      repo: true,
      dirty: exists ? ['(git 상태를 읽지 못했습니다)'] : [],
      note: `git 상태를 읽지 못했습니다: ${toMessage(error)}`
    }
  }
}
