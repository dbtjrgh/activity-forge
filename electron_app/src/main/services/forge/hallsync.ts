/**
 * **「main 에 모두 올리기」 실행 — 저장소 하나** (2026-10-14 사용자 말 — 「충돌 안 나게 체크부터 하고 동기화하고 커밋 푸시 메인 머지」).
 * 계획은 `hallsyncplan.ts`, 여러 저장소를 차례로 부르는 입구는 `hallsyncall.ts`.
 *
 * 차례 — 하나라도 안 되면 **그 저장소는 거기서 멈추고** 까닭을 한 문장으로 돌려준다(앞에서 한 커밋은 남는다. 다음에 누르면 목록에 보인다)
 *
 *   ⓪ 누른 때 계획을 다시 잰다 — 화면에 보인 커밋만 만든다(그새 생긴 변경은 사람이 못 봤다)
 *   ① 받아 오기(fetch)
 *   ② 원격 같은 브랜치가 앞서 있으면 앞질러 가기로만 따라간다(`merge --ff-only`). 갈라졌으면 멈춘다.
 *      `pull` 을 안 쓰는 까닭 — 방금 받았고, 사람의 pull 설정(rebase 등)을 타면 무엇이 일어날지 모른다
 *   ③ origin/main 에 내 브랜치에 없는 커밋이 있으면 합친다 — 문구 「main 동기화」(이 저장소들의 관례 b074f49).
 *      충돌이면 충돌 파일을 적어 두고 `merge --abort` 로 되돌린 뒤 멈춘다. 커밋 안 한 파일이 합치기를 막으면 그 파일을 보이고 멈춘다
 *   ④ 커밋 — 공용은 모듈마다 「<모듈> 수정사항으로 인한 모듈 변경」, 호는 학습코드마다 「양산 완료 커밋」과 같은 길(push 없이).
 *      그 길이 커밋 직전에 타입 검사를 한다 — 「커밋한 학습코드마다 타입 검사 통과」가 거기서 지켜진다(따로 한 번 더 돌리면 10초씩 는다)
 *   ⑤ main 에 갈 커밋 가운데 화면에서 못 본 것이 있으면 멈춘다(②에서 받아 온 남의 커밋 같은 것)
 *   ⑥ 지금 브랜치를 푸시 → 다시 받아 origin/main 이 내 브랜치의 조상일 때만 `<브랜치>:main` 으로 올린다
 *
 * **강제 푸시는 어떤 경우에도 하지 않는다.** main · 남의 브랜치는 위 방법으로만 바뀐다.
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { SyncRepoDone } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git, isAncestor, lines, tryGit } from '../../lib/git'
import { josa } from '../../lib/josa'
import { DONE_SUBJECT } from './hallcommit'
import { aheadOf, commitDirs, merging, moduleDir, planRepo, type HallDeps } from './hallsyncplan'

const T = 60_000
/** 받기 · 푸시 — 망을 타는 것 */
const NET = 120_000

/** 저장소 하나 — `hall` 이 없으면 공용 */
export type SyncTarget = { dir: string; hall?: { month: string } }

/** git 글의 첫 줄 — 멈춘 까닭 뒤에 붙인다. 업데이트가 공용 저장소를 받을 때도 쓴다(`commonpull.ts`) */
export const first = (s: string): string => s.trim().split(/\r?\n/)[0]?.slice(0, 200) ?? ''

/** 합치기를 막은 파일 — git 이 탭으로 들여 적는다. 업데이트가 공용 저장소를 받을 때도 쓴다(`commonpull.ts`) */
export const blockers = (err: string): string[] =>
  err
    .split(/\r?\n/)
    .filter((l) => l.startsWith('\t'))
    .map((l) => l.trim())

/** ③ 의 결과 — 합친 커밋 수(0 이면 합칠 것이 없었다), 못 합쳤으면 충돌인가 · 그 파일 · 취소했나 · git 글 */
export type MainMerge =
  | { ok: true; merged: number }
  | { ok: false; conflict: boolean; files: string[]; aborted: boolean; err: string }

/**
 * ③ origin/main 을 지금 브랜치에 합친다 — 문구 「main 동기화」. 받아 오기(fetch)는 부르는 쪽이 먼저 한다.
 * 충돌이면 충돌 파일을 적어 두고 `merge --abort` 로 되돌린다. 커밋 안 한 파일이 막으면 git 이 아무것도 안 바꾸고 그 파일을 댄다.
 * 2026-10-21 에 「업데이트」가 공용 저장소를 받을 때도 같은 합치기를 쓰려고 `syncRepo` 에서 떼어 냈다(동작 변화 없음)
 */
