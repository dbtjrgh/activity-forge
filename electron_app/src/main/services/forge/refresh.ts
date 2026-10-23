/**
 * **스펙 갱신** — clone 한 저장소에서 새 스펙을 받는다 (2026-09-18).
 *
 * zip 으로 받은 앱은 스펙을 clone 에서 읽는다(`home.ts`). 스펙을 앱 안에 넣지
 * 않은 까닭이 「git pull 한 번이면 갱신된다」였으니, **그 한 번을 앱이 누르게** 한다.
 *
 * **남의 저장소를 바꾸는 일이라 조심한다** —
 *
 *   ① 고친 것이 있으면 **안 받는다.** 덮어쓰지 않는다. 무엇이 고쳐져 있는지 보여 주고 멈춘다.
 *      **예외는 스펙 · 배치표 자리(`_spec` · `_layout`)만 고쳐져 있을 때 하나다** (2026-10-21) — 앱이 스스로
 *      거기에 적어서, 작업대를 한 번 쓰면 영영 못 받았다. 그때는 먼저 그대로 받는다 — git 은 받을 커밋이 안 건드리는
 *      고친 파일을 그대로 둔다. 건드려서 git 이 거절할 때만 그 자리를 stash 로 잠시 치워 두고 받는다(`refreshpull.ts`).
 *      개발하는 사람의 dev 사본에서도 이 함수가 돈다 — 코드가 하나라도 고쳐져 있거나 안 올린 커밋이 있으면 예전처럼 멈춘다
 *   ①' **하던 일(`busy.ts` — 도는 대화 · main 에 모두 올리기 · 회귀 검사 · 초기 설정)이 있으면 안 받는다** (2026-10-21).
 *      대화가 도는 중에 스펙이 바뀌거나, 치워 둔 사이 배치표에 적히면 고친 것이 stash 에만 남는다
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
import { busyWork } from './busy'
import { checkCommon } from './commonpull'
import { busyNote, dirtyNote, LOGIN_NOTE, needsLogin, pullKeeping } from './refreshpull'
// 물어보는 것(상태 · 커밋)의 상한은 `refreshstash.ts` 에 하나, 받는 시간 상한은 `refreshpull.ts` 에
import { ASK_TIMEOUT, asideOf } from './refreshstash'
import { findForgeRoot, forgeMissingMessage } from './runtime'

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
    return { error: '양산기 폴더가 git 저장소가 아닙니다. clone 한 저장소의 forge 폴더를 고르세요.' }
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
 * 업데이트 확인 — 양산기 자료 · 앱 새 버전과 공용 저장소(`commonpull.ts`, 2026-10-21)를 나란히 묻는다.
 * 공용은 따로 돈다 — 못 물어도 `error` 에 안 넣는다(화면이 1분마다 묻기를 멈춘다). 공용이 느려도 자료 확인은 그대로 끝난다
 */
export async function checkUpdate(): Promise<UpdateCheck> {
  const [data, common] = await Promise.all([checkData(), checkCommon()])
  return { ...data, common }
}

/**
 * **1분마다 불러도 되게 가볍게** (2026-10-01 사용자 요청 — 「10분마다 말고 업데이트가 있으면 안내」).
 * 먼저 `ls-remote` 한 번으로 원격 커밋만 묻고, 지난번과 같으면 그 답을 그대로 쓴다. 바뀌었을 때만 받는다(main 만 · app-dist 는 따로).
 */
async function checkData(): Promise<UpdateCheck> {
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
    return { ...out, error: needsLogin(why) ? LOGIN_NOTE : `원격 저장소에 연결하지 못했습니다: ${why}` }
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
  const forge = findForgeRoot()
  const got = await repoOf()
  if (!forge || 'error' in got) return { ...empty(), error: 'error' in got ? got.error : forgeMissingMessage() }
  return refreshIn(got.repo, forge, busyWork)
}

