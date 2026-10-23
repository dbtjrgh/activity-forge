/**
 * **「업데이트」가 공용 저장소(sparkon_common)도 받는다** (2026-10-21 사용자 말 — 「공용은 업데이트 버튼으로 같이 받게 해줘」).
 *
 * 공용 모듈은 다른 팀도 고친다. 받는 것을 잊으면 호 저장소의 미리보기 · 타입 검사가 옛 모듈로 돈다
 * (함정 — 「공용 모듈을 다른 팀이 고치면 스펙은 모른다」). 그래서 양산기 자료 · 앱 새 버전과 같은 단추에 붙인다.
 * **자리는 양산기 설정 하나다** — forge `commonroot.ts` 의 `commonRoot()`(정해 둔 자리, 비면 `<작업 폴더>/sparkon_common`). 여기서 경로를 셈하지 않는다.
 *
 * - 확인(`commonCheckIn`) — 원격 main 커밋을 `ls-remote` 로만 묻는다(fetch 안 함). 그 커밋이 지금 HEAD 에 들어 있지 않으면 받을 것이 있다.
 *   못 물으면(폴더 없음 · 망 · 로그인) 「모름」이다 — 단추를 켜지 않고, 양산기 자료 확인과 따로 돈다(`refresh.ts`)
 * - 받기(`commonPullIn`) — 하던 일(`busy.ts`)이나 끝나지 않은 합치기 · 리베이스가 있으면 안 받는다. origin main 만 받아 온 뒤
 *   main 브랜치이거나 내 커밋이 없으면 앞질러 가기로만(`--ff-only`), 내 브랜치에 내 커밋이 있으면
 *   「main 에 모두 올리기」와 같은 합치기(`hallsync.ts` `mergeMain`, 문구 「main 동기화」)를 한다. 충돌이면 취소하고 그 파일을 보인다
 * - **푸시하지 않는다. stash 도 안 한다** — 사람이 하던 것을 치우거나 버리지 않는다.
 *   커밋 안 한 파일이 받을 커밋과 겹치면 git 이 아무것도 안 바꾸고 거절한다. 그 파일을 보이고 멈춘다
 *
 * 앞의 두 함수는 자리 · 하던 일을 인자로 받아 앱 설정 없이 시험 저장소로 돌릴 수 있다. Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import { onMainBranch, type CommonCheck, type CommonPull } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git, isAncestor, isRepoRoot, stagedOutside, tryGit } from '../../lib/git'
import { remoteHeads } from './appupdate'
import { blockers, first, mergeMain } from './hallsync'
import { needsLogin } from './refreshpull'
import { ASK_TIMEOUT, unfinished } from './refreshstash'
import { loadForge } from './runtime'

/** 받아 오기는 망을 탄다 — 양산기 받기(`refreshpull.ts`)와 같은 상한 */
const FETCH_TIMEOUT = 60_000
/** 앞질러 가기는 로컬이다 */
const MERGE_TIMEOUT = 30_000
/** 이 PC 의 원격 main 자리 — 받아 오기가 여기에 적는다 */
const ORIGIN_MAIN = 'refs/remotes/origin/main'

/** 공용 저장소 자리가 쓸 만한가 — 아니면 문장 앞머리(「~해」「~라서」), 쓸 만하면 빈 글 */
async function placeOf(dir: string): Promise<string> {
  if (!dir || !existsSync(dir)) return 'sparkon_common 폴더를 찾지 못해'
  // 저장소 뿌리여야 한다 — 다른 저장소 안의 폴더를 고르면 그 저장소를 받게 된다
  return (await isRepoRoot(dir, ASK_TIMEOUT)) ? '' : 'sparkon_common 폴더가 git 저장소가 아니라서'
}

/** 그 커밋이 지금 HEAD 에 들어 있나 — 아직 이 PC 에 없는 커밋이면 안 들어 있다 */
async function contains(dir: string, sha: string): Promise<boolean> {
  if (!(await tryGit(dir, ['cat-file', '-e', `${sha}^{commit}`], ASK_TIMEOUT)).ok) return false
  return isAncestor(dir, sha, 'HEAD', ASK_TIMEOUT)
}

/** 확인 — 받지 않는다. 1분마다 불린다 */
export async function commonCheckIn(dir: string): Promise<CommonCheck> {
  try {
    const place = await placeOf(dir)
    if (place) return { newer: null, why: `${place} 공용 저장소는 확인하지 않았습니다.` }
    let sha: string
    try {
      sha = (await remoteHeads(dir, 'main')).main
    } catch (error) {
      const why = toMessage(error)
      return { newer: null, why: needsLogin(why) ? '공용 저장소는 git 로그인이 필요해 확인하지 못했습니다.' : '공용 저장소의 원격에 연결하지 못해 확인하지 못했습니다.' }
    }
    if (!sha) return { newer: null, why: '공용 저장소의 원격에 main 브랜치가 없어 확인하지 못했습니다.' }
    return { newer: !(await contains(dir, sha)) }
  } catch (error) {
    return { newer: null, why: `공용 저장소를 확인하지 못했습니다: ${toMessage(error)}` }
  }
}

const no = (note: string, files: string[] = []): CommonPull => ({ ok: false, note, ...(files.length ? { files } : {}) })
const BUSY = '하던 일이 있어 공용 저장소는 받지 않았습니다.'
const DIRTY = '커밋하지 않은 파일이 받을 커밋과 겹쳐 공용 저장소는 받지 않았습니다.'

