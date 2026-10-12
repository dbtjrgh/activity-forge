/**
 * **스펙 갱신** — clone 한 저장소에서 새 스펙을 받는다 (2026-09-18).
 *
 * zip 으로 받은 앱은 스펙을 clone 에서 읽는다(`home.ts`). 스펙을 앱 안에 넣지
 * 않은 까닭이 「git pull 한 번이면 갱신된다」였으니, **그 한 번을 앱이 누르게** 한다.
 *
 * **남의 저장소를 바꾸는 일이라 조심한다** —
 *
 *   ① 고친 것이 있으면 **안 받는다.** 덮어쓰지도, 치워 두지도(stash) 않는다.
 *      무엇이 고쳐져 있는지 보여 주고 멈춘다
 *   ② `--ff-only` 로만 받는다. 갈라져 있으면 **합치지 않고** 멈춘다 — 합치기는
 *      사람이 판단할 일이다
 *   ③ 받은 뒤 **무엇이 바뀌었나**를 스펙과 코드로 갈라 보여 준다
 *
 * **스펙은 바로 먹고, 코드는 안 먹는다.** forge 는 스펙을 부를 때마다 디스크에서
 * 읽으므로(메모리에 쥐고 있지 않다) 받은 스펙이 다음 양산부터 쓰인다. 그런데
 * 양산기 **코드**(`src/gen/*.ts`)는 앱을 빌드할 때 묶여 들어갔다 — 저장소에서
 * 바뀌어도 앱은 옛 코드로 돈다. 그것까지 「받았습니다」로 뭉뚱그리면 사람은
 * 고쳐진 줄 안다. 그래서 따로 센다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { relative } from 'node:path'
import type { SpecRefresh, UpdateCheck } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git, lines } from '../../lib/git'
import { appCheck, remoteHeads } from './appupdate'
import { findForgeRoot, forgeMissingMessage } from './runtime'

/** 물어보는 것(상태·커밋)은 짧게, 받는 것은 망을 타므로 길게. */
const ASK_TIMEOUT = 10_000
const PULL_TIMEOUT = 60_000

/** 저장소 안의 스펙 자리 — 이 아래가 바뀌면 「스펙이 바뀌었다」다. */
const SPEC_DIRS = ['_spec', '_layout']

/** 앱에 묶여 들어가는 코드 자리. `ui`·`template` 은 디스크에서 읽으므로 뺀다(`paths.ts` 의 `GEN_DIR`). */
const CODE_DIR = 'src'
const DISK_READ = ['src/gen/ui/', 'src/gen/template/']
/** 앱 코드 자리 — 저장소 뿌리 기준. 저장소를 clone 해 소스로 띄운 앱은 이것도 같이 받는다 */
const APP_DIRS = ['electron_app/src', 'electron_app/electron.vite.config.ts']
/** 이것이 바뀌면 패키지를 다시 받아야 한다 */
const PACKAGE_FILES = ['electron_app/package.json', 'electron_app/yarn.lock', 'forge/package.json', 'forge/yarn.lock']
/** 원격에 물어보는 것은 망을 탄다 */
const FETCH_TIMEOUT = 30_000

function empty(): SpecRefresh {
  return { ok: false, repo: '', before: '', after: '', commits: 0, specs: [], code: [], dirty: [], note: '' }
}

/** 양산기 폴더가 든 git 저장소 뿌리 — 없으면 까닭 */
export async function repoOf(): Promise<{ repo: string } | { error: string }> {
  const forge = findForgeRoot()
  if (!forge) return { error: forgeMissingMessage() }
  try {
    return { repo: (await git(forge, ['rev-parse', '--show-toplevel'], ASK_TIMEOUT)).trim() }
  } catch {
    return { error: '양산기 폴더가 git 저장소가 아닙니다. clone 한 저장소의 forge 를 고르세요.' }
  }
}

/**
 * **원격에 새 판이 있나** — `git fetch` 한 번 뒤 `HEAD..@{u}` 를 센다. **받지는 않는다.**
 * `behind.ts`(호 저장소)는 일부러 fetch 를 안 하지만, 여기는 「올리면 단추가 켜진다」가 일이라 물어야 한다.
 * 묻지 않고 끝난다(`GIT_TERMINAL_PROMPT=0`) — 로그인이 필요한 PC 에서 멈춰 있지 않는다.
 */
/** 지난번에 물은 세 커밋(내 HEAD · 원격 main · 원격 app-dist)과 그 답 — 셋이 같으면 다시 받지 않는다 */
let last: { key: string; result: UpdateCheck } | null = null

/**
 * **1분마다 불러도 되게 가볍게** (2026-10-01 사용자 요청 — 「10분마다 말고 업데이트가 있으면 안내」).
 * 먼저 `ls-remote` 한 번으로 원격 커밋만 묻고, 지난번과 같으면 그 답을 그대로 쓴다. 바뀌었을 때만 받는다(main 만 · app-dist 는 따로).
 */