/**
 * 저장소 `repo` 안의 양산기 폴더 `forge` 로 받기 — 앱 설정을 안 읽어 임시 저장소로 시험할 수 있다.
 * `busy` 는 하던 일 이름들(`busy.ts` `busyWork`) — 처음과 stash 로 치우기 직전에 두 번 묻는다
 */
export async function refreshIn(repo: string, forge: string, busy: () => string[]): Promise<SpecRefresh> {
  const out = { ...empty(), repo }
  // 저장소 안에서 forge 가 어디 있나. 경로 조건은 **슬래시**로 적어야 git 이 알아듣는다.
  const at = relative(out.repo, forge).replace(/\\/g, '/')
  const under = (dir: string): string => (at ? `${at}/${dir}` : dir)

  try {
    const work = busy()
    if (work.length) return { ...out, note: busyNote(work) }
    // ① 고친 것이 있으면 안 받는다. **올리지 않은 새 파일은 안 센다** — `_recipe`
    // 처럼 저장소에 안 올리는 것이 늘 있고, pull 이 그것을 덮을 일도 없다(같은 이름을 받으면 git 이 거절하고 `refreshpull.ts` 가 이름을 댄다).
    // 다만 스펙 · 배치표 자리만 고쳐져 있으면 받는다(`refreshpull.ts`)
    out.dirty = lines(await git(out.repo, ['status', '--porcelain', '--untracked-files=no'], ASK_TIMEOUT))
    const aside = out.dirty.length ? await asideOf(out.repo, SPEC_DIRS.map(under)) : []
    if (out.dirty.length && !aside.length) return { ...out, note: dirtyNote(out.dirty.length) }

    out.before = (await git(out.repo, ['rev-parse', '--short', 'HEAD'], ASK_TIMEOUT)).trim()
    const got = await pullKeeping(out.repo, aside, SPEC_DIRS.map(under), busy)
    if (!got.ok) return { ...out, error: got.error, note: got.note ?? '' }
    const kept = got.kept
    out.after = (await git(out.repo, ['rev-parse', '--short', 'HEAD'], ASK_TIMEOUT)).trim()
    out.ok = true

    if (out.before === out.after) {
      out.note = ['이미 최신입니다.', kept].filter(Boolean).join(' ')
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

    // **소스로 띄운 앱은 저절로 다시 뜬다** (2026-09-23) — `yarn dev` 가 감시(-w)로 돌아
    // 받은 코드를 다시 빌드하고 앱을 다시 띄운다. zip 앱은 코드가 묶여 있어 새 zip 이 필요하다.
    // 소스로 떴는지는 electron-vite 가 dev 에서만 심는 환경변수로 가린다(Electron 을 안 부른다).
    // 실행 파일로 뜬 앱은 코드 · 패키지 둘 다 앱 새 버전(app-dist)으로 바뀐다 — 그 말은 `appupdate.ts` 쪽에서 붙인다(2026-10-16, 패키지 글이 실행 파일에도 떴다)
    const fromSource = Boolean(process.env['ELECTRON_RENDERER_URL'])
    out.note =
      `커밋 ${out.commits}개를 받았습니다. 스펙과 배치표 ${out.specs.length}개가 바뀌었습니다.` +
      // start-app.bat 은 감시 모드를 끈다(2026-10-01 — 다시 뜨면 9222 가 닫힌다). 그래서 「곧 다시 켜집니다」가 아니다
      (fromSource && out.code.length ? ` 코드 ${out.code.length}개가 바뀌었습니다. 앱을 닫고 다시 켜면 적용됩니다.` : '') +
      (fromSource && out.packages ? ' 패키지가 바뀌었습니다. 앱을 닫고 start-app.bat 파일을 다시 켜세요.' : '') +
      (kept ? ` ${kept}` : '')
    return out
  } catch (error) {
    return { ...out, error: `git 명령을 실행하지 못했습니다: ${toMessage(error)}` }
  }
}
