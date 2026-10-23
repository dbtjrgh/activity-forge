/**
 * **「main 에 모두 올리기」 계획** — 누르기 전에 보일 목록 (2026-10-14 사용자 말 — 「버튼 하나 누르면 확인창 뜨고 그걸 누르면
 * 충돌 안 나게 체크부터 하고 동기화하고 커밋 푸시 메인 머지 하는 식」). 실행은 `hallsync.ts`, 진행판 입구는 `hallsyncall.ts`.
 *
 * - **받아 오지 않는다**(fetch 안 함) — 마지막으로 받은 `origin/main` 기준이다. 누르기만 했는데 남의 저장소를 바꾸면 안 된다
 * - 공용(sparkon_common) — 커밋 안 한 변경 가운데 `_common/module/<과목>/<모듈>/` 안의 것을 모듈마다 한 커밋으로.
 *   문구는 그 저장소의 관례 「<모듈> 수정사항으로 인한 모듈 변경」(6326906). 모듈 밖 변경은 커밋하지 않고 「제외」로 보인다
 * - 호(sparkon_mNN) — 커밋 안 한 변경이 있는 학습코드 가운데 **검수 완료한 내 것**(`owner.ts` mine)만. 만드는 중 · 남의 것 ·
 *   대화가 도는 것 · 학습코드 밖 파일은 「제외」로 보인다. 문구는 「양산 완료 커밋」과 같은 셈(`doneSubject`)
 * - 이미 커밋했는데 main 에 없는 커밋도 보인다(합친 커밋은 뺀다 — 「main 동기화」가 목록을 덮는다)
 * - 실행하면 멈출 것이 지금 보이면(`blocked`) 같이 보인다 — 끝나지 않은 합치기, 브랜치 아님, 원격 가지와 갈라짐, 미리 담아 둔 다른 파일
 *
 * 저장소 뿌리를 받는 순수한 셈이다 — 양산기 설정을 안 읽는다. 시험 저장소로 그대로 돌린다.
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { onMainBranch, type CommitResult, type SyncCommit, type SyncRepo, type SyncSkip } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git, lines, stagedOutside, tryGit } from '../../lib/git'
import { codeDirs, doneSubject, ownerWhy } from './hallcommit'
import { vueTscMissing } from './halltsc'
import { ownerAt } from './owner'

const T = 30_000

/**
 * 호 저장소 쪽에서 양산기만 아는 것 — `me` 설정의 만든 사람 · 팀, `busy` 대화가 도는가(까닭, 비면 안 돎),
 * `commit` 학습코드 커밋(「양산 완료 커밋」과 같은 길), `marked` main 에 올린 학습코드를 기록에(시험에서는 안 넘긴다)
 */
export type HallDeps = {
  me: { developer: string; devTeam: string }
  busy: (code: string) => string
  commit: (repo: string, code: string) => Promise<CommitResult>
  marked?: (code: string, branch: string) => void
}

const MODULE = /^_common\/module\/([^/]+)\/([^/]+)\//
const CODE_IN = /^(?:src\/activity|public\/sparklab)\/([A-Z]{2}L\d+M\d{2}W\d+S\d+)\//
// 학습코드를 마치는 커밋의 두 꼴(`DONE_SUBJECT`)은 문구를 만드는 `hallcommit.ts` 에 같이 둔다

/** 공용 모듈 폴더 — 커밋에 담는 자리 */
export const moduleDir = (key: string): string => `_common/module/${key}`

/** 공용 저장소 안 경로 → 모듈 열쇠(`MA/M28`). 모듈 폴더 밖이면 빈 글 — 회귀 검사(`regresspick.ts`)도 이 셈으로 고친 모듈을 가린다 */
export const moduleKeyOf = (p: string): string => MODULE.exec(p)?.slice(1, 3).join('/') ?? ''

/**
 * 커밋 안 한 파일 — `-z` 로 받는다(띄어쓰기 · 따옴표 든 이름이 그대로 온다), `-uall` 로 새 폴더도 파일마다.
 * 이름 바꾸기(`R`)는 새 이름 다음에 옛 이름이 한 칸 더 온다 — 둘 다 싣는다.
 * `--no-optional-locks` — 보기만 하는 status 가 index 를 고쳐 쓰며 잠그지 않게(사람이 같은 저장소에서 git 을 치고 있을 수 있다)
 */
export async function dirtyPaths(dir: string): Promise<string[]> {
  const parts = (await git(dir, ['--no-optional-locks', 'status', '--porcelain=v1', '-z', '-uall'], T)).split('\0')
  const out: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] as string
    if (p.length < 4) continue
    out.push(p.slice(3))
    if (p[0] === 'R' || p[0] === 'C') out.push(parts[++i] ?? '')
  }
  return out.filter(Boolean)
}

/** 합치기가 충돌로 멈춰 있나 — `.git` 이 파일인 worktree 에서도 맞게 git 에 묻는다 */
export const merging = async (dir: string): Promise<boolean> => (await tryGit(dir, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], T)).ok

