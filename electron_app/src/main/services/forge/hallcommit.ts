/**
 * **「양산 완료 커밋」 · 「main에 올리기」** — 검수 완료한 학습코드 하나를 호 저장소에 커밋 · 푸시한다 (2026-09-30 사용자 결정).
 * main 에 올리는 것은 **따로 누른다** (2026-10-02 사용자 말 — 「메인에 머지하는 것도 따로, 이후에 버튼 활성화되게 분리」).
 *
 * 사람이 호 저장소에서 손으로 하던 것 — 그 학습코드의 두 자리만 담아 `<학습코드> 양산 완료` 로 커밋하고, 지금 가지를
 * 푸시한다. 2026-09-29 에 Claude 가 대신 하다 문구를 틀렸고(「9호 분리수거 …」), 안 끝난 것을 커밋했다.
 * 그래서 빗장을 둔다 —
 *
 *   ① **검수 완료가 먼저** — activityInfo.json 이 개발 완료이고 우리 팀 것이어야 한다(두 단추 다)
 *   ② **그 학습코드의 두 자리만** 담는다(`src/activity/<코드>` · `public/sparklab/<코드>`).
 *      남이 미리 담아 둔(staged) 것이 다른 자리에 있으면 **안 한다** — 그것까지 같이 커밋된다
 *   ③ main 에는 **앞질러 가기(fast-forward)일 때만** 올린다. main 이 앞서 있으면 그렇다고 말하고 사람에게 둔다
 *   ④ 사람이 누를 때만. 커밋 문구는 이 한 꼴(메모리 「호 저장소는 다 만든 뒤에만 커밋」과 같은 규칙)
 *
 * **받아 오기(pull)는 안 한다.** 원격 가지가 앞서 있으면 푸시가 git 오류로 멈춘다 — 합치는 것은 사람이 호 저장소에서 한다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CommitResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git, lines } from '../../lib/git'
import { mark } from './measure'
import { loadForge, type Forge } from './runtime'
import { repoOf } from './writecheck'

const T = 60_000

const fail = (error: string, done: string[] = []): CommitResult => ({ ok: false, done, error })

/** ① 검수 완료 · 우리 팀 — 통과하면 호 저장소 자리, 아니면 까닭 */
function gate(forge: Forge, code: string): { repo: string } | { error: string } {
  const repo = repoOf(forge.paths, code)
  if (!repo) return { error: '호 저장소 위치를 정하지 못했습니다.' }
  let info: { devFinished?: unknown; devTeam?: unknown } = {}
  try {
    info = JSON.parse(readFileSync(join(repo, 'src', 'activity', code, 'activityInfo.json'), 'utf8')) as typeof info
  } catch {
    return { error: '호 저장소에 이 액티비티가 없습니다.' }
  }
  if (info.devFinished !== true) return { error: '먼저 「검수 완료」를 누르세요.' }
  if (info.devTeam !== forge.user.loadUser().devTeam) return { error: `${String(info.devTeam)} 담당 액티비티라 커밋하지 않습니다.` }
  return { repo }
}

