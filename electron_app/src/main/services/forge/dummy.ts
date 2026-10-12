/**
 * **빈 뼈대(더미)인가** (2026-09-29, M7) — 9호 m08 의 EN · MA 36개씩은 ffad230 「더미 액티비티 코드 추가」가 깔아 둔
 * 빈 뼈대다. 그 자리는 「덮어쓰기」를 안 눌러도 채운다(`_document/양산판.md` 여쭐 것 5 — 허락). **사람 것은 여태처럼 멈춘다.**
 *
 * 셋이 **다** 맞아야 더미다 — 하나라도 모르면 더미가 아니다(덮을 것을 잘못 고르는 것이 제일 나쁘다):
 *   ① 그 자리(`src/activity/<코드>` · `public/sparklab/<코드>`)를 건드린 커밋이 뼈대를 깐 셋(아래 `SEED`)뿐이다
 *   ② 그 자리에 커밋 안 된 것이 없다
 *   ③ 지금 내용이 ffad230 의 원형과 같다(git 나무 해시)
 * KO 29개(협력사 몫)는 그 팀이 커밋해 둔 실제 코드라 ①에서 걸린다 — 우리 몫 7칸만 더미로 잡힌다. m07 · m09 처럼 그 커밋들이 없는 저장소는 ①을 못 재 더미가 아니다.
 *
 * git 은 `lib/git.ts` 로만 부른다(셸 없이). Electron 을 import 하지 않는다(services 규칙).
 */

import { git, lines } from '../../lib/git'

/**
 * 더미를 깐 커밋 — 5977a85(리소스 빈 폴더 · `readme.md` 324개, 30분 앞), ffad230(EN · MA · KO 뼈대), edb806b(NU 뼈대).
 * 계획에는 뒤의 둘만 적었는데 m08 에서 대 보니 EN · MA 자리마다 5977a85 가 먼저 있었다(2026-09-29) — 빼면 36개가 다 「사람 것」이 된다.
 */
const SEED = ['5977a85', 'ffad230', 'edb806b']
/** 뼈대 원형을 견줄 커밋 */
const ORIGIN = 'ffad230'
const TIMEOUT = 10_000

export type Dummy = { dummy: boolean; why: string }

/** 그 자리의 형편 한 줄 — 쓰기 점검(`writecheck.ts`)과 작업대 쓰기 칸(`prepare.ts`)이 같은 말을 쓴다. `seed` 가 null 이면 없는 자리 */
export function slotLine(seed: Dummy | null): string {
  if (!seed) return '새로 만듭니다.'
  // 「저장소에 다시 반영」 단추는 2026-10-08 에 이전 방식과 같이 걷었다 — 이제 대화가 그 폴더에 직접 쓴다
  return seed.dummy ? seed.why : `이미 있습니다. 대화로 생성하면 Claude 가 이 폴더의 파일을 고칩니다. (${seed.why})`
}

/** 저장소마다 한 번 — 짧은 해시를 긴 해시로. 못 풀면 그 저장소에는 그 커밋이 없다 */
const seeds = new Map<string, Promise<string[]>>()
function seedsOf(repo: string): Promise<string[]> {
  let got = seeds.get(repo)
  if (!got) {
    got = Promise.all(SEED.map((s) => git(repo, ['rev-parse', '--verify', '--quiet', `${s}^{commit}`], TIMEOUT).then((o) => o.trim()).catch(() => '')))
    seeds.set(repo, got)
  }
  return got
}

export async function isDummy(repo: string, code: string): Promise<Dummy> {
  const places = [`src/activity/${code}`, `public/sparklab/${code}`]
  // KO 를 통째로 「다른 팀」으로 돌리던 줄은 걷었다 (2026-09-29) — 9호 모듈표의 우리 몫 7칸(`_layout/KO08.json`)이 빈 뼈대인데
  // 「이미 있습니다 · 덮어쓰기 (KO 는 다른 팀 담당)」라고 틀리게 말했다. 협력사 29칸은 뼈대 뒤에 그 팀 커밋이 있어 아래 ①에서 걸린다
  try {
    const seed = (await seedsOf(repo)).filter(Boolean)
    if (!seed.length) return { dummy: false, why: '빈 뼈대 커밋(ffad230)이 없는 호 저장소입니다.' }
    // ① 건드린 커밋
    const touched = lines(await git(repo, ['log', '--format=%H', '--', ...places], TIMEOUT))
    const other = touched.filter((h) => !seed.includes(h))
    if (!touched.length) return { dummy: false, why: '빈 뼈대가 아닙니다.' }
    if (other.length) return { dummy: false, why: `빈 뼈대 이후에 수정한 커밋이 ${other.length}개 있습니다.` }
    // ② 커밋 안 된 것
    const dirty = lines(await git(repo, ['status', '--porcelain', '--untracked-files=all', '--', ...places], TIMEOUT))
    if (dirty.length) return { dummy: false, why: `커밋하지 않은 변경이 ${dirty.length}건 있습니다.` }
    // ③ 원형과 같은가
    const [now, was] = await Promise.all(
      [`HEAD:${places[0]}`, `${ORIGIN}:${places[0]}`].map((r) => git(repo, ['rev-parse', '--verify', '--quiet', r], TIMEOUT).then((o) => o.trim()))
    )
    if (!now || now !== was) return { dummy: false, why: '빈 뼈대와 내용이 다릅니다.' }
    return { dummy: true, why: '빈 뼈대라 바로 채웁니다.' }
  } catch (error) {
    return { dummy: false, why: `빈 뼈대인지 확인하지 못했습니다: ${(error as Error).message.slice(0, 80)}` }
  }
}
