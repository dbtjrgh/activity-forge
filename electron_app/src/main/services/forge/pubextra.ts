/**
 * **호 저장소에 있는데 안 쓰는 리소스** — `public/sparklab/<코드>` 에서 아무도 안 부르는 파일 (2026-10-12 사용자 요청 —
 * 「지울 수 있게 해놔도 좋을듯 아니면 알아서 지우던가 안정빵하게」).
 *
 * 9호 우리 몫 47개를 재 보니 둘이 있었다 — KOL1M08W4S2 `record_text_box.png`(K36 은 공용 폴더 것을 쓴다),
 * KOL2M08W2S2 `SL_ko_206_s2_nar01.mp3`. 대화로 만들기는 Claude 가 적은 파일만 복사하지만 이전 방식 · 손으로 만든 것이 남긴다.
 * 대화 속 Claude 는 셸이 없어 지울 수도 없다. 그래서 앱이 고르고 사람이 누른다.
 *
 * - 안 쓰는 것 = AssetTable 이 안 부르고(`pubfiles.ts`), **학습코드 소스 · 그 소스가 불러오는 모듈 소스 · 리소스 자리의 다른 글 파일 어디에도 이름이 안 나오는 것**
 *   - 모듈은 이름을 조립해 부르기도 한다(M19 `'button' + (num + 1) + '.png'`) — 이름 앞뒤 조각이 `+` · `${` 와 붙어 나오면 쓰는 것으로 본다
 *   - 리소스 자리 안 파일이 부르기도 한다 — 인터북 `animatecc/*.js` 매니페스트, 비트맵 글꼴 `.fnt`, 로티 `.json`.
 *     처음에는 이것을 안 읽어 우리 팀 인터북 학습코드 하나에서 쓰는 그림 · 소리 98개를 골랐다(2026-10-12 검토). 자기 파일 글은 안 본다(로티는 제 이름을 품는다)
 *   - 모듈 소스의 `/sparklab/common/` 줄은 안 본다 — 공용 폴더 것이라 이 자리 파일과 상관없다
 * - 빼는 것 — `readme.md`(빈 폴더를 저장소에 남기려고 뼈대에 든 것), 점으로 시작하는 파일, 대소문자만 다른 것(「없는 파일」 검사가 알린다)
 * - forge 가 액티비티를 다시 못 읽거나 모듈 소스를 못 찾으면 **하나도 안 고른다** — 모르고 고르면 쓰는 것까지 고른다
 * - **저절로 지우지 않는다** — 조립한 이름은 다 못 알아본다. 사람이 목록을 보고 누르면 그때 다시 세어 **화면에 보인 것과 겹치는 것만** 휴지통으로
 *   (그새 새로 들어온 파일은 사람이 못 봤다). 대화가 도는 중이거나 남의 팀 것이면 안 옮긴다 — 남의 팀 것은 목록에 까닭을 같이 낸다
 * - 옮긴 것은 호 저장소 git 에 지운 것으로 남고 다음 「양산 완료 커밋」에 같이 담긴다(`hallcommit.ts` 가 `git add -A -- public/sparklab/<코드>`)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { LeftoverTrash, PubExtra } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { escapeRe } from '../../lib/regex'
import { toTrash } from '../../lib/trash'
import { chatBusy } from './chatstore'
import { listPub, wantOf } from './pubfiles'
import { loadForge, type Forge } from './runtime'
import { repoOf } from './writecheck'

/**
 * 소스로 읽는 글 파일 — 학습코드 · 모듈 쪽(`index.html` · `style.css` 의 `url()` 도)과 리소스 자리 쪽.
 * 모듈 밖 공용 코드(`sparkLib` · `vueComponent`)는 안 읽는다 — 학습코드 자리 파일을 부르는 길은 매니페스트(`ActivityAdobeApp.vue`)뿐이고
 * 그 매니페스트는 리소스 자리 글 파일로 읽힌다(2026-10-12 `_common` 전체를 grep 해 확인)
 */
const SOURCE = /\.(ts|tsx|js|vue|json|html?|s?css)$/i
const PUB_TEXT = /\.(js|json|fnt|atlas|css|html?|xml|plist)$/i

