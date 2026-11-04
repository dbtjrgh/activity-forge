/**
 * **공유 폴더에서 가져오기 — 흐름** (2026-10-14, 사용자 요청 — 「리소스나 기획서를 넣으면 기획서를 읽고
 * 공유 폴더에서 사운드랑 애니, 영상을 찾아서 가져다 놓는 식으로」).
 *
 * - `shareLook` — 찾는다. 작업대 「리소스」 칸과 받을 리소스 창이 열릴 때 · 리소스나 기획서가 바뀔 때 · 창으로 돌아올 때 부른다.
 *   같은 학습코드를 두 창이 한꺼번에 물으면 한 번만 찾는다
 * - **찾은 것은 저절로 가져온다**(2026-10-15) — 뒤에서 넣고, 넣는 동안은 `copying`, 끝나면 `auto`(때 · 종류별 수)로 화면이 눈에 띄게 알린다.
 *   언제 안 가져오나는 `shareauto.ts`
 * - `shareTake` — 사람이 「공유 폴더에서 가져오기」를 누를 때. **다시 재서** 그때 찾은 것 가운데 화면에 보였던 자리만 넣는다
 * - 어느 쪽이든 덮어쓰지 않고 넣고 양쪽 크기를 대조한다(`rsccopy.ts`)
 * - 공유 폴더 위치는 설정(`.user.json` 의 `shareRoot`, 비면 `SHARE_DEFAULT`). 닿지 않으면 `offline` 한 문장을 보이고 단추를 막는다(`sharefind.ts`)
 * 자리 · 이름 규칙은 `sharerule.ts`(영어 자리는 `shareruleen.ts`, 누리 자리는 `sharerulenu.ts`), 무엇을 고르나는 `sharepick.ts`(영어 소리 · 스토리 영상 · 동요 · 말하기 영상은 `shareen.ts`, 누리 내레이션은 `sharenu.ts`,
 * 이 학습코드 폴더에서 찾는 다른 번호 이름 · 수학 숫자 읽기 이름과 합본 이름은 `shareown.ts`), 기획서의 다시 쓰는 이름은 `planreuse.ts`, 비동기로 훑기는 `sharefind.ts`,
 * 넣기 · 저절로는 `shareauto.ts`, 기록은 `sharelog.ts`. 앱이 원본에서 가져온 기록(`carrylog.ts`)에는 넣지 않는다 — 그 기록은 원본이 바뀌면 치우는데,
 * 공유 폴더 파일은 원본과 상관없다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { SHARE_DEFAULT, subjectName, type ShareLook, type ShareTake } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { mark } from './measure'
import { joinedParts, planSound } from './plansound'
import { blank } from './rsccopy'
import { rangeOf } from './rscrange'
import { loadForge, type Forge } from './runtime'
import { autoNoteOf, copyIn, copyingOf, startAuto, withTake } from './shareauto'
import { budget, reach } from './sharefind'
import { pickEnSounds, pickSong, pickSpeak, pickStory } from './shareen'
import { nearTaken, readLog } from './sharelog'
import { pickNuSounds } from './sharenu'
import { pickJoined, pickNear, pickShared } from './shareown'
import { haveOf, pickLotties, pickMotion, pickSounds, type Ctx, type Pick, type Picked } from './sharepick'
import { keyOf, MOTION_SOUND_DIR, shareKnown } from './sharerule'
import { STORY_MODULE } from './shareruleen'
import { nuNoSpot, nuRootOf } from './sharerulenu'

/** 찾는 중인 것 — 작업대와 받을 리소스 창이 한꺼번에 물어도 한 번만 찾는다 */
const looking = new Map<string, Promise<Found>>()

type Found = { look: ShareLook; picks: Pick[]; forge: Forge | null }

const empty = (code: string, root = '', error?: string): ShareLook => ({
  code,
  dir: '',
  root,
  items: [],
  have: 0,
  miss: [],
  planNames: 0,
  notes: [],
  truncated: '',
  ms: 0,
  ...(error ? { error } : {})
})

/** 설정한 공유 폴더 — 비면 기본 주소 */
const rootOf = (forge: Forge): string => forge.user.loadUser().shareRoot || SHARE_DEFAULT

/** 배치표가 정한 모듈 — 정하지 않았으면 빈 것 */
function moduleOf(forge: Forge, code: string): string {
  const pick = forge.api.layoutFor(code)
  return pick.ok ? (pick.module ?? '') : ''
}

/** 영상을 찾나 — 같은 모듈 개발 완료 완성본이 **모두** 영상을 쓸 때만. 아니면 그 까닭. 찾으면 그 모듈(영어 스토리 영상은 모듈로 가른다) */
function videoWanted(forge: Forge, code: string, module: string): { want: boolean; note: string; module: string } {
  if (!module) return { want: false, note: '모듈을 정하지 않아 영상은 찾지 않았습니다.', module: '' }
  const range = rangeOf(forge, code.slice(0, 2), module)
  if (!range.size) return { want: false, note: `${module} 모듈 완성본이 둘보다 적어 영상을 쓰는지 알 수 없습니다. 영상은 찾지 않았습니다.`, module: '' }
  const video = range.get('video')
  if (video && video.min > 0) return { want: true, note: '', module }
  return { want: false, note: video ? `${module} 모듈 완성본 일부만 영상을 써서 영상은 찾지 않았습니다.` : '', module: '' }
}

