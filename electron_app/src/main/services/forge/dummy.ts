/**
 * **빈 뼈대(더미)인가** (2026-09-29, M7) — 9호 m08 의 EN · MA 36개씩은 ffad230 「더미 액티비티 코드 추가」가 깔아 둔
 * 빈 뼈대다. 그 자리는 「덮어쓰기」를 안 눌러도 채운다(`_document/양산판.md` 여쭐 것 5 — 허락). **사람 것은 여태처럼 멈춘다.**
 * 빈 뼈대면 작업대가 「이미 만듦」으로 안 보고(`prepare.ts`) 검수 완료도 막는다(`done.ts`).
 *
 * 두 길로 잰다. **어느 길이든 하나라도 모르면 더미가 아니다**(덮을 것을 잘못 고르는 것이 제일 나쁘다).
 * 먼저 그 자리(`src/activity/<코드>` · `public/sparklab/<코드>`)에 커밋 안 된 것이 없어야 한다 — 두 길이 같이 본다.
 *
 * 커밋으로 — 셋이 **다** 맞아야 한다:
 *   ① 그 자리를 건드린 커밋이 뼈대를 깐 셋(아래 `SEED`)뿐이다
 *   ② (위의 커밋 안 된 것)
 *   ③ 지금 내용이 ffad230 의 원형과 같다(git 나무 해시)
 * KO 29개(협력사 몫)는 그 팀이 커밋해 둔 실제 코드라 ①에서 걸린다 — 우리 몫 7칸만 더미로 잡힌다. m07 · m09 처럼 그 커밋들이 없는 저장소는 ①을 못 잰다.
 *
 * 내용으로 (2026-10-21, 누리) — 커밋으로 아니라고 나왔을 때만 본다. **누리(NU) 뼈대는 커밋으로는 하나도 안 잡혔다.**
 * 뼈대를 깐 커밋이 호마다 다르고(m01 c8f1ba7, m02 3b50c34 …), 그 뒤 호마다 「가이드 영상을 끕니다」 커밋이 한 번 더 지나갔다(m08 af7dbcb).
 * m08 NU 도 ①(뒤 커밋)과 ③(ffad230 에는 NU 자리가 없다)에서 걸린다. **`SEED` 에 그 커밋들을 더해 고치지 않는다** — 호마다 해시가 다르고 앞으로도 늘어난다.
 * 대신 **뼈대와 글자까지 같은가**를 본다. 다 맞아야 한다:
 *   - `Activity.ts` · `GameData.ts` · `AssetTable.ts` 가 뼈대 지문(`PRINTS`) 가운데 하나와 같다
 *   - 폴더의 파일이 뼈대 여덟 개(`FILES`)와 똑같다 — 더 있거나 빠졌거나 하위 폴더가 있으면 아니다
 *   - `activityInfo.json` 이 개발 완료가 아니다
 *   - 리소스 자리에 `readme.md` 말고는 없다 — 크기로 가르지 않는다(NU readme 가 400바이트쯤이고 그만한 그림도 있다)
 * 같은 날 처음에는 뼈대 주석(「빈 액티비티입니다」) · 모듈 import 없음 · 빈 GameData 로 쟀다. 그랬더니 주석을 남긴 채 onInit 에 직접 짜서 커밋한 것과
 * AssetTable 에 리소스 두 줄을 넣어 커밋한 것까지 뼈대로 봐, 검수 완료를 막고 다시 생성하라고 했다(리뷰가 재현). 그래서 비슷한 것이 아니라 같은 것만 본다.
 * App.vue · main.ts · index.html · style.css 는 지문을 안 본다 — App.vue 는 이미 호마다 한꺼번에 고친 커밋이 지나가 꼴이 둘이고, 작업은 그 셋에 들어간다.
 * 이 꼴이 아닌 뼈대(m10 ENL1M10W1S1 같은 EN · MA 뼈대)는 m08 밖이면 여전히 못 잡는다 — 더미가 아님으로 남는다.
 *
 * git 은 `lib/git.ts` 로만 부른다(셸 없이). Electron 을 import 하지 않는다(services 규칙).
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { git, lines } from '../../lib/git'
import { listPub } from './pubfiles'

/**
 * 더미를 깐 커밋 — 5977a85(리소스 빈 폴더 · `readme.md` 324개, 30분 앞), ffad230(EN · MA · KO 뼈대), edb806b(NU 뼈대).
 * 계획에는 뒤의 둘만 적었는데 m08 에서 대 보니 EN · MA 자리마다 5977a85 가 먼저 있었다(2026-09-29) — 빼면 36개가 다 「사람 것」이 된다.
 */