/** 지금 브랜치와 막을 까닭 한 문장(비면 없다) — 분리된 HEAD · main 브랜치(2026-10-16 사용자 결정, 「양산 완료 커밋」과 같다) · 끝나지 않은 합치기 · 원격 main 없음 · 원격 가지와 갈라짐 */
async function headOf(dir: string, name: string): Promise<{ branch: string; blocked: string }> {
  const b = (await tryGit(dir, ['symbolic-ref', '-q', '--short', 'HEAD'], T)).out.trim()
  if (!b) return { branch: '', blocked: '지금 브랜치가 없어(분리된 HEAD) 올리지 않습니다.' }
  if (onMainBranch(b)) return { branch: b, blocked: `${name} 저장소가 ${b} 브랜치에 있어 올리지 않으니, 내 브랜치로 바꾼 뒤 다시 누르세요.` }
  if (await merging(dir)) return { branch: b, blocked: `${name} 저장소에 끝나지 않은 합치기가 있습니다. 먼저 마무리하세요.` }
  if (!(await tryGit(dir, ['rev-parse', '-q', '--verify', 'refs/remotes/origin/main'], T)).ok) return { branch: b, blocked: '원격 main 브랜치를 찾지 못했습니다.' }
  const lr = await tryGit(dir, ['rev-list', '--left-right', '--count', `origin/${b}...HEAD`], T)
  const [behind = 0, ahead = 0] = lr.ok ? lr.out.trim().split(/\s+/).map(Number) : []
  if (behind > 0 && ahead > 0) return { branch: b, blocked: `원격 ${b} 브랜치와 갈라져 있습니다. ${name} 저장소에서 직접 합치세요.` }
  return { branch: b, blocked: '' }
}

/** 이미 커밋했는데 origin/main 에 없는 커밋 — 합친 커밋은 뺀다. 실행 쪽이 「확인하지 않은 커밋」을 가를 때도 이것을 본다 */
export async function aheadOf(dir: string): Promise<SyncRepo['ahead']> {
  const r = await tryGit(dir, ['log', '--no-merges', '--format=%H%x09%s', 'origin/main..HEAD'], T)
  if (!r.ok) return []
  return lines(r.out).map((row) => {
    const [sha = '', ...rest] = row.split('\t')
    return { sha, subject: rest.join('\t') }
  })
}

const blank = (dir: string, kind: SyncRepo['kind']): SyncRepo => ({
  name: dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? dir,
  kind,
  branch: '',
  commits: [],
  ahead: [],
  skipped: [],
  blocked: ''
})

/** 묶은 것 → 커밋 · 제외. `why` 가 비면 커밋한다 */
async function split(
  groups: Map<string, string[]>,
  decide: (key: string) => Promise<{ subject: string; why: string }>
): Promise<{ commits: SyncCommit[]; skipped: SyncSkip[] }> {
  const commits: SyncCommit[] = []
  const skipped: SyncSkip[] = []
  for (const [key, files] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const d = await decide(key)
    if (d.why) skipped.push({ what: key, why: d.why, files })
    else commits.push({ key, subject: d.subject, files })
  }
  return { commits, skipped }
}

type HallSide = { month: string } & Pick<HallDeps, 'me' | 'busy'>

/** 저장소 하나의 계획. `hall` 이 없으면 공용이다 */
export async function planRepo(dir: string, hall?: HallSide): Promise<SyncRepo> {
  const out = blank(dir, hall ? 'hall' : 'common')
  try {
    const head = await headOf(dir, out.name)
    out.branch = head.branch
    const groups = new Map<string, string[]>()
    const outside: string[] = []
    for (const p of await dirtyPaths(dir)) {
      const key = hall ? (CODE_IN.exec(p)?.[1] ?? '') : moduleKeyOf(p)
      if (!key) outside.push(p)
      else groups.set(key, [...(groups.get(key) ?? []), p])
    }
    const made = hall
      ? await split(groups, async (code) => ({ subject: await doneSubject(dir, code), why: hallWhy(dir, code, hall) }))
      : await split(groups, async (key) => ({ subject: `${key.split('/')[1]} 수정사항으로 인한 모듈 변경`, why: '' }))
    out.commits = made.commits
    out.skipped = made.skipped
    if (outside.length) {
      out.skipped.push({ what: hall ? '학습코드 밖 파일' : '모듈 폴더 밖 파일', why: '이 기능은 커밋하지 않습니다. 필요하면 저장소에서 직접 커밋하세요.', files: outside })
    }
    out.ahead = await aheadOf(dir)
    out.blocked = head.blocked || (out.commits.length ? await stagedWhy(dir, out) : '') || (hall && out.commits.length ? tscWhy(dir) : '')
  } catch (error) {
    out.error = toMessage(error)
  }
  return out
}

/** 호 학습코드를 커밋하지 않는 까닭 — 비면 커밋한다 */
function hallWhy(dir: string, code: string, hall: HallSide): string {
  if (/M(\d\d)/.exec(code)?.[1] !== hall.month) return '다른 호의 학습코드입니다.'
  // 빗장은 「양산 완료 커밋」과 같은 셈 · 같은 말(`ownerWhy`) — 계획과 실행이 다른 말을 했다(2026-10-14)
  return ownerWhy(ownerAt(dir, code, hall.me)) || hall.busy(code)
}

/** 커밋할 폴더들 — 담기 전에 담아 둔 것을 풀 자리이자 「밖」을 가르는 자리 */
export const commitDirs = (r: Pick<SyncRepo, 'kind'>, commits: SyncCommit[]): string[] =>
  r.kind === 'hall' ? commits.flatMap((c) => codeDirs(c.key)) : commits.map((c) => moduleDir(c.key))

/** 미리 담아 둔 파일이 커밋할 폴더 밖에 있으면 그 파일까지 커밋에 딸려 간다(`hallcommit.ts` ②와 같은 빗장) */
async function stagedWhy(dir: string, r: SyncRepo): Promise<string> {
  const others = await stagedOutside(dir, commitDirs(r, r.commits), T)
  return others.length ? `미리 담아 둔 다른 파일이 ${others.length}개 있어 커밋하지 않습니다 (${others[0]} …).` : ''
}

/** 호 커밋은 하기 직전에 타입 검사를 한다(`hallcommit.ts` ④) — 프로그램이 없으면 미리 말한다 */
function tscWhy(dir: string): string {
  return vueTscMissing(dir)
}
