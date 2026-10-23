/**
 * **업데이트 전에 고친 스펙 · 배치표를 잠시 치워 두기** (2026-10-21) — `refresh.ts` · `refreshpull.ts` 가 부른다.
 *
 * 「업데이트」는 고친 파일이 하나라도 있으면 안 받았다. 그런데 **앱이 스스로** 양산기 저장소의
 * 올린 파일을 고친다 — 작업대가 배치표(`_layout/*.json`, forge `writeLayoutOrigin` · `writeLayoutPick`)와
 * 스펙(`_spec/**`, `carry.ts`)에 적고, 이제는 사람도 스펙을 쓴다. 그래서 작업대를 한 번 쓰면 그 PC 는
 * 영영 업데이트를 못 받았다.
 *
 * **이 두 자리만** `git stash push -- <자리>` 로 치워 두고 받은 뒤 `stash pop` 한다. 늘 치우지는 않는다 — 먼저 그대로 받아 보고
 * 받을 커밋이 고친 파일을 건드려 git 이 거절할 때만 치운다(`refreshpull.ts`, 치워 둔 동안 작업대가 적으면 고친 것이 stash 에만 남는다).
 * 좁게 잡는 것이 안전장치다 — 이 함수는 개발하는 사람 자신의 저장소(양산기 폴더가 dev 사본)에서도 돈다.
 * 그 저장소의 코드(`src` 등)가 하나라도 고쳐져 있거나, 미리 담아 둔(staged) 파일 · 끝나지 않은 합치기 ·
 * 리베이스가 있거나, 원격에 안 올린 커밋이 있으면 **치우지 않고** 예전처럼 안 받는다(`asideOf` 가 빈 목록).
 *
 * pop 이 받은 내용과 겹쳐 충돌하면 그 파일은 **받은 내용으로** 두고 stash 는 지우지 않는다(`stash drop` 을 안 부른다).
 * 고친 내용은 `git stash list` 에 남는다. 충돌 표시(<<<<)가 든 스펙을 forge 가 읽으면 JSON 이 깨지기 때문이다.
 * 받은 쪽에서 지운 파일이면 남은 것을 휴지통으로 옮긴다(받은 내용 = 없음).
 * 덮기 전에 고친 내용을 「<이름> 내가 고친 것」으로 휴지통에도 넣는다 (2026-10-21) — stash 에만 두면 앱만 쓰는 사람은 꺼낼 길이 없다(`keepMine`).
 *
 * 셸 없이 `lib/git.ts` 로만 부르고 상한을 둔다. Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { toMessage } from '../../lib/errors'
import { git, tryGit } from '../../lib/git'
import { toTrash } from '../../lib/trash'

/** 물어보는 것(상태 · 커밋)은 짧게 — `refresh.ts` · `refreshpull.ts` 도 이 값을 쓴다(2026-10-21, 세 곳에 따로 있었다) */
export const ASK_TIMEOUT = 10_000
/** stash 는 파일을 쓰므로 묻기보다 길게 */
const STASH_TIMEOUT = 30_000
/** 경로를 글자 그대로 — 파일 이름의 `*` · `[` 를 패턴으로 읽지 않게. `refreshpull.ts` 도 쓴다 */
export const LITERAL = { GIT_LITERAL_PATHSPECS: '1' }
/** `git stash list` 에서 무엇인지 알아보게 */
const MARK = 'SparkOn 업데이트 전에 치워 둔 스펙과 배치표'

interface Change {
  /** porcelain 의 두 글자 — 앞은 미리 담은 것(index), 뒤는 작업 폴더 */
  xy: string
  path: string
}

/** 올린 파일 가운데 바뀐 것. `-z` 라 한글 · 띄어쓰기 이름도 따옴표 없이 온다. 이름 바꾸기는 다음 토막이 옛 이름이다 */
export async function changes(repo: string): Promise<Change[]> {
  const parts = (await git(repo, ['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=no'], ASK_TIMEOUT)).split('\0')
  const out: Change[] = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] as string
    if (p.length < 4) continue
    out.push({ xy: p.slice(0, 2), path: p.slice(3) })
    if (p[0] === 'R' || p[0] === 'C') i++
  }
  return out
}

/** 끝나지 않은 합치기 · 리베이스 · 체리픽 · 되돌리기가 있나 — `.git` 이 파일인 worktree 에서도 맞게 git 에 묻는다 */
export async function unfinished(repo: string): Promise<boolean> {
  for (const ref of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'REBASE_HEAD']) {
    if ((await tryGit(repo, ['rev-parse', '-q', '--verify', ref], ASK_TIMEOUT)).ok) return true
  }
  // 리베이스는 충돌 없이 멈춰 있을 때(edit) REBASE_HEAD 가 없다 — 그 폴더로 본다
  for (const dir of ['rebase-merge', 'rebase-apply']) {
    const at = (await tryGit(repo, ['rev-parse', '--git-path', dir], ASK_TIMEOUT)).out.trim()
    if (at && existsSync(resolve(repo, at))) return true
  }
  return false
}