/**
 * 여러 갈래에서 고른 것을 하나로 — 같은 자리는 하나만. 다른 갈래가 고른 이름은 「가져오지 않음」에서 뺀다.
 * - 인터북 소리(`animatecc/sounds/`)로 고른 녹음과 이름 · 크기가 같은 `sounds/` 판은 뺀다 — 수학 19 학습코드에서 637개가 양쪽으로 골라졌고
 *   완성본은 637개 모두 인터북 쪽만 썼다(2026-10-23 검산)
 * - 합본(`nar10-11`)을 골랐거나 이미 있으면(`covered`) 낱개 둘(`nar10` · `nar11`)은 「없음」이 아니다(`plannames.ts` `joinedParts`)
 */
function merge(parts: Picked[], covered: string[]): Picked {
  const all = [...new Map(parts.flatMap((p) => p.picks).map((p) => [p.to, p])).values()]
  const sig = (p: Pick): string => `${keyOf(p.name)}|${p.bytes}`
  const inter = new Set(all.filter((p) => p.to.startsWith(MOTION_SOUND_DIR)).map(sig))
  const picks = all.filter((p) => p.kind !== 'sound' || p.to.startsWith(MOTION_SOUND_DIR) || !inter.has(sig(p)))
  const taken = new Set([...picks.map((p) => keyOf(p.name)), ...covered.map(keyOf)].flatMap((k) => [k, ...joinedParts(k)]))
  const miss = parts.flatMap((p) => p.miss).filter((m) => !taken.has(keyOf(m.name)))
  return { picks, miss, have: parts.reduce((n, p) => n + p.have, 0) }
}

/** 찾기 — `fresh` 면 연결과 공유 폴더 목록을 다시 읽는다(사람이 누름 · 「다시 확인」) */
async function look(code: string, fresh: boolean): Promise<Found> {
  const t0 = Date.now()
  let forge: Forge
  try {
    forge = await loadForge()
  } catch (error) {
    return { look: empty(code, '', toMessage(error)), picks: [], forge: null }
  }
  const root = rootOf(forge)
  const dir = forge.files.rscDir(code)
  if (!dir) return { look: empty(code, root, `${code} 학습코드의 리소스 폴더를 정하지 못했습니다.`), picks: [], forge }
  // 자리 규칙이 없는 과목 — 개수 0 을 보이면 「공유 폴더에 없음」으로 읽힌다. 모른다는 한 줄만 보이고(화면은 `error` 면 개수 · 단추를 안 그림)
  // 공유 폴더에 묻지도 않는다. 찾은 것이 없으니 저절로 가져오기도 안 돈다(`lookAndStart` 는 `error` 면 건너뜀)
  const subject = code.slice(0, 2)
  const unknown = (what: string): string => `공유 폴더에서 ${subjectName(subject)} ${what}의 위치를 모릅니다.`
  if (!shareKnown(subject)) return { look: empty(code, root, unknown('리소스')), picks: [], forge }
  const log = readLog(forge.paths.REPO_ROOT, code)
  const auto = log.auto
  const autoNote = autoNoteOf(code)
  const near = nearTaken(log, dir)
  const out: ShareLook = { ...empty(code, root), dir, ...(auto ? { auto } : {}), ...(autoNote ? { autoNote } : {}), ...(near.length ? { near } : {}) }
  const offline = await reach(root, fresh)
  if (offline) return { look: { ...out, offline, ms: Date.now() - t0 }, picks: [], forge }
  // 누리는 뿌리의 형제 폴더다(`sharerulenu.ts`). 훑기는 없는 폴더를 빈 것으로 읽어, 뿌리를 다른 곳으로 정한 사람에게 0 이 「없음」으로 보인다 — 모른다고 한다
  const nuRoot = subject === 'NU' ? nuRootOf(root) : ''
  if (nuRoot && (await reach(nuRoot, fresh))) return { look: { ...out, error: unknown('리소스'), ms: Date.now() - t0 }, picks: [], forge }

  // 기획서를 못 읽은 까닭(`plan.note`)은 「리소스」 칸이 이미 보인다 — 여기서 또 보이면 두 번 나왔다(2026-10-15 검토)
  const plan = planSound(forge, code, dir)
  const names = [...plan.own, ...plan.others]
  out.planNames = names.length + plan.shared.length
  const module = moduleOf(forge, code)
  const video = videoWanted(forge, code, module)
  if (video.note) out.notes.push(video.note)
  // 자리를 모르는 종류(누리 영상)와 자리 규칙이 없는 누리 모듈(누리 전자책)은 찾지 않고 모른다고 한다 — 받을 리소스 창에도 보이게 따로(`unknown`)
  const film = video.want && shareKnown(subject, 'video')
  const blind = subject === 'NU' && nuNoSpot(module) ? unknown('리소스') : video.want && !film ? unknown('영상') : ''
  if (blind) out.unknown = blind

  // 작은 자리(이 학습코드의 로티 · 영상 · 동요 반주 · 말하기 AI 영상 · 영어 소리)부터 — 소리 폴더가 커서 상한에 걸려도 앞 것은 다 본다
  const c: Ctx = { forge, code, root, have: haveOf(forge, code, dir), b: budget(fresh) }
  // 영어 소리 자리는 Level 폴더 아래를 한 겹 더 훑어 크다 — 로티 · 영상 뒤에 본다(2026-10-16 검산). 동요(반주 · 동요 영상)와 낱말 자리는 영상을 찾나와 상관없이 모듈로만 가른다
  const small = [await pickMotion(c, film), await pickStory(c, video.module), await pickSong(c, module), await pickSpeak(c, module), await pickLotties(c, plan.lotties)]
  const en = await pickEnSounds(c, module)
  // 스토리 영상 학습코드는 제 소리가 없다(완성본이 공용 소리만 쓴다) — 「못 찾음」을 띄우지 않는다
  const quiet = video.module === STORY_MODULE || c.b.truncated
  if (code.startsWith('EN') && !quiet && !en.picks.length && !en.have && !en.miss.length) out.notes.push('공유 폴더에서 이 학습코드의 영어 소리를 찾지 못했습니다.')
  // 기획서가 적은 합본 이름 · 다른 번호 이름 · 수학 숫자 읽기 이름은 `shareown.ts` — 이름 주인 자리를 본 뒤라 같은 목록을 다시 읽지 않는다
  const sounds = [await pickSounds(c, names), await pickJoined(c, plan.joined), await pickNear(c, plan.near), await pickShared(c, plan.shared)]
  const got = merge([...small, en, await pickNuSounds(c, nuRoot), ...sounds], plan.joined.filter((j) => c.have.has(j.toLowerCase())))
  out.items = got.picks.map(({ abs: _abs, ...item }) => item)
  out.have = got.have
  out.miss = got.miss
  out.truncated = c.b.why
  out.ms = Date.now() - t0
  return { look: out, picks: got.picks, forge }
}