export async function mergeMain(dir: string): Promise<MainMerge> {
  const behindMain = Number((await git(dir, ['rev-list', '--count', 'HEAD..origin/main'], T)).trim())
  if (!behindMain) return { ok: true, merged: 0 }
  const m = await tryGit(dir, ['-c', 'core.quotepath=false', 'merge', '--no-edit', '-m', 'main 동기화', 'origin/main'], T)
  if (m.ok) return { ok: true, merged: behindMain }
  if (await merging(dir)) {
    const files = lines(await git(dir, ['-c', 'core.quotepath=false', 'diff', '--name-only', '--diff-filter=U'], T))
    const back = await tryGit(dir, ['merge', '--abort'], T)
    return { ok: false, conflict: true, files, aborted: back.ok, err: m.err }
  }
  return { ok: false, conflict: false, files: blockers(m.err), aborted: false, err: m.err }
}

const headSha = async (dir: string): Promise<string> => (await git(dir, ['rev-parse', 'HEAD'], T)).trim()
const refSha = async (dir: string, ref: string): Promise<string> => (await tryGit(dir, ['rev-parse', '-q', '--verify', ref], T)).out.trim()

/** `shown` 화면이 보인 열쇠(`syncKeys`), `say` 진행 줄 */
export async function syncRepo(t: SyncTarget, shown: Set<string>, deps: HallDeps, say: (line: string) => void): Promise<SyncRepoDone> {
  const plan = await planRepo(t.dir, t.hall ? { month: t.hall.month, me: deps.me, busy: deps.busy } : undefined)
  const name = plan.name
  const done: string[] = []
  const note = (line: string): void => {
    done.push(line)
    say(line)
  }
  const stop = (stopped: string, extra: Partial<SyncRepoDone> = {}): SyncRepoDone => {
    say(stopped)
    return { name, ok: false, done, stopped, ...extra }
  }
  if (plan.error) return stop(`계획을 다시 재지 못했습니다. ${plan.error}`)
  if (plan.blocked) return stop(plan.blocked)

  try {
    // ⓪ 화면에 보인 것만
    const commits = plan.commits.filter((c) => shown.has(`c:${name}:${c.key}`))
    const fresh = plan.commits.length - commits.length
    if (fresh) note(`목록에 없던 변경 ${fresh}개는 커밋하지 않습니다.`)
    const seen = new Set([...shown].filter((k) => k.startsWith(`s:${name}:`)).map((k) => k.slice(`s:${name}:`.length)))
    const branch = plan.branch

    // ① 받아 오기
    say('원격에서 받아 오는 중입니다.')
    const got = await tryGit(t.dir, ['fetch', '-q', 'origin'], NET)
    if (!got.ok) return stop(`원격에서 받아 오지 못했습니다. ${first(got.err)}`)

    // ② 원격 같은 브랜치를 앞질러 가기로만
    if (await refSha(t.dir, `refs/remotes/origin/${branch}`)) {
      const [behind = 0, ahead = 0] = (await git(t.dir, ['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`], T)).trim().split(/\s+/).map(Number)
      if (behind && ahead) return stop(`원격 ${branch} 브랜치와 갈라져 있습니다. ${name} 저장소에서 직접 합치세요.`)
      if (behind) {
        const ff = await tryGit(t.dir, ['-c', 'core.quotepath=false', 'merge', '--ff-only', '-q', `origin/${branch}`], T)
        if (!ff.ok) return stop(`원격 ${branch} 브랜치를 받지 못했습니다. ${name} 저장소에서 직접 받으세요.`, { files: blockers(ff.err) })
        note(`원격 ${branch} 브랜치의 커밋 ${behind}개를 받았습니다.`)
      }
    }

    // ③ main 동기화 — 지금 브랜치가 main 이면 계획이 막았다(`hallsyncplan.ts` 의 `headOf`)
    const m = await mergeMain(t.dir)
    if (!m.ok) {
      const files = m.files
      if (m.conflict) {
        const tail = m.aborted ? '합치기를 취소했습니다.' : '합치기를 취소하지 못했습니다. 저장소를 직접 확인하세요.'
        return stop(`main 과 합치다 파일 ${files.length}개가 충돌해 ${tail} ${name} 저장소에서 직접 합치세요.`, { files })
      }
      return stop(files.length ? `커밋하지 않은 파일이 main 과 합치기를 막았습니다. ${name} 저장소에서 직접 합치세요.` : `main 과 합치지 못했습니다. ${first(m.err)}`, { files })
    }
    if (m.merged) note(`main 의 커밋 ${m.merged}개를 합쳤습니다.`)

    // ④ 커밋 — 담아 둔 것을 먼저 푼다. 다른 모듈 · 학습코드에 담아 둔 파일이 앞 커밋에 딸려 가지 않게(내용은 아래에서 다시 담는다).
    // 화면에 없던 자리까지 푼다 — 그새 담아 둔 파일이 보인 모듈 커밋에 섞이지 않게. 푼 것은 커밋 안 한 변경으로 남는다
    const made = new Set<string>()
    if (commits.length) await git(t.dir, ['reset', '-q', '--', ...commitDirs(plan, plan.commits)], T)
    for (const c of commits) {
      const before = await headSha(t.dir)
      if (!t.hall) {
        await git(t.dir, ['add', '-A', '--', moduleDir(c.key)], T)
        if ((await tryGit(t.dir, ['diff', '--cached', '--quiet'], T)).ok) {
          note(`${c.key} 모듈은 바뀐 것이 없어 넘어갑니다.`)
          continue
        }
        await git(t.dir, ['commit', '-q', '-m', c.subject], T)
      } else {
        say(`${c.key} 타입 검사와 커밋을 하는 중입니다.`)
        const r = await deps.commit(t.dir, c.key)
        if (!r.ok) return stop(`${c.key}: ${r.error ?? '커밋하지 못했습니다.'}`, r.tscErrors?.length ? { tscErrors: r.tscErrors } : {})
      }
      const after = await headSha(t.dir)
      if (after === before) continue
      made.add(after)
      const subject = (await git(t.dir, ['log', '-1', '--format=%s'], T)).trim()
      note(`「${subject}」${josa(subject, '으로', '로')} 커밋했습니다 (파일 ${c.files.length}개).`)
    }

    // ⑤ 못 본 커밋
    const going = await aheadOf(t.dir)
    const unseen = going.filter((a) => !seen.has(a.sha) && !made.has(a.sha))
    if (unseen.length) {
      return stop(`목록에서 확인하지 않은 커밋 ${unseen.length}개가 있어 올리지 않았습니다. 목록을 다시 열어 확인하세요.`, {
        files: unseen.map((a) => `${a.sha.slice(0, 7)} ${a.subject}`)
      })
    }

    // ⑥ 지금 브랜치 → main
    if ((await headSha(t.dir)) !== (await refSha(t.dir, `refs/remotes/origin/${branch}`))) {
      say(`${branch} 브랜치를 푸시하는 중입니다.`)
      // `-u` — 첫 푸시가 여기일 수도 있다. 처음 설정이 만든 브랜치에 `origin/<브랜치>` 를 따라갈 원격 브랜치로 건다(`hallcommit.ts` 와 같은 까닭).
      // 아래 `<브랜치>:main` 푸시에는 붙이지 않는다 — 붙이면 따라갈 원격 브랜치가 main 이 된다
      const p = await tryGit(t.dir, ['push', '-q', '-u', 'origin', `${branch}:refs/heads/${branch}`], NET)
      if (!p.ok) return stop(`${branch} 브랜치를 푸시하지 못했습니다. ${first(p.err)}`)
      note(`${branch} 브랜치를 푸시했습니다.`)
    }
    if (!going.length) {
      note('main 에 이미 다 올라가 있습니다.')
      return { name, ok: true, done }
    }
    const again = await tryGit(t.dir, ['fetch', '-q', 'origin', 'main'], NET)
    if (!again.ok) return stop(`main 에 올리기 전에 원격에서 받아 오지 못했습니다. ${first(again.err)}`)
    if (!(await isAncestor(t.dir, 'origin/main', 'HEAD', T))) return stop('그사이 main 에 새 커밋이 올라와 올리지 않았습니다. 다시 누르세요.')
    const up = await tryGit(t.dir, ['push', '-q', 'origin', `${branch}:refs/heads/main`], NET)
    if (!up.ok) return stop(`main 에 올리지 못했습니다. ${first(up.err)}`)
    // 로컬 main 도 따라오게 — 꺼내 둔 브랜치가 아니라 그냥 옮길 수 있다. 안 돼도 올린 것은 된 것이다
    await tryGit(t.dir, ['fetch', '-q', 'origin', 'main:main'], NET)
    note(`main 에 커밋 ${going.length}개를 올렸습니다.`)
    for (const a of going) {
      const code = DONE_SUBJECT.exec(a.subject)?.[1]
      if (code) deps.marked?.(code, branch)
    }
    return { name, ok: true, done }
  } catch (error) {
    return stop(`git 명령이 실패했습니다. ${toMessage(error)}`)
  }
}
