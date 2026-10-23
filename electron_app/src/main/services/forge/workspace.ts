import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import type { CommonPlace, FolderOpen, Workspace } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { isRepoRoot } from '../../lib/git'
import { rememberForgeRoot, savedForgeRoot } from './home'
import { forgetForgeRoot, loadForge } from './runtime'

/** 고른 공용 폴더가 저장소 맨 위인지 묻는 git 한 번의 상한 */
const ROOT_TIMEOUT = 10_000

/**
 * 작업 폴더(호 repo 들이 있는 자리)와 **리소스를 놓는 자리**.
 *
 * **정본은 `forge/.user.json` 이다.** 앱이 따로 저장하지 않는다. 앱과 CLI 가 같은
 * 값을 보게 하려면 고치는 자리가 하나여야 한다 — 두 곳에 두면 「화면에서는
 * 바꿨는데 명령은 옛 폴더를 본다」가 된다.
 */

/**
 * **양산기 폴더를 바꾼다** (2026-09-18). zip 으로 받은 앱은 이 자리를 알려
 * 주기 전에는 스펙을 한 장도 못 읽는다 (`home.ts`).
 *
 * **앱을 이미 켠 채로는 갈아 끼울 수 없다.** forge 의 `paths.ts` 는 모듈을
 * 읽는 순간 뿌리를 굳히므로(`runtime.ts` 머리말), 한 번 불러 온 뒤에 바꾸면
 * 「적긴 적었는데 여전히 옛 폴더를 본다」가 된다. 그래서 **적어 두고 다시
 * 켜 달라고 말한다** — 짐작으로 반만 갈아 끼우지 않는다.
 */
export async function setForgeRoot(dir: string): Promise<Workspace> {
  const kept = await getWorkspace()
  const got = rememberForgeRoot(dir)
  if (!got.ok) return { ...kept, error: got.error }
  forgetForgeRoot()
  const now = await getWorkspace()
  // 아직 아무것도 못 읽던 앱이면 이 자리에서 바로 살아난다. 이미 읽은 앱이면
  // 굳은 뿌리가 그대로라 다시 켜야 한다 — 그 둘을 갈라 말한다.
  const saved = savedForgeRoot()
  if (now.forgeRoot && now.forgeRoot === saved) return now
  // **지금 보고 있는 자리를 그대로 보인다.** 새 자리를 보여 주면 이미 바뀐
  // 줄 알고 양산을 눌렀다가 옛 폴더의 스펙으로 만들게 된다.
  return {
    ...now,
    warn: `양산기 폴더를 ${saved} 폴더로 바꿨습니다. 앱을 다시 켜야 적용됩니다.`
  }
}

export async function getWorkspace(): Promise<Workspace> {
  try {
    const { paths, commonroot, root, user } = await loadForge()
    const pick = paths.pickRoot()
    const me = user.loadUser()
    const common: CommonPlace = commonroot.commonPick()
    return {
      dir: pick.dir,
      from: pick.from,
      repos: pick.repos,
      forgeRoot: root,
      rscRoot: me.rscRoot,
      developer: me.developer,
      devTeam: me.devTeam,
      shareRoot: me.shareRoot,
      common,
      ...(pick.warn ? { warn: pick.warn } : {})
    }
  } catch (error) {
    return { dir: '', from: '', repos: 0, forgeRoot: '', rscRoot: '', error: toMessage(error) }
  }
}

/**
 * 작업 폴더를 바꾼다. `.user.json` 에 적고 새 상태를 돌려준다.
 *
 * **고른 자리에 호가 없어도 그대로 적는다.** forge 의 `pickRoot()` 와 같은 태도다 —
 * 말없이 다른 데로 옮겨 가면 「왜 내 설정이 안 먹지」가 된다. 대신 `warn` 으로 알린다.
 */
export async function setWorkspace(dir: string): Promise<Workspace> {
  return save({ workRoot: dir.trim() }, dir)
}

/**
 * 리소스를 놓는 자리를 바꾼다. **빈 글이면 「원래대로」** — 호 저장소 안을 본다.
 *
 * 폴더를 미리 만들지 않는다. 학습코드 폴더는 리소스 화면의 「폴더 만들고 열기」가
 * 만든다 — 묻지도 않고 남의 자리에 폴더를 만들어 두지 않는다.
 */
export async function setRscRoot(dir: string): Promise<Workspace> {
  const clean = dir.trim()
  if (!clean) return save({ rscRoot: '' }, '')
  return save({ rscRoot: clean }, clean)
}

/**
 * **사내 공유 폴더를 바꾼다** (2026-10-14, `sharefetch.ts`). **빈 글이면 기본 주소**(`SHARE_DEFAULT`)로 돌아간다.
 * 글로 받는다 — `\\서버\공유` 꼴은 폴더 고르기 창으로 고르기 어렵다. 닿는지는 여기서 안 본다(못 닿는 PC 에서도 적어 둘 수 있게) —
 * 찾을 때 공유 폴더 칸이 연결을 확인해 알린다
 */