const SEED = ['5977a85', 'ffad230', 'edb806b']
/** 뼈대 원형을 견줄 커밋 */
const ORIGIN = 'ffad230'
const TIMEOUT = 10_000

/**
 * 누리 뼈대의 지문 — 줄 끝을 LF 로, 그 폴더 학습코드를 `<CODE>` 로 바꾼 글의 sha256(`print`).
 * 2026-10-21 에 sparkon_m01~m11 의 NU 396개를 재서 적었다(측정 스크립트는 그 세션 임시 폴더). 뼈대 384개가 파일마다 아래 꼴 하나와 같았고,
 * 다 만든 것과 만드는 중인 것 12개(m01 NUL1)는 셋 다 달랐다. 학습코드의 소문자 · 밑줄 꼴은 어느 파일에도 없었고(있었으면 학습코드마다 지문이 갈렸다) BOM 도 없었다.
 * AssetTable.ts 는 꼴이 둘이다 — m01 의 24개는 주석 예시가 `background0`, m02~m11 의 360개는 `bg` 다.
 * 뼈대를 한꺼번에 고치는 커밋이 또 지나가면 지문이 안 맞아 「빈 뼈대 아님」이 된다. 그쪽으로 틀리는 것은 안전하다 — 그때 다시 재서 더한다
 */
const PRINTS: Record<string, readonly string[]> = {
  'Activity.ts': ['8f8066fc12f583d19a6d13c0ebb841ac3047ccb0188f223177b24049098cab4a'],
  'GameData.ts': ['83e20a004a8919a676e3d69dee8b4f8809019bb552d8bdb9ee817519670e6301'],
  'AssetTable.ts': [
    '1ddcd6f556a8cd8eed4dd94842770565481f617fd9b70e895236aef5a1cc0030', // m01
    'b45fd06e7b5fea25f5be6a911decf25a6510560ad844d95e344ad4b0160725b7' // m02~m11
  ]
}
/** 누리 뼈대 폴더의 파일 — 396개 모두 이 여덟 개였다(2026-10-21). 대소문자까지 같아야 한다 */
const FILES = ['Activity.ts', 'App.vue', 'AssetTable.ts', 'GameData.ts', 'activityInfo.json', 'index.html', 'main.ts', 'style.css']

export type Dummy = { dummy: boolean; why: string }

const YES: Dummy = { dummy: true, why: '빈 뼈대라 바로 채웁니다.' }
const no = (why: string): Dummy => ({ dummy: false, why })
const unknown = (why: string): Dummy => no(`빈 뼈대인지 확인하지 못했습니다: ${why.slice(0, 80)}`)

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
    // 호 폴더에 .git 이 없으면 git 이 위 폴더의 저장소를 볼 수 있다 — 묻지 않는다
    if (!existsSync(join(repo, '.git'))) return unknown('git 저장소가 아닙니다.')
    // ② 커밋 안 된 것 — 두 길이 같이 본다. 대화가 쓰는 중인 뼈대도 여기서 「사람 것」이 된다
    const dirty = lines(await git(repo, ['status', '--porcelain', '--untracked-files=all', '--', ...places], TIMEOUT))
    if (dirty.length) return no(`커밋하지 않은 변경이 ${dirty.length}건 있습니다.`)
    const bySeed = await seedRule(repo, places)
    if (bySeed.dummy) return bySeed
    // Activity.ts 가 누리 뼈대 꼴이 아니면 내용으로는 말할 것이 없다 — 커밋으로 잰 까닭을 그대로 보인다
    return contentRule(repo, code) ?? bySeed
  } catch (error) {
    return unknown((error as Error).message)
  }
}

