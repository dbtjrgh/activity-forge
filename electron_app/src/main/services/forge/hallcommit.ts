/**
 * **「양산 완료 커밋」** — 검수 완료한 학습코드 하나를 호 저장소에 커밋 · 푸시한다 (2026-09-30 사용자 결정).
 * main 에 올리는 것은 진행판의 **「main 에 모두 올리기」** 가 저장소마다 한 번에 한다(`hallsync.ts`, 2026-10-14 사용자 말 —
 * 「하나하나 올리는 것보다 메인에 한 번에 다 올리는 식으로」). 학습코드마다 누르던 「main에 올리기」(2026-10-02)는 걷었다.
 *
 * 사람이 호 저장소에서 손으로 하던 것 — 그 학습코드의 두 자리만 담아 `<학습코드> 양산 완료` 로 커밋하고, 지금 가지를
 * 푸시한다. 2026-09-29 에 Claude 가 대신 하다 문구를 틀렸고(「9호 분리수거 …」), 안 끝난 것을 커밋했다.
 * 그래서 빗장을 둔다 —
 *
 *   ① **검수 완료가 먼저** — activityInfo.json 이 개발 완료이고 내 것이어야 한다(`owner.ts`).
 *      남이 끝낸 것은 작업대의 「그래도 고치기」(`force`)로만 커밋한다(2026-10-14)
 *   ② **그 학습코드의 두 자리만** 담는다(`src/activity/<코드>` · `public/sparklab/<코드>`).
 *      남이 미리 담아 둔(staged) 것이 다른 자리에 있으면 **안 한다** — 그것까지 같이 커밋된다
 *   ③ 사람이 누를 때만. 커밋 문구는 두 꼴 — 처음 끝낼 때 `<학습코드> 양산 완료`, 이미 개발 완료로 커밋한 것을 고칠 때
 *      `<학습코드> 수정사항 반영`(`doneSubject`). 2026-10-14 에 9호 MAL1M08W2S1 을 고친 것을 사람이 손으로 그 문구로 올렸다
 *   ④ 커밋 직전에 타입 검사(`halltsc.ts`) — 이 학습코드에 오류가 있거나 못 돌렸으면 안 한다. 대화 뒤에 손으로 고친 것은 아무도 다시 안 쟀다
 *   ⑤ **main 브랜치에서는 안 한다** (2026-10-16 사용자 결정) — 지금 브랜치를 그대로 푸시하므로 main 이면 main 으로 바로 올라간다.
 *      초기 설정 뒤에 받은 호 저장소는 main 에 남는다(내 브랜치를 만드는 곳은 `setupprep.ts` 하나)
 *
 * **받아 오기(pull)는 안 한다.** 원격 가지가 앞서 있으면 푸시가 git 오류로 멈춘다 — 받아 합치는 것은 「main 에 모두 올리기」가 한다.
 *
 * 저장소 뿌리를 받는 쪽(`commitDoneIn`)과 양산기 설정으로 그 뿌리를 찾는 쪽(`commitDone`)을 나눴다 —
 * 「main 에 모두 올리기」가 저장소마다 앞쪽을 부르고, 시험 저장소로도 돌린다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { onMainBranch, type CommitResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git, lines, stagedOutside } from '../../lib/git'
import { josa } from '../../lib/josa'
import { hallTsc, tscBlock } from './halltsc'
import { mark } from './measure'
import { committedInfo, ownerAt, ownerLine } from './owner'
import { loadForge } from './runtime'
import { repoOf } from './writecheck'

const T = 60_000

type Me = { developer: string; devTeam: string }

const fail = (error: string, done: string[] = []): CommitResult => ({ ok: false, done, error })

/** 검수 완료 · 내 것인가 — 비면 통과. 「main 에 모두 올리기」 계획(`hallsyncplan.ts`)도 이것을 써서 계획과 실행이 같은 말을 한다 */
export function ownerWhy(o: ReturnType<typeof ownerAt>, force = false): string {
  if (o.finished === null) return '호 저장소의 activityInfo.json 을 읽지 못했습니다.'
  if (!o.finished) return '먼저 「검수 완료」를 누르세요.'
  if (o.theirs && !force) return `${ownerLine(o)} 커밋하지 않습니다.`
  return ''
}

/** ① 검수 완료 · 내 것 — 비면 통과, 아니면 까닭. 남이 끝낸 것은 `force` 일 때만 */
function gate(repo: string, code: string, me: Me, force: boolean): string {
  if (!repo) return '호 저장소 위치를 정하지 못했습니다.'
  if (!existsSync(join(repo, 'src', 'activity', code, 'activityInfo.json'))) return '호 저장소에 이 액티비티가 없습니다.'
  return ownerWhy(ownerAt(repo, code, me), force)
}