export async function setShareRoot(dir: string): Promise<Workspace> {
  const t = dir.trim()
  // 드라이브 뿌리(`Z:\`)는 그대로 — 뒤 구분자를 떼면 `Z:` 가 되어 절대 경로가 아니다
  const clean = /^[A-Za-z]:[\\/]?$/.test(t) ? t : t.replace(/[\\/]+$/, '')
  // 이 칸 하나의 잘못은 서랍 전체 오류(`error`)로 돌려주지 않는다 — 작업 폴더 칸이 통째로 오류 화면이 되고 고칠 칸도 사라졌다(2026-10-15 검토)
  if (clean && !isAbsolute(clean)) return { ...(await getWorkspace()), shareError: '공유 폴더 위치를 전체 경로로 적으세요.' }
  return save({ shareRoot: clean }, '')
}

/**
 * **공용 폴더(sparkon_common)를 바꾼다** (2026-10-21 사용자 말 — 「공용폴더도 비슷한 경로로 있긴한데 경로 정할 수 있게 해놔」).
 * 빈 글이면 기본 자리(`<작업 폴더>/sparkon_common`)로. **고른 폴더가 기본 자리와 같아도 비워 둔다** — 작업 폴더를 바꾸면 따라가게.
 * `_common/module` 이 없는 폴더는 안 받는다 — 엉뚱한 폴더를 적으면 모듈 폴더 · 회귀 검사 · main 올리기가 조용히 빈다.
 * 잘못은 그 줄 아래에만(`commonError`) — `setShareRoot` 와 같은 까닭이다
 */
export async function setCommonRoot(dir: string): Promise<Workspace> {
  const t = dir.trim()
  if (!t) return save({ commonRoot: '' }, '')
  const refuse = async (commonError: string): Promise<Workspace> => ({ ...(await getWorkspace()), commonError })
  if (!isAbsolute(t)) return refuse('공용 폴더는 전체 경로로 정해야 합니다.')
  if (!existsSync(join(t, '_common', 'module'))) return refuse('고른 폴더 안에 _common/module 폴더가 없어 공용 폴더로 쓸 수 없습니다.')
  // 저장소 맨 위여야 한다 — 호 저장소의 `src` 는 `_common` 정션 덕에 위 검사를 통과하고, 그러면 「main 에 모두 올리기」가 그 호를 공용으로 올린다(2026-10-21 검증)
  if (!(await isRepoRoot(t, ROOT_TIMEOUT))) return refuse('고른 폴더가 sparkon_common 저장소의 맨 위 폴더가 아니라 공용 폴더로 쓸 수 없습니다.')
  try {
    const { paths, commonroot } = await loadForge()
    return save({ commonRoot: paths.samePlace(t, commonroot.commonPick().home) ? '' : t }, t)
  } catch (error) {
    return refuse(toMessage(error))
  }
}

/**
 * **만든 사람 · 팀을 바꾼다** (2026-09-29). 「끝」이 activityInfo.json 에 적는 이름이다 — 옛 양산 창에만 있던 칸이라,
 * 걷은 뒤로 다른 개발자가 제 이름을 적을 길이 없었다. 빈 글은 안 받는다(빈 이름으로 끝을 적지 않게).
 */
export async function setMe(developer: string, devTeam: string): Promise<Workspace> {
  const d = developer.trim()
  const t = devTeam.trim()
  if (!d || !t) return { ...(await getWorkspace()), error: '만든 사람과 팀을 모두 입력하세요.' }
  return save({ developer: d, devTeam: t }, '')
}

/**
 * 그 학습코드의 리소스 폴더를 만들고 탐색기로 연다 — forge `api.resourceDir` 그대로(자리 셈은 `files.ts` `rscDir` 하나).
 * 옛 양산 창 채널에 있던 것을 M8 에 여기로 옮겼다 — 작업대의 「리소스 폴더 열기」가 부른다.
 */
export async function makeRscDir(code: string): Promise<FolderOpen> {
  try {
    return (await loadForge()).api.resourceDir(code)
  } catch (error) {
    return { ok: false, error: toMessage(error) }
  }
}

async function save(
  patch: { workRoot?: string; rscRoot?: string; developer?: string; devTeam?: string; shareRoot?: string; commonRoot?: string },
  dir: string
): Promise<Workspace> {
  try {
    // **절대 경로만 받는다.** 상대 경로는 「지금 서 있는 폴더」에 따라 달라지는데,
    // 앱과 CLI 는 서 있는 자리가 다르다 — 같은 설정이 두 자리를 가리키게 된다.
    if (dir && !isAbsolute(dir)) {
      return { ...(await getWorkspace()), error: '절대 경로만 지정할 수 있습니다.' }
    }
    const { user } = await loadForge()
    user.saveUser(patch)
    return await getWorkspace()
  } catch (error) {
    return { dir: '', from: '', repos: 0, forgeRoot: '', rscRoot: '', error: toMessage(error) }
  }
}