/**
 * 치워 둘 자리 — `prefixes`(저장소 기준, 예: `forge/_layout`) 가운데 바뀐 파일이 든 것.
 * **하나라도 어긋나면 빈 목록**이다 — 그러면 부르는 쪽은 예전처럼 안 받는다.
 */
export async function asideOf(repo: string, prefixes: string[]): Promise<string[]> {
  const now = await changes(repo)
  if (!now.length) return []
  // 미리 담아 둔 것(앞 글자)이 있으면 안 된다 — 충돌 중(UU 등) · 이름 바꾸기도 여기서 걸린다
  if (now.some((c) => c.xy[0] !== ' ')) return []
  const under = (p: string, dir: string): boolean => p.startsWith(`${dir.replace(/\/$/, '')}/`)
  if (!now.every((c) => prefixes.some((d) => under(c.path, d)))) return []
  if (await unfinished(repo)) return []
  // 원격에 안 올린 커밋이 있으면 갈라질 수 있다 — 사람이 판단한다. 원격 가지가 없으면 받을 수도 없다
  const ahead = await tryGit(repo, ['rev-list', '--count', '@{u}..HEAD'], ASK_TIMEOUT)
  if (!ahead.ok || Number(ahead.out.trim()) !== 0) return []
  return prefixes.filter((d) => now.some((c) => under(c.path, d)))
}

/** stash 맨 위 커밋 — 없으면 빈 글 */
const stashTop = async (repo: string): Promise<string> =>
  (await tryGit(repo, ['rev-parse', '-q', '--verify', 'refs/stash'], ASK_TIMEOUT)).out.trim()

/**
 * 치워 두기. **stash 가 실제로 하나 늘었을 때만 참** — 아니면 나중에 pop 하면 사람이 전에 넣어 둔 stash 를 꺼낸다.
 * 바뀐 파일 수도 같이 돌려준다(알림 글).
 */
export async function setAside(repo: string, dirs: string[]): Promise<{ stashed: boolean; count: number; why?: string }> {
  const count = (await changes(repo)).length
  const before = await stashTop(repo)
  let why: string | undefined
  try {
    await git(repo, ['stash', 'push', '--quiet', '-m', MARK, '--', ...dirs], STASH_TIMEOUT, LITERAL)
  } catch (error) {
    why = toMessage(error)
  }
  const after = await stashTop(repo)
  return { stashed: Boolean(after) && after !== before, count, why }
}

/** 충돌로 멈춘 파일 — porcelain 의 두 글자가 이 꼴이다 */
const UNMERGED = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

/** 휴지통에 넣을 이름 — 이름이 같은 것이 둘이면(`_spec/EN/M07.json` 과 `_spec/MA/M07.json`) 위 폴더 이름을 앞에 붙인다 */
function copyName(p: string, used: Set<string>): string {
  const ext = extname(p)
  const stem = basename(p, ext)
  let name = `${stem} 내가 고친 것${ext}`
  if (used.has(name)) name = `${basename(dirname(p))} ${name}`
  for (let i = 2; used.has(name); i++) name = `${stem} 내가 고친 것 ${i}${ext}`
  used.add(name)
  return name
}

/**
 * 받은 내용으로 덮기 전에 고친 내용을 휴지통에 넣는다 (2026-10-21). 디스크의 파일은 충돌 표시(<<<<)가 든 것이라 안 쓰고
 * 치워 둔 stash 커밋(`top`)에서 꺼낸다(`--filters` — 줄바꿈까지 작업 폴더에 있던 꼴로). 휴지통은 앱이 넘겨준 것만 쓴다(`lib/trash`) —
 * 임시 폴더에 알아보기 쉬운 이름으로 적고 그것을 옮긴다. 못 옮긴 파일은 `failed` — 그 내용은 stash 에만 있다. stash 에 없는 파일(사람이 지웠다)은 건너뛴다
 */