const branchOf = async (repo: string): Promise<string> => (await git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'], T)).trim()

/** 학습코드를 마치는 커밋의 두 꼴 — 아래 `doneSubject` 가 만드는 문구를 다시 읽는다. 한쪽만 고치면 main 에 올린 학습코드 기록이 조용히 빠진다 */
export const DONE_SUBJECT = /^([A-Z]{2}L\d+M\d{2}W\d+S\d+) (?:양산 완료|수정사항 반영)$/

/** ③ 커밋 문구 — 마지막 커밋에서 이미 개발 완료면 고친 것을 올리는 커밋이다 */
export async function doneSubject(repo: string, code: string): Promise<string> {
  return (await committedInfo(repo, code))?.devFinished === true ? `${code} 수정사항 반영` : `${code} 양산 완료`
}

/** 그 학습코드의 두 자리 — 담는 것도 「밖」을 가르는 것도 이것으로 */
export const codeDirs = (code: string): string[] => [`src/activity/${code}`, `public/sparklab/${code}`]

/**
 * `force` — 남이 끝낸 학습코드도 커밋한다(작업대 「그래도 고치기」). `push` — 지금 가지를 푸시한다(기본).
 * false 면 커밋만 하고 돌려준다 — 「main 에 모두 올리기」가 저장소마다 푸시를 따로 한다
 */
export async function commitDone(code: string, opts: { force?: boolean; push?: boolean } = {}): Promise<CommitResult> {
  try {
    const forge = await loadForge()
    const r = await commitDoneIn(repoOf(forge.paths, code), code, forge.user.loadUser(), opts)
    if (r.ok) mark(forge.paths.REPO_ROOT, code, '커밋', r.branch)
    return r
  } catch (error) {
    return fail(`git 명령이 실패했습니다: ${toMessage(error)}`)
  }
}

/** 저장소 뿌리 `repo` 를 받는 쪽 — 양산기 설정을 안 읽는다(`me` 는 설정의 만든 사람 · 팀) */
export async function commitDoneIn(repo: string, code: string, me: Me, opts: { force?: boolean; push?: boolean } = {}): Promise<CommitResult> {
  const { force = false, push = true } = opts
  const done: string[] = []
  try {
    const stop = gate(repo, code, me, force)
    if (stop) return fail(stop)
    // ⑤ main 이면 담기 전에 멈춘다
    const branch = await branchOf(repo)
    if (onMainBranch(branch)) return fail(`${branch} 브랜치에서는 커밋하지 않으니, 호 저장소를 내 브랜치로 바꾼 뒤 다시 누르세요.`)

    // ② 그 학습코드의 두 자리만
    const mine = codeDirs(code)
    const others = await stagedOutside(repo, mine, T)
    if (others.length) return fail(`호 저장소에 미리 담아 둔 다른 파일이 ${others.length}개 있어 커밋하지 않습니다 (${others[0]} …).`)
    // `-uall` — 새 폴더가 한 줄(`?? dir/`)로 와서 파일 수가 적게 나왔다. `-c core.quotepath=false` — 한글 이름도 자리로 가른다
    const changed = lines(await git(repo, ['-c', 'core.quotepath=false', 'status', '--porcelain', '-uall', '--', ...mine], T))
    if (changed.length) {
      // ④ 담기 전에 — 막히면 색인도 안 건드린다. 새로 커밋할 것이 없으면(올라간 것만 푸시) 안 잰다
      const types = await hallTsc(repo, code)
      const block = tscBlock(types, '커밋')
      if (block) return { ...fail(block), ...(types.lines.length ? { tscErrors: types.lines } : {}) }
      const subject = await doneSubject(repo, code)
      // 바뀐 것이 있는 자리만 담는다 — `public/sparklab/<코드>` 가 아예 없는 학습코드에서 `git add` 가
      // 「pathspec did not match」로 실패했다(2026-10-14, 「main 에 모두 올리기」 시험 저장소에서 찾음)
      const touched = mine.filter((m) => changed.some((l) => l.slice(3).replace(/^"/, '').startsWith(`${m}/`)))
      await git(repo, ['add', '-A', '--', ...(touched.length ? touched : mine)], T)
      await git(repo, ['commit', '-q', '-m', subject], T)
      // 「수정사항 반영」은 받침이 있다 — 「반영」로 찍히지 않게(2026-10-14)
      done.push(`「${subject}」${josa(subject, '으로', '로')} 커밋했습니다 (파일 ${changed.length}개)`)
    } else {
      done.push('새로 커밋할 것이 없습니다')
    }

    if (!push) return { ok: true, done, branch, note: '' }
    // 지금 가지만 푸시 — main 은 진행판의 「main 에 모두 올리기」가 한다.
    // `-u` — 처음 설정이 만든 브랜치는 따라갈 원격 브랜치가 없다(`--no-track`). 첫 푸시에 `origin/<브랜치>` 를 걸어야
    // 원격보다 뒤처졌나(`behind.ts`)가 「모름」에서 벗어난다. 이미 걸려 있으면 같은 값을 다시 쓸 뿐이다(2026-10-16)
    await git(repo, ['push', '-q', '-u', 'origin', 'HEAD'], T)
    done.push(`${branch} 브랜치를 푸시했습니다`)
    return { ok: true, done, branch, note: '' }
  } catch (error) {
    return fail(`git 명령이 실패했습니다: ${toMessage(error)}`, done)
  }
}