/** 폴더 안 글 파일을 `경로 → 글` 로. `skipCommon` 이면 공용 폴더(`/sparklab/common/`)를 가리키는 줄은 뺀다 */
function textsIn(dir: string, pick: RegExp, skipCommon = false): Map<string, string> {
  const out = new Map<string, string>()
  let all: fs.Dirent[] = []
  try {
    all = fs.readdirSync(dir, { recursive: true, withFileTypes: true }) as fs.Dirent[]
  } catch {
    return out
  }
  for (const e of all.filter((d) => d.isFile() && pick.test(d.name))) {
    const full = path.join(e.parentPath, e.name)
    try {
      const text = fs.readFileSync(full, 'utf8')
      out.set(full, skipCommon ? text.split(/\r?\n/).filter((l) => !l.includes('/sparklab/common/')).join('\n') : text)
    } catch {
      // 못 읽은 글 파일이 있으면 그 안의 이름을 모른다 — 고르지 않게 부르는 쪽이 본다
      out.set(full, '\0')
    }
  }
  return out
}

/**
 * 학습코드 소스가 불러오는 모듈 폴더 — 배치표가 아니라 실제로 도는 코드를 본다.
 * 옛 호는 배치표에 모듈이 없고, 한 학습코드가 모듈 둘(공용 조각 `dori_common` 등)을 부르기도 한다. 폴더가 아니면 한 칸 위 폴더.
 * 과목째 부르는 꼴(`import { E05 } from "@_common/module/EN/"`, 1호 영어)은 가져온 이름의 폴더 — 없으면 과목 폴더 통째.
 * `module` 폴더는 깊이가 다르다 — `@_common/sparkLib/module/VideoPlayer/…`(1호 영상)
 */
function modulesOf(repo: string, own: string): string[] {
  const common = path.join(repo, 'src', '_common')
  const isDir = (d: string): boolean => fs.existsSync(d) && fs.statSync(d).isDirectory()
  const out = new Set<string>()
  for (const m of own.matchAll(/(?:\{([^}]*)\}\s*from\s*)?["']@_common\/([\w/.-]*?module)\/([\w-]+)\/?([\w-]*)/g)) {
    const group = path.join(common, m[2], m[3])
    const names = m[4] ? [m[4]] : (m[1] ?? '').split(',').map((n) => n.trim().split(/\s+/)[0]).filter(Boolean)
    const hits = names.map((n) => path.join(group, n)).filter(isDir)
    for (const d of hits) out.add(d)
    if (!hits.length && isDir(group)) out.add(group)
  }
  return [...out]
}

/**
 * 소스가 이 파일을 부를 수 있나. 이름 그대로 나오거나, 조립한 꼴로 나오면 쓴다 —
 * 앞 조각 + `${` 또는 `' +`(`card_${i}` · `'button' + n`), `}` 또는 `+ '` + 뒤 조각 + `.`(`${name}_on.png`)
 */
function named(rel: string, text: string): boolean {
  const name = path.posix.basename(rel)
  const stem = name.replace(/\.[^.]+$/, '')
  if (text.includes(name) || text.includes(stem)) return true
  const cuts = new Set<number>()
  for (const m of stem.matchAll(/_|\d+/g)) {
    cuts.add(m.index)
    cuts.add(m.index + m[0].length)
  }
  for (const k of cuts) {
    const head = stem.slice(0, k)
    const tail = stem.slice(k)
    if (head.length >= 3 && new RegExp(`${escapeRe(head)}(\\$\\{|['"\`]\\s*\\+)`).test(text)) return true
    if (tail.length >= 2 && new RegExp(`(\\}|\\+\\s*['"\`])${escapeRe(tail)}\\.`).test(text)) return true
  }
  return false
}

/** 리소스 자리의 다른 글 파일이 이 파일 이름을 품나 — 매니페스트 · 글꼴 · 로티는 이름을 그대로 적는다 */
const listed = (rel: string, pubTexts: Map<string, string>, self: string): boolean => {
  const name = path.posix.basename(rel)
  for (const [file, text] of pubTexts) if (file !== self && (text === '\0' || text.includes(name))) return true
  return false
}

const sizeOf = (f: string): number => {
  try {
    return fs.statSync(f).size
  } catch {
    return 0
  }
}

const skipped = (rel: string): boolean => {
  const name = path.posix.basename(rel)
  return /^readme\.md$/i.test(name) || name.startsWith('.')
}

/** 남의 팀 것인가 — activityInfo 의 팀이 비었으면(빈 뼈대 · 만드는 중) 우리 것으로 본다. 남의 것이면 그 팀 이름 */
function theirs(forge: Forge, repo: string, code: string): string {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(repo, 'src', 'activity', code, 'activityInfo.json'), 'utf8')) as { devTeam?: unknown }
    const team = typeof info.devTeam === 'string' ? info.devTeam : ''
    return team && team !== forge.user.loadUser().devTeam ? team : ''
  } catch {
    return ''
  }
}

