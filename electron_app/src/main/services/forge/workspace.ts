import { isAbsolute } from 'node:path'
import type { Workspace } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { rememberForgeRoot, savedForgeRoot } from './home'
import { forgetForgeRoot, loadForge } from './runtime'

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
    const { paths, root, user } = await loadForge()
    const pick = paths.pickRoot()
    const me = user.loadUser()
    return {
      dir: pick.dir,
      from: pick.from,
      repos: pick.repos,
      forgeRoot: root,
      rscRoot: me.rscRoot,
      developer: me.developer,
      devTeam: me.devTeam,
      specOwner: me.specOwner,
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
export async function makeRscDir(code: string): Promise<{ ok: true; dir: string } | { ok: false; error: string }> {
  try {
    return (await loadForge()).api.resourceDir(code)
  } catch (error) {
    return { ok: false, error: toMessage(error) }
  }
}

async function save(patch: { workRoot?: string; rscRoot?: string; developer?: string; devTeam?: string }, dir: string): Promise<Workspace> {
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
