/**
 * **회귀 검사의 대상** — 고친 공용 모듈과 그 모듈을 쓰는 개발 완료 완성본 (2026-10-15, 「관리」 화면).
 *
 * - 고친 모듈은 공용 저장소(sparkon_common)의 **커밋 안 한 변경**과 **origin/main 에 없는 커밋**에 든 `_common/module/<과목>/<모듈>/` 과
 *   `_common/sparkLib/module/<모듈>/`(VideoPlayer · InterBook 등, 열쇠 `sparkLib/<모듈>`)이다.
 *   받아 오지 않는다(fetch 안 함). 그 밖(partner_common · sparkLib 의 모듈 밖)이 바뀐 것은 어느 모듈에 닿는지 몰라 자리만 알린다
 * - 완성본은 **그 모듈을 import 하는** 개발 완료 액티비티 전부다 — 과목을 건넌 것까지(국어 완성본이 `MA/M10` 을 쓴다).
 *   목록은 「관리」의 점검 · 팀별과 같은 훑기(`hallwalk.ts` `activities`), import 읽기는 forge `survey.modulesOf` 하나다.
 *   처음에는 진행판의 칸 셈(`scanCells`)을 썼는데, 그 셈은 칸 과목의 모듈만 남겨 과목을 건넌 완성본을 놓쳤다
 * - 적은 이름은 실제 폴더 이름으로 맞춘다 — 대소문자를 가리지 않고(`m28` → `MA/M28`), 과목 글자(KO)와 폴더 이름(KR)을 둘 다 받는다
 * - 과목 폴더 이름(KR ↔ KO)은 forge `moduleDir` 의 표 하나를 쓴다 — 여기에 다시 적지 않는다
 *
 * 읽기만 한다. Electron 을 import 하지 않는다(services 규칙).
 */

import { readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { RegressChanged, RegressModule } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { lines, tryGit } from '../../lib/git'
import { dirtyPaths, moduleKeyOf } from './hallsyncplan'
import { activities } from './hallwalk'
import { DRIVEN } from './regressdrivers'
import { loadForge, type Forge } from './runtime'

const T = 30_000
/** sparkLib 모듈 열쇠의 앞머리 — `sparkLib/VideoPlayer` */
const LIB = 'sparkLib'
const LIB_PATH = /^_common\/sparkLib\/module\/([^/]+)\//
/** 모듈 폴더 밖 자리는 이 깊이까지만 보인다(`_common/sparkLib/widget`) */
const OUTSIDE_DEPTH = 3
const OUTSIDE_SHOWN = 6
/** 이름 칸에서 한 번에 찾는 이름 수 */
export const MAX_NAMES = 20

export type RegressTarget = { code: string; month: string; module: string; key: string; repo: string }
/** 모듈 열쇠(소문자) → 그 모듈을 import 하는 개발 완료 완성본 */
export type ModuleUses = Map<string, Omit<RegressTarget, 'key'>[]>

/**
 * 모듈을 담는 폴더들 — 열쇠 앞머리(`EN` · `MA` · `KR` · `NU` · `sparkLib`), 그 폴더, 이름 칸에서 받는 앞머리(소문자).
 * 과목은 forge 과목 표(`spec.SUBJECT_CODES`) 하나를 돈다 — 여기 따로 적어 두었을 때는 누리(NU) 모듈을 고쳐도 「모듈 밖 자리」로만 알렸다(2026-10-21)
 */
function homes(forge: Forge): { head: string; dir: string; accept: string[] }[] {
  const subjects = forge.spec.SUBJECT_CODES.map((s) => {
    const dir = forge.survey.moduleDir(s, '')
    return { head: basename(dir), dir, accept: [s.toLowerCase(), basename(dir).toLowerCase()] }
  })
  const lib = join(dirname(dirname(forge.survey.moduleDir('MA', ''))), LIB, 'module')
  return [...subjects, { head: LIB, dir: lib, accept: [LIB.toLowerCase()] }]
}

/** 모듈 열쇠(`KR/K05` · `sparkLib/VideoPlayer`) → 진행판 과목 · 모듈. sparkLib 모듈은 과목이 없다(빈 글). 모듈 폴더가 아니면 null */
export function moduleOfKey(forge: Forge, key: string): { subject: string; module: string } | null {
  const [dir = '', module = '', ...rest] = key.split('/')
  if (!dir || !module || rest.length) return null
  if (dir === LIB) return { subject: '', module }
  const subject = forge.spec.SUBJECT_CODES.find((s) => basename(forge.survey.moduleDir(s, '')) === dir)
  return subject ? { subject, module } : null
}

function folders(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * 적은 이름(`M28` · `m28` · `KO/K05` · `kr/k05` · `VideoPlayer` · `sparkLib/VideoPlayer`) → 실제 폴더 이름의 열쇠들.
 * **대소문자를 가리지 않는다** — Windows 는 `MA/m28` 폴더도 있다고 답해, 적은 글자 그대로 열쇠가 되면 완성본이 0개로 나왔다.
 * 앞머리가 없으면 과목 폴더와 sparkLib 를 다 찾는다(같은 이름이 둘에 있으면 둘 다). 못 찾으면 빈 목록
 */
export function keysOfName(forge: Forge, name: string): string[] {
  const parts = name.trim().split('/')
  if (parts.length > 2) return []
  const head = parts.length === 2 ? (parts[0] ?? '').toLowerCase() : ''
  const want = (parts[parts.length - 1] ?? '').toLowerCase()
  if (!want) return []
  const out: string[] = []
  for (const h of homes(forge)) {
    if (head && !h.accept.includes(head)) continue
    const hit = folders(h.dir).find((f) => f.toLowerCase() === want)
    if (hit) out.push(`${h.head}/${hit}`)
  }
  return out
}

/** 이름 칸에 적은 것들 → 모듈 열쇠. 못 찾은 이름과 상한(`MAX_NAMES`)에 걸려 안 본 이름은 한 문장(`note`)으로 알린다 */
export function keysOfNames(forge: Forge, names: string[]): { keys: string[]; lost: string[]; note: string } {
  const keys: string[] = []
  const lost: string[] = []
  for (const n of names.slice(0, MAX_NAMES)) {
    const found = keysOfName(forge, n)
    if (found.length) keys.push(...found)
    else lost.push(n)
  }
  const lostText = lost.length ? `${lost.join(', ')} 모듈은 공용 저장소에서 찾지 못해 뺐` : ''
  const capText = names.length > MAX_NAMES ? `이름은 앞 ${MAX_NAMES}개만 봤습니다.` : ''
  const note = lostText && capText ? `${lostText}고, ${capText}` : lostText ? `${lostText}습니다.` : capText
  return { keys: [...new Set(keys)], lost, note }
}

/** 액티비티 import 하나가 가리키는 공용 모듈의 열쇠. 공용이 아니면(액티비티 안 파생 모듈) 빈 글 */
function keyOfRef(forge: Forge, r: { kind: string; subject: string; module: string }): string {
  if (r.kind === 'sparkLib') return `${LIB}/${r.module}`
  if (r.kind !== 'activity') return ''
  return `${basename(forge.survey.moduleDir(r.subject, ''))}/${r.module}`
}

/**
 * 공용 모듈마다 그것을 import 하는 개발 완료 완성본 — 호 저장소를 한 번 훑는다(동기, 액티비티 1,200개 남짓).
 * 모듈 여럿의 수를 셀 때는 한 번 만들어 넘긴다(모듈마다 다시 훑지 않게)
 */
export function moduleUses(forge: Forge): ModuleUses {
  const work = forge.paths.workRoot()
  const out: ModuleUses = new Map()
  for (const a of activities(work)) {
    if (a.finished !== true) continue
    const repo = join(work, `sparkon_m${a.month}`)
    const refs = forge.survey.modulesOf(join(repo, 'src', 'activity', a.code))
    const module = refs
      .map((r) => r.module)
      .sort()
      .join('+')
    for (const key of new Set(refs.map((r) => keyOfRef(forge, r).toLowerCase()).filter(Boolean))) {
      const list = out.get(key) ?? []
      list.push({ code: a.code, month: a.month, module, repo })
      out.set(key, list)
    }
  }
  return out
}

/** 이 모듈들을 쓰는 개발 완료 완성본 — 호 차례. 학습코드가 열쇠 둘에 걸리면 앞 열쇠에만 */
export function targetsOf(forge: Forge, keys: string[], uses: ModuleUses = moduleUses(forge)): RegressTarget[] {
  const out: RegressTarget[] = []
  for (const key of keys) {
    for (const u of uses.get(key.toLowerCase()) ?? []) if (!out.some((t) => t.code === u.code)) out.push({ ...u, key })
  }
  return out.sort((a, b) => a.month.localeCompare(b.month) || a.code.localeCompare(b.code))
}

/** 고친 모듈 — 커밋 안 함 · main 에 없는 커밋, 그리고 그 완성본 수 */
export async function regressChanged(): Promise<RegressChanged> {
  try {
    const forge = await loadForge()
    // 공용 폴더 자리는 forge `commonRoot` 하나다 — 사람이 다른 자리로 정할 수 있다(2026-10-21)
    const root = forge.commonroot.commonRoot()
    const dirty = await dirtyPaths(root)
    const log = await tryGit(root, ['-c', 'core.quotepath=false', 'log', '--no-merges', '--name-only', '--format=', 'origin/main..HEAD'], T)
    const ahead = log.ok ? lines(log.out) : []
    const byKey = new Map<string, RegressModule>()
    const outside = new Set<string>()
    const put = (p: string, side: 'dirty' | 'ahead'): void => {
      const lib = LIB_PATH.exec(p)
      const key = moduleKeyOf(p) || (lib ? `${LIB}/${lib[1]}` : '')
      const m = key ? moduleOfKey(forge, key) : null
      if (!m) {
        if (p.startsWith('_common/')) outside.add(p.split('/').slice(0, OUTSIDE_DEPTH).join('/'))
        return
      }
      const row = byKey.get(key) ?? { key, ...m, dirty: false, ahead: false, finished: 0 }
      row[side] = true
      byKey.set(key, row)
    }
    dirty.forEach((p) => put(p, 'dirty'))
    ahead.forEach((p) => put(p, 'ahead'))
    const modules = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
    const uses = moduleUses(forge)
    for (const m of modules) m.finished = targetsOf(forge, [m.key], uses).length
    const why = log.err.trim().split('\n')[0] ?? ''
    return {
      modules,
      outside: [...outside].sort().slice(0, OUTSIDE_SHOWN),
      driven: DRIVEN,
      ...(log.ok ? {} : { error: `main 에 없는 커밋을 읽지 못해 커밋하지 않은 변경으로만 찾았습니다${why ? `(${why})` : ''}.` })
    }
  } catch (error) {
    return { modules: [], outside: [], driven: DRIVEN, error: toMessage(error) }
  }
}