export function pubExtra(forge: Forge, code: string): PubExtra {
  const repo = repoOf(forge.paths, code)
  if (!repo) return { files: [], error: '호 저장소 위치를 정하지 못했습니다.' }
  const act = path.join(repo, 'src', 'activity', code)
  const pub = path.join(repo, 'public', 'sparklab', code)
  const have = listPub(pub).filter((r) => !skipped(r))
  // 빈 뼈대 · 아직 안 만든 것은 다시 읽어 볼 것도 없다
  if (!have.length || !fs.existsSync(act)) return { files: [] }

  const c = forge.api.clone(code, code)
  if (!c.ok || c.notes.some((n) => n.includes('못 읽었습니다'))) {
    return { files: [], error: '액티비티를 다시 읽지 못해 쓰지 않는 파일을 확인할 수 없습니다.' }
  }
  const ownTexts = [...textsIn(act, SOURCE).values()]
  const own = ownTexts.join('\n')
  const modules = modulesOf(repo, own)
  if (!modules.length) return { files: [], error: '모듈 소스를 찾지 못해 쓰지 않는 파일을 확인할 수 없습니다.' }
  const texts = [...ownTexts, ...modules.flatMap((m) => [...textsIn(m, SOURCE, true).values()])]
  if (texts.includes('\0')) return { files: [], error: '읽지 못한 소스 파일이 있어 쓰지 않는 파일을 확인할 수 없습니다.' }
  const want = new Set(wantOf(forge, c.recipe, act).map((r) => r.toLowerCase()))
  const text = texts.join('\n')
  const left = have.filter((r) => !want.has(r.toLowerCase()) && !named(r, text))
  if (!left.length) return { files: [] }
  // 리소스 자리의 글 파일은 남은 것이 있을 때만 읽는다 — 로티가 많으면 수십 MB 다
  const pubTexts = textsIn(pub, PUB_TEXT)
  const files = left.filter((r) => !listed(r, pubTexts, path.join(pub, ...r.split('/'))))
  const team = theirs(forge, repo, code)
  return {
    files: files.map((rel) => ({ rel, size: sizeOf(path.join(pub, rel)) })),
    ...(team && files.length ? { locked: `${team} 담당 액티비티라 파일을 옮기지 않습니다.` } : {})
  }
}

export async function pubExtraOf(code: string): Promise<PubExtra> {
  try {
    return pubExtra(await loadForge(), code)
  } catch (error) {
    return { files: [], error: toMessage(error) }
  }
}

/** 다시 세어 **화면에 보인 것(`shown`)과 겹치는 것만** 휴지통으로. 하나가 안 돼도 나머지는 옮기고, 안 된 것을 알린다 */
export async function trashPubExtra(code: string, shown: string[]): Promise<LeftoverTrash> {
  const out: LeftoverTrash = { moved: [], failed: [] }
  try {
    const forge = await loadForge()
    if (chatBusy(code)) return { ...out, error: '생성 중에는 파일을 옮길 수 없습니다. 생성이 끝난 뒤 다시 시도하세요.' }
    const now = pubExtra(forge, code)
    if (now.error || now.locked) return { ...out, error: now.error ?? now.locked }
    const seen = new Set(shown)
    const pub = path.join(repoOf(forge.paths, code), 'public', 'sparklab', code)
    for (const f of now.files.filter((x) => seen.has(x.rel))) {
      try {
        await toTrash(path.join(pub, f.rel))
        out.moved.push(f.rel)
      } catch (error) {
        out.failed.push({ rel: f.rel, why: toMessage(error) })
      }
    }
    return out
  } catch (error) {
    return { ...out, error: toMessage(error) }
  }
}