export async function checkUpdate(): Promise<UpdateCheck> {
  const out: UpdateCheck = { behind: null, commits: [], checkedAt: Date.now(), app: null }
  const at = await repoOf()
  if ('error' in at) return { ...out, error: at.error }
  const repo = at.repo
  let remote: { main: string; app: string }
  let branch: string
  let head: string
  try {
    branch = (await git(repo, ['rev-parse', '--abbrev-ref', '@{u}'], ASK_TIMEOUT)).trim().replace(/^origin\//, '')
    head = (await git(repo, ['rev-parse', 'HEAD'], ASK_TIMEOUT)).trim()
    remote = await remoteHeads(repo, branch)
  } catch (error) {
    const why = toMessage(error)
    return {
      ...out,
      error: /could not read|Authentication|terminal prompts disabled|credential/i.test(why)
        ? 'git 로그인이 필요합니다. 터미널에서 한 번 pull 해 로그인하세요.'
        : `원격 저장소에 연결하지 못했습니다: ${why}`
    }
  }
  const key = `${head} ${remote.main} ${remote.app}`
  if (last?.key === key) return { ...last.result, checkedAt: out.checkedAt }
  try {
    if (remote.main && remote.main !== head) await git(repo, ['fetch', '--quiet', '--no-tags', 'origin', branch], FETCH_TIMEOUT)
    out.behind = Number((await git(repo, ['rev-list', '--count', 'HEAD..@{u}'], ASK_TIMEOUT)).trim())
    out.commits = lines(await git(repo, ['log', '--format=%s', '-10', 'HEAD..@{u}'], ASK_TIMEOUT))
    out.app = await appCheck(repo, remote.app)
    last = { key, result: out }
    return out
  } catch (error) {
    return { ...out, error: `원격 저장소와 비교하지 못했습니다: ${toMessage(error)}` }
  }
}

export async function refreshSpecs(): Promise<SpecRefresh> {
  const out = empty()
  const forge = findForgeRoot()
  const got = await repoOf()
  if (!forge || 'error' in got) return { ...out, error: 'error' in got ? got.error : forgeMissingMessage() }
  out.repo = got.repo
  // 저장소 안에서 forge 가 어디 있나. 경로 조건은 **슬래시**로 적어야 git 이 알아듣는다.
  const at = relative(out.repo, forge).replace(/\\/g, '/')
  const under = (dir: string): string => (at ? `${at}/${dir}` : dir)

  try {
    // ① 고친 것이 있으면 안 받는다. **올리지 않은 새 파일은 안 센다** — `_recipe`
    // 처럼 저장소에 안 올리는 것이 늘 있고, pull 이 그것을 덮을 일도 없다.
    out.dirty = lines(await git(out.repo, ['status', '--porcelain', '--untracked-files=no'], ASK_TIMEOUT))
    if (out.dirty.length) {
      return {
        ...out,
        note: `수정한 파일이 ${out.dirty.length}건 있어 업데이트하지 않았습니다. 커밋하거나 되돌린 뒤 다시 누르세요.`
      }
    }

    out.before = (await git(out.repo, ['rev-parse', '--short', 'HEAD'], ASK_TIMEOUT)).trim()
    try {
      await git(out.repo, ['pull', '--ff-only'], PULL_TIMEOUT)
    } catch (error) {
      const why = toMessage(error)
      return {
        ...out,
        error: /fast-forward|diverg|갈라/i.test(why)
          ? '원격 저장소와 이력이 달라 업데이트하지 않았습니다. git 에서 직접 병합하세요.'
          : /could not read|Authentication|terminal prompts disabled|credential/i.test(why)
            ? 'git 로그인이 필요합니다. 터미널에서 한 번 pull 해 로그인하세요.'
            : `업데이트하지 못했습니다: ${why}`
      }
    }
    out.after = (await git(out.repo, ['rev-parse', '--short', 'HEAD'], ASK_TIMEOUT)).trim()
    out.ok = true

    if (out.before === out.after) {
      out.note = '이미 최신입니다.'
      return out
    }

    const range = `${out.before}..${out.after}`
    out.commits = lines(await git(out.repo, ['log', '--oneline', range], ASK_TIMEOUT)).length
    out.specs = lines(
      await git(out.repo, ['diff', '--name-only', range, '--', ...SPEC_DIRS.map(under)], ASK_TIMEOUT)
    )
    out.code = lines(
      await git(out.repo, ['diff', '--name-only', range, '--', under(CODE_DIR), ...APP_DIRS], ASK_TIMEOUT)
    ).filter((f) => !DISK_READ.some((d) => f.startsWith(under(d))))
    // 패키지가 바뀌면 감시 모드로도 못 따라간다 — 켤 때 받게 해 두었다(`start-app.bat`)
    out.packages =
      lines(await git(out.repo, ['diff', '--name-only', range, '--', ...PACKAGE_FILES], ASK_TIMEOUT)).length > 0

    out.note =
      `커밋 ${out.commits}개를 받았습니다. 스펙과 배치표 ${out.specs.length}개가 바뀌었습니다.` +
      (out.code.length
        ? // **소스로 띄운 앱은 저절로 다시 뜬다** (2026-09-23) — `yarn dev` 가 감시(-w)로 돌아
          // 받은 코드를 다시 빌드하고 앱을 다시 띄운다. zip 앱은 코드가 묶여 있어 새 zip 이 필요하다.
          // 소스로 떴는지는 electron-vite 가 dev 에서만 심는 환경변수로 가린다(Electron 을 안 부른다).
          process.env['ELECTRON_RENDERER_URL']
          ? // start-app.bat 은 감시 모드를 끈다(2026-10-01 — 다시 뜨면 9222 가 닫힌다). 그래서 「곧 다시 켜집니다」가 아니다
            ` 코드 ${out.code.length}개가 바뀌었습니다. 앱을 닫고 다시 켜면 적용됩니다.`
          : '' // 실행 파일로 뜬 앱은 앱 새 버전(app-dist)으로 바뀐다 — 그 말은 `appupdate.ts` 쪽에서 붙인다
        : '') +
      (out.packages ? ' 패키지가 바뀌었습니다. 앱을 닫고 start-app.bat 을 다시 켜세요.' : '')
    return out
  } catch (error) {
    return { ...out, error: `git 을 실행하지 못했습니다: ${toMessage(error)}` }
  }
}