async function keepMine(repo: string, top: string, paths: string[]): Promise<{ names: string[]; failed: string[] }> {
  const [names, failed]: [string[], string[]] = [[], []]
  if (!paths.length || !top) return { names, failed }
  let dir = ''
  try {
    dir = await mkdtemp(join(tmpdir(), 'sparkon-update-'))
    const used = new Set<string>()
    for (const p of paths) {
      const mine = await tryGit(repo, ['cat-file', '--filters', `${top}:${p}`], STASH_TIMEOUT)
      if (!mine.ok) continue
      const file = join(dir, copyName(p, used))
      try {
        await writeFile(file, mine.out)
        await toTrash(file)
        names.push(basename(file))
      } catch {
        failed.push(p)
      }
    }
  } catch {
    failed.push(...paths) // 임시 폴더를 못 만들었다 — 하나도 못 넣었다
  }
  if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined) // 남은 것은 옮기지 못한 사본 — 앱이 방금 만든 임시 파일
  return { names, failed }
}

/**
 * 치워 둔 것을 다시 적용한다(`stash pop`). 겹쳐 충돌한 파일은 고친 내용을 휴지통에 넣고 받은 내용(HEAD)으로 돌린다. stash 는 남긴다.
 * 돌려주는 글은 사람이 읽을 한 줄 — 잘 됐으면 빈 글.
 */
export async function bringBack(repo: string, dirs: string[]): Promise<{ ok: boolean; note: string }> {
  // pop 이 겹쳐 실패하면 stash 는 그대로다 — 고친 내용을 꺼낼 커밋을 pop 전에 못 박아 둔다
  const top = await stashTop(repo)
  const pop = await tryGit(repo, ['stash', 'pop', '--quiet'], STASH_TIMEOUT)
  if (pop.ok) return { ok: true, note: '' }
  const kept = '직접 고친 내용은 git stash 목록에 남아 있습니다.'
  try {
    const conflicted = (await changes(repo)).filter((c) => UNMERGED.has(c.xy)).map((c) => c.path)
    if (!conflicted.length) {
      // 아무것도 적용하지 못한 경우(그 사이 다른 것이 그 파일을 고쳤다 · 시간 상한 등)
      return { ok: false, note: `직접 고친 스펙과 배치표 파일을 다시 적용하지 못했습니다. ${kept} (${pop.err.replace(/\s+/g, ' ').trim()})` }
    }
    // 충돌 뒤 git 은 깨끗이 합쳐진 파일을 미리 담아 둔다 — 그대로 두면 다음 업데이트가 「미리 담은 것」으로 막힌다.
    // 치우기 전에는 미리 담은 것이 없었으니(asideOf) 이 자리의 index 를 HEAD 로 돌리면 예전 모양이다
    await git(repo, ['reset', '-q', '--', ...dirs], STASH_TIMEOUT, LITERAL)
    const inHead: string[] = []
    const left: string[] = []
    const binned: string[] = []
    for (const p of conflicted) {
      if ((await tryGit(repo, ['cat-file', '-e', `HEAD:${p}`], ASK_TIMEOUT)).ok) inHead.push(p)
      // 받은 쪽에서 지운 파일 — reset 뒤 올리지 않은 파일로 남는다(충돌 표시 없이 고친 내용 그대로). forge 는 디스크의 스펙을 읽으니
      // 남겨 두면 지운 스펙이 살아 있다. 휴지통으로 옮긴다. 휴지통을 못 쓰면(Node 로만 돌 때) 그대로 두고 알린다
      else if (existsSync(resolve(repo, p))) await toTrash(resolve(repo, p)).then(() => binned.push(basename(p)), () => left.push(p))
    }
    const mine = await keepMine(repo, top, inHead)
    if (inHead.length) await git(repo, ['checkout', 'HEAD', '--', ...inHead], STASH_TIMEOUT, LITERAL)
    binned.unshift(...mine.names)
    const notes = [
      `직접 고친 파일 ${conflicted.length}개가 받은 내용과 겹쳐서 받은 내용으로 바꿨습니다: ${conflicted.join(', ')}.`,
      binned.length ? `고친 내용은 휴지통에 ${binned.map((n) => `「${n}」`).join(', ')} 이름으로 넣었고 git stash 목록에도 남아 있습니다.` : '',
      mine.failed.length ? `휴지통에 넣지 못해 고친 내용은 git stash 목록에만 남아 있습니다: ${mine.failed.join(', ')}.` : '',
      left.length ? `받은 쪽에서 지운 파일 ${left.length}개는 휴지통으로 옮기지 못해 그대로 두었습니다: ${left.join(', ')}.` : '',
      binned.length || mine.failed.length ? '' : kept
    ]
    return { ok: false, note: notes.filter(Boolean).join(' ') }
  } catch (error) {
    return { ok: false, note: `직접 고친 스펙과 배치표 파일을 정리하지 못했습니다. ${kept} (${toMessage(error)})` }
  }
}