/** 커밋으로 — ①과 ③. ②는 부르는 쪽이 먼저 봤다 */
async function seedRule(repo: string, places: string[]): Promise<Dummy> {
  const seed = (await seedsOf(repo)).filter(Boolean)
  if (!seed.length) return no('빈 뼈대 커밋(ffad230)이 없는 호 저장소입니다.')
  // ① 건드린 커밋
  const touched = lines(await git(repo, ['log', '--format=%H', '--', ...places], TIMEOUT))
  const other = touched.filter((h) => !seed.includes(h))
  if (!touched.length) return no('빈 뼈대가 아닙니다.')
  if (other.length) return no(`빈 뼈대 이후에 수정한 커밋이 ${other.length}개 있습니다.`)
  // ③ 원형과 같은가 — ffad230 에 그 자리가 없으면(NU 처럼 다른 커밋이 깐 뼈대) rev-parse 가 실패한다. 다른 것으로 본다
  const [now, was] = await Promise.all(
    [`HEAD:${places[0]}`, `${ORIGIN}:${places[0]}`].map((r) =>
      git(repo, ['rev-parse', '--verify', '--quiet', r], TIMEOUT)
        .then((o) => o.trim())
        .catch(() => '')
    )
  )
  if (!now || now !== was) return no('빈 뼈대와 내용이 다릅니다.')
  return YES
}

/**
 * 내용으로 — Activity.ts 가 뼈대 지문과 같은 자리만 잰다(아니면 null). 있는 파일을 못 읽으면 던져서 「모른다」가 된다.
 * 파일 목록을 먼저 맞추므로 아래에서 읽는 파일은 다 있다
 */
function contentRule(repo: string, code: string): Dummy | null {
  const dir = join(repo, 'src', 'activity', code)
  if (!existsSync(join(dir, 'Activity.ts'))) return null
  if (!PRINTS['Activity.ts'].includes(print(join(dir, 'Activity.ts'), code))) return null
  const entries = readdirSync(dir, { withFileTypes: true })
  const names = entries.filter((e) => e.isFile()).map((e) => e.name)
  if (names.length !== entries.length || [...names].sort().join('\n') !== [...FILES].sort().join('\n')) {
    return no('빈 뼈대와 파일 목록이 다릅니다.')
  }
  const info = JSON.parse(readFileSync(join(dir, 'activityInfo.json'), 'utf8')) as { devFinished?: unknown }
  if (info.devFinished === true) return no('개발 완료로 표시되어 있습니다.')
  for (const [name, ok] of Object.entries(PRINTS)) {
    if (!ok.includes(print(join(dir, name), code))) return no(`${name} 파일이 빈 뼈대와 다릅니다.`)
  }
  const pub = join(repo, 'public', 'sparklab', code)
  // `listPub` 은 못 읽은 폴더를 빈 목록으로 돌려준다 — 있는 폴더는 먼저 열어 본다(못 열면 던진다)
  if (existsSync(pub)) readdirSync(pub)
  if (listPub(pub).some((f) => !/(^|\/)readme\.md$/i.test(f))) return no('리소스 파일이 있습니다.')
  return YES
}

/**
 * 지문 — 줄 끝을 LF 로, 학습코드를 `<CODE>` 로 바꾼 글의 sha256. `PRINTS` 를 잰 방법과 한 글자도 달라지면 안 된다.
 * 줄 끝을 맞추는 것은 PC 마다 git 의 autocrlf 가 달라 같은 커밋도 CRLF · LF 로 풀리기 때문이다
 */
function print(file: string, code: string): string {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split(code).join('<CODE>')
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