/** 받기. `busy` 는 하던 일 이름들(`busy.ts` `busyWork`) — 처음과 바꾸기 직전(받아 오는 사이 시작했을 수 있다)에 두 번 묻는다 */
export async function commonPullIn(dir: string, busy: () => string[]): Promise<CommonPull> {
  try {
    if (busy().length) return no(BUSY)
    const place = await placeOf(dir)
    if (place) return no(`${place} 공용 저장소는 받지 않았습니다.`)
    if (await unfinished(dir)) return no('공용 저장소에 끝나지 않은 합치기나 리베이스가 있어 받지 않았습니다.')
    const branch = (await tryGit(dir, ['symbolic-ref', '-q', '--short', 'HEAD'], ASK_TIMEOUT)).out.trim()
    if (!branch) return no('공용 저장소에 지금 브랜치가 없어(분리된 HEAD) 받지 않았습니다.')

    // origin main 만 받아 온다 — 남의 브랜치까지 받을 일이 없다. 사람의 pull 설정(rebase 등)을 안 타게 pull 을 안 쓴다
    const got = await tryGit(dir, ['fetch', '-q', '--no-tags', 'origin', `+refs/heads/main:${ORIGIN_MAIN}`], FETCH_TIMEOUT)
    if (!got.ok) {
      return no(needsLogin(got.err) ? '공용 저장소는 git 로그인이 필요해 받지 못했습니다.' : `공용 저장소를 원격에서 받아 오지 못했습니다. ${first(got.err)}`)
    }
    if (await isAncestor(dir, ORIGIN_MAIN, 'HEAD', ASK_TIMEOUT)) return { ok: true, note: '공용 저장소는 이미 최신입니다.' }
    if (busy().length) return no(BUSY)
    const behind = Number((await git(dir, ['rev-list', '--count', `HEAD..${ORIGIN_MAIN}`], ASK_TIMEOUT)).trim())

    // main 브랜치이거나 내 커밋이 없다 — 앞질러 가기로만. main 에서 갈라져 있으면 합치지 않는다(내 main 에 합친 커밋이 생긴다)
    if (onMainBranch(branch) || (await isAncestor(dir, 'HEAD', ORIGIN_MAIN, ASK_TIMEOUT))) {
      const ff = await tryGit(dir, ['-c', 'core.quotepath=false', 'merge', '--ff-only', '-q', ORIGIN_MAIN], MERGE_TIMEOUT)
      if (ff.ok) return { ok: true, note: `공용 저장소의 커밋 ${behind}개를 받았습니다.` }
      const files = blockers(ff.err)
      if (files.length) return no(DIRTY, files)
      if (!(await isAncestor(dir, 'HEAD', ORIGIN_MAIN, ASK_TIMEOUT))) return no(`공용 저장소의 ${branch} 브랜치가 원격 main 브랜치와 갈라져 있어 받지 않았습니다.`)
      return no(`공용 저장소를 받지 못했습니다. ${first(ff.err)}`)
    }

    // 내 브랜치에 내 커밋이 있다 — 「main 에 모두 올리기」의 합치기 그대로.
    // 미리 담아 둔 파일이 있으면 git 이 받을 커밋과 상관없이 합치기를 거절하는데, 그 이름을 탭 없이 적어 `blockers` 가 못 읽는다(2026-10-21 시험) — 먼저 센다
    const staged = await stagedOutside(dir, [], ASK_TIMEOUT)
    if (staged.length) return no('미리 담아 둔 파일이 있어 공용 저장소는 받지 않았습니다.', staged)
    const m = await mergeMain(dir)
    if (m.ok) return { ok: true, note: `공용 저장소에 main 브랜치의 커밋 ${m.merged}개를 합쳤습니다.` }
    if (m.conflict) {
      return no(
        m.aborted
          ? `공용 저장소에서 main 브랜치와 합치다 파일 ${m.files.length}개가 충돌해 합치기를 취소했습니다.`
          : `공용 저장소에서 main 브랜치와 합치다 충돌했는데 취소하지 못했으니 저장소를 직접 확인하세요.`,
        m.files
      )
    }
    if (m.files.length) return no(DIRTY, m.files)
    return no(`공용 저장소에서 main 브랜치와 합치지 못했습니다. ${first(m.err)}`)
  } catch (error) {
    return no(`공용 저장소를 받다가 git 명령이 실패했습니다: ${toMessage(error)}`)
  }
}

/** 양산기 설정이 정한 공용 저장소 자리 — forge 를 못 불러오면 까닭(문장 앞머리) */
async function commonDir(): Promise<{ dir: string } | { why: string }> {
  try {
    return { dir: (await loadForge()).commonroot.commonRoot() }
  } catch {
    return { why: '양산기 설정을 읽지 못해' }
  }
}

/** 업데이트 확인(`refresh.ts` `checkUpdate`)이 부른다 */
export async function checkCommon(): Promise<CommonCheck> {
  const at = await commonDir()
  return 'why' in at ? { newer: null, why: `${at.why} 공용 저장소는 확인하지 않았습니다.` } : commonCheckIn(at.dir)
}

/** 「업데이트」(`update.ts` `runUpdate`)가 자료 · 앱을 받은 뒤 부른다 */
export async function pullCommon(busy: () => string[]): Promise<CommonPull> {
  const at = await commonDir()
  return 'why' in at ? no(`${at.why} 공용 저장소는 받지 않았습니다.`) : commonPullIn(at.dir, busy)
}