/** 찾고, 되면 저절로 넣기를 뒤에서 시작한다 — 넣는 중이면 그 수를 같이 돌려준다 */
async function lookAndStart(code: string, fresh: boolean): Promise<Found> {
  const got = await look(code, fresh)
  if (got.forge && !got.look.error && !got.look.offline && got.picks.length) startAuto(got.forge, code, got.look.dir, got.picks)
  const copying = copyingOf(code)
  return copying ? { ...got, look: { ...got.look, copying } } : got
}

/** 같은 학습코드를 찾는 중이면 그 결과를 같이 받는다 */
function lookOnce(code: string, fresh: boolean): Promise<Found> {
  const busy = looking.get(code)
  if (busy && !fresh) return busy
  const job = lookAndStart(code, fresh).finally(() => {
    if (looking.get(code) === job) looking.delete(code)
  })
  looking.set(code, job)
  return job
}

/** 찾는다 — 되면 저절로 가져온다(위 머리말). `fresh` 면 공유 폴더 연결과 목록을 다시 읽는다(「다시 확인」) */
export async function shareLook(code: string, fresh = false): Promise<ShareLook> {
  return (await lookOnce(code, fresh)).look
}

/** 다시 찾아 그때 찾은 것 가운데 **화면에 보였던 자리(`shown`)만** 넣는다 — 그새 새로 잡힌 것은 다음 화면에서 보인다. 덮어쓰지 않는다 */
export function shareTake(code: string, shown: string[]): Promise<ShareTake> {
  const busy = (why: string): ShareTake => ({ look: empty(code, '', why), put: blank('') })
  return withTake(
    code,
    async () => {
      // 누른 때는 연결과 목록을 다시 읽는다 — 들고 있던 「못 닿음」 때문에 로그인한 뒤에도 막히지 않게.
      // 잠금을 쥐고 있어 그사이 저절로 넣기는 시작하지 않는다(`startAuto`)
      const got = await look(code, true)
      const want = new Set(shown)
      const picks = got.picks.filter((p) => want.has(p.to))
      if (got.look.error || got.look.offline || !got.forge || !picks.length) {
        const put = blank(got.look.dir)
        put.note = got.look.error || got.look.offline ? '' : '가져올 파일이 없습니다.'
        return { look: got.look, put }
      }
      const put = await copyIn(got.forge.paths.REPO_ROOT, code, got.look.dir, picks, false)
      // 사람이 누른 일이다 — 리소스를 놓은 것과 같이 센다(`measure.ts`). 저절로 가져온 것은 세지 않는다
      mark(got.forge.paths.REPO_ROOT, code, '리소스', `공유 폴더에서 ${put.took.length}개 가져옴`)
      return { look: got.look, put }
    },
    busy
  )
}