const branchOf = async (repo: string): Promise<string> => (await git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'], T)).trim()

export async function commitDone(code: string): Promise<CommitResult> {
  const done: string[] = []
  try {
    const forge = await loadForge()
    const ok = gate(forge, code)
    if ('error' in ok) return fail(ok.error)
    const { repo } = ok

    // ② 그 학습코드의 두 자리만
    const mine = [`src/activity/${code}`, `public/sparklab/${code}`]
    // 한글 파일 이름이 따옴표 · 8진수로 오면 「다른 자리」로 잘못 센다 — 있는 그대로 받는다
    const staged = lines(await git(repo, ['-c', 'core.quotepath=false', 'diff', '--cached', '--name-only'], T))
    const others = staged.filter((f) => !mine.some((m) => f.startsWith(`${m}/`)))
    if (others.length) return fail(`호 저장소에 미리 담아 둔 다른 파일이 ${others.length}개 있어 커밋하지 않습니다 (${others[0]} …).`)
    const changed = lines(await git(repo, ['status', '--porcelain', '--', ...mine], T))
    if (changed.length) {
      await git(repo, ['add', '-A', '--', ...mine], T)
      await git(repo, ['commit', '-q', '-m', `${code} 양산 완료`], T)
      done.push(`「${code} 양산 완료」로 커밋했습니다 (파일 ${changed.length}개)`)
    } else {
      done.push('새로 커밋할 것이 없습니다')
    }

    // 지금 가지를 푸시 — main 은 「main에 올리기」가 따로 한다
    const branch = await branchOf(repo)
    await git(repo, ['push', '-q', 'origin', 'HEAD'], T)
    done.push(`${branch} 브랜치를 푸시했습니다`)
    mark(forge.paths.REPO_ROOT, code, '커밋', branch)
    if (branch === 'main') return { ok: true, done, branch, note: '' }
    // main 에 갈 것을 미리 보인다 — 「main에 올리기」는 이것을 보고 누른다. 못 재도 커밋 · 푸시는 된 것이다
    const plan = await mainPlan(repo).catch(() => null)
    return { ok: true, done, branch, ...(plan ? { toMain: plan } : {}), note: plan ? planNote(plan) : 'main 에 갈 커밋을 확인하지 못했습니다.' }
  } catch (error) {
    return fail(`git 명령이 실패했습니다: ${toMessage(error)}`, done)
  }
}

const DONE_SUBJECT = /^([A-Z]{2}L\d+M\d{2}W\d+S\d+) 양산 완료$/

type Plan = NonNullable<CommitResult['toMain']>

/**
 * **main 에 무엇이 가나** (2026-10-02 사용자 결정). `HEAD:main` 은 지금 가지의 커밋을 **통째로** 올린다 —
 * 이 학습코드 것만 골라 올리지 않는다. 그래서 갈 커밋을 하나씩 본다 —
 *
 *   - 「<학습코드> 양산 완료」이고 그 학습코드의 두 자리만 바꾼 커밋 → `codes`(그냥 올린다)
 *   - 합친 커밋 → 안 센다. main 을 받아 합치라고 안내하는데 그것을 막으면 영영 못 올린다. 딸려 온 커밋은 따로 하나씩 본다
 *   - 그 밖의 커밋 → `extra`. **막지 않고 보여 준다** — 사람이 그 목록을 보고 한 번 더 눌러야 올린다(오타 고침처럼 일부러 만든 커밋)
 */
async function mainPlan(repo: string): Promise<Plan> {
  await git(repo, ['fetch', '-q', 'origin', 'main'], T)
  const has = (a: string, b: string): Promise<boolean> =>
    git(repo, ['merge-base', '--is-ancestor', a, b], T).then(
      () => true,
      () => false
    )
  if (await has('HEAD', 'origin/main')) return { codes: [], extra: [], state: 'none' }
  if (!(await has('origin/main', 'HEAD'))) return { codes: [], extra: [], state: 'behind' }
  const codes: string[] = []
  const extra: Plan['extra'] = []
  for (const row of lines(await git(repo, ['log', '--reverse', '--no-merges', '--format=%H%x09%s', 'origin/main..HEAD'], T))) {
    const [sha = '', subject = ''] = row.split('\t')
    const label = `${sha.slice(0, 7)} 「${subject}」`
    const code = DONE_SUBJECT.exec(subject)?.[1]
    if (!code) {
      extra.push({ sha, why: `${label}: 「<학습코드> 양산 완료」 커밋이 아닙니다` })
      continue
    }
    const mine = [`src/activity/${code}/`, `public/sparklab/${code}/`]
    const files = lines(await git(repo, ['-c', 'core.quotepath=false', 'diff-tree', '--no-commit-id', '--name-only', '-r', sha], T))
    const out = files.filter((f) => !mine.some((m) => f.startsWith(m)))
    if (out.length) extra.push({ sha, why: `${label}: ${code} 폴더 밖의 파일 ${out.length}개를 바꿨습니다 (${out[0]} …)` })
    else codes.push(code)
  }
  return { codes, extra, state: 'ready' }
}

/** main 에 갈 것을 한 줄로 — 화면 · 결과가 같이 쓴다. 다른 커밋 목록은 화면이 따로 줄줄이 보인다 */
function planNote(p: Plan): string {
  if (p.state === 'none') return 'main 브랜치에 이미 올라가 있습니다.'
  if (p.state === 'behind') return 'main 브랜치가 앞서 있어 올릴 수 없습니다. 호 저장소에서 main 을 받아 합친 뒤 다시 누르세요.'
  const done = p.codes.length ? `양산 완료 커밋 ${p.codes.length}개(${p.codes.join(', ')})` : ''
  const other = p.extra.length ? `다른 커밋 ${p.extra.length}개` : ''
  return `main 에 갈 커밋: ${[done, other].filter(Boolean).join(', ') || '없음'}`
}

/**
 * ③ 지금 가지를 main 에 — 앞질러 가기일 때만. 지금 가지가 main 이면 할 것이 없다.
 * `allow` — 사람이 화면에서 보고 「포함해 올리기」를 누른 다른 커밋. **누른 때 다시 재서** 그 밖의 다른 커밋이 생겼으면 안 올리고 새 목록을 돌려준다
 */
export async function pushMain(code: string, allow: string[] = []): Promise<CommitResult> {
  const done: string[] = []
  try {
    const forge = await loadForge()
    const ok = gate(forge, code)
    if ('error' in ok) return fail(ok.error)
    const { repo } = ok
    const branch = await branchOf(repo)
    if (branch === 'main') return { ok: true, done, branch, note: '지금 브랜치가 main 이라 따로 올릴 것이 없습니다.' }

    // 누른 때 다시 본다 — 화면에 보인 계획 뒤로 가지가 바뀌었을 수 있다
    const plan = await mainPlan(repo)
    if (plan.state === 'none') return { ok: true, done, branch, toMain: plan, note: planNote(plan) }
    if (plan.state === 'behind') return { ...fail(planNote(plan)), branch, toMain: plan }
    const unseen = plan.extra.filter((e) => !allow.includes(e.sha))
    if (unseen.length) {
      return { ...fail(`확인하지 않은 다른 커밋 ${unseen.length}개가 있어 올리지 않았습니다. 목록을 보고 다시 누르세요.`), branch, toMain: plan }
    }
    await git(repo, ['push', '-q', 'origin', 'HEAD:main'], T)
    // 로컬 main 도 따라오게 — 꺼내 둔 가지가 아니라 그냥 옮길 수 있다
    await git(repo, ['fetch', '-q', 'origin', 'main:main'], T).catch(() => undefined)
    done.push(`${planNote(plan).replace('main 에 갈 커밋: ', '')}를 main 브랜치에 올렸습니다`)
    mark(forge.paths.REPO_ROOT, code, 'main', branch)
    return { ok: true, done, branch, toMain: { ...plan, state: 'none' }, note: '' }
  } catch (error) {
    return fail(`git 명령이 실패했습니다: ${toMessage(error)}`, done)
  }
}
