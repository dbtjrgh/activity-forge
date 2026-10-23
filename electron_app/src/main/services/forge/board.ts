import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BoardItem, BoardKey, BoardList, BoardResult } from '../../../shared/forge'
import { SUBJECT_CODES, hoLabel, hoNext, hoOrder, type SUBJECTS } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { toTrash } from '../../lib/trash'
import { withWork } from './boardwork'
import { loadForge, type Forge } from './runtime'

/** 배치표 파일 이름 꼴 — `EN07.json` */
const LAYOUT_FILE = /^([A-Z]{2})(\d{2})\.json$/
/**
 * 「호 열기」가 여는 과목 — 과목 표 전부. **KO 도 연다** (2026-09-29 사용자 말 — 「한글은 왜 안 생기는지」). 처음엔 여쭐 것 6(KO 는 다른 팀 몫)을
 * 따라 뺐었다. 진행판에 띄우는 것까지만 같다 — KO 빈 뼈대를 저절로 채우거나 「끝」을 적는 것은 여전히 막는다(`dummy.ts` · `done.ts`).
 * 누리(NU)도 연다(2026-10-21) — 1호 L1 이 본보기이고 나머지는 다른 팀이 모듈을 골라 채운다
 */
const OPEN_SUBJECTS: readonly string[] = SUBJECT_CODES

/**
 * **과목 표 두 벌이 같은가** (2026-10-21). 렌더러는 forge 를 못 불러 과목 표를 `shared/forge/subjects.ts` 에 한 벌 더 둔다.
 * forge 는 빌드할 때 앱 메인에 같이 묶여서 실행 중에 갈라질 일은 없고, 소스에서 한쪽만 고친 날에만 갈라진다 — 그래서 컴파일에서 잡는다.
 * 글자 · 이름 · 차례 가운데 하나라도 다르면 `Must<false>` 가 되어 타입 검사가 실패한다
 */
type Rows<T> = { -readonly [K in keyof T]: T[K] extends { code: infer C extends string; name: infer N extends string } ? `${C} ${N}` : never }
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Must<T extends true> = T
export type SubjectsTie = Must<Same<Rows<Forge['spec']['SUBJECTS']>, Rows<typeof SUBJECTS>>>

/** 한 호 한 과목의 칸 — 3레벨 × 4주 × 3활동 */
const SLOTS = [1, 2, 3].flatMap((l) => [1, 2, 3, 4].flatMap((w) => [1, 2, 3].map((s) => `L${l}W${w}S${s}`)))

/**
 * **몇 칸이 끝났나** (2026-09-29 사용자 말 — 「다 완성돼 있는 것들은 겉보기에서도 티 나게」). 호 저장소의 activityInfo.json
 * devFinished 만 센다 — 진행판 한 장(`boardOf`)을 다 그리면 호가 열두 개일 때 몇 초가 걸려서, 옆줄은 이 가벼운 셈을 쓴다.
 * 배치표가 뺀 칸(국어 협력사 몫)은 셈에서 뺀다. 호 저장소가 없으면 null(모른다)
 */
function progressOf(repo: string, skipped: Set<string>, subject: string, issue: string): { done: number | null; total: number } {
  const slots = SLOTS.filter((s) => !skipped.has(s))
  if (!existsSync(repo)) return { done: null, total: slots.length }
  let done = 0
  for (const s of slots) {
    const code = `${subject}${s.slice(0, 2)}M${issue}${s.slice(2)}`
    try {
      const info = JSON.parse(readFileSync(join(repo, 'src', 'activity', code, 'activityInfo.json'), 'utf8')) as { devFinished?: unknown }
      if (info.devFinished === true) done += 1
    } catch {
      // 없거나 못 읽으면 안 끝난 칸이다
    }
  }
  return { done, total: slots.length }
}

const empty = (error: string): BoardList => ({ boards: [], opens: [], error })

/**
 * **열 수 있는 다음 호 — 과목마다** (2026-10-21). 작업 폴더에는 m09~m11 더미까지 있어 「가장 새 호」를 저절로 열면 틀린다 — 사람이 한 번 누른다(M7).
 * 과목마다 연 호(배치표가 하나라도 있는 호) 가운데 그 과목이 빠진 가장 옛 호가 먼저고, 없으면 가장 늦은 호의 다음 호다. 그 호 저장소가 있을 때만.
 * 여태처럼 다음 호를 하나로 세면 1호 누리가 그 자리를 차지해, 누리를 다 열 때까지 영어 · 수학 · 국어 새 호를 못 연다. 같은 호는 한 줄로 모은다.
 * **차례는 호 차례다**(`hoOrder` · `hoNext`) — M 번호 차례로 세면 누리가 5호 다음에 6호(방학, M11)를 건너뛰고 7호(M06)부터 열었다
 */
export function opensOf(boards: BoardKey[], repo: (issue: string) => boolean): BoardList['opens'] {
  const issues = [...new Set(boards.map((b) => b.issue))].sort((a, b) => hoOrder(a) - hoOrder(b))
  const last = issues.at(-1)
  const cand = last === undefined ? null : hoNext(last)
  const by = new Map<string, string[]>()
  for (const s of OPEN_SUBJECTS) {
    const at = issues.find((i) => repo(i) && !boards.some((b) => b.issue === i && b.subject === s)) ?? (cand && repo(cand) ? cand : null)
    if (at) by.set(at, [...(by.get(at) ?? []), s])
  }
  return [...by.entries()].sort((a, b) => hoOrder(a[0]) - hoOrder(b[0])).map(([issue, subjects]) => ({ issue, subjects }))
}

/**
 * 닫을 수 있나 — **화면이 연 배치표이고(note 가 forge `OPENED_NOTE`) 사람이 정한 칸이 0 일 때만.** 못 닫으면 그 까닭.
 * KO07 처럼 사람이 만든 배치표는 칸이 0 이어도 `skip`(협력사와 나눔) 같은 결정을 들고 있다 — 닫으면 그것이 사라진다.
 */
function closeWhy(file: string, opened: string): string {
  try {
    const doc = JSON.parse(readFileSync(file, 'utf8')) as { slots?: Record<string, unknown>; note?: unknown }
    if (doc.note !== opened) return '직접 만든 배치표라 닫을 수 없습니다'
    const n = Object.keys(doc.slots ?? {}).length
    return n ? `모듈을 정해 둔 학습코드가 ${n}개 있어 닫을 수 없습니다` : ''
  } catch {
    return '배치표를 읽지 못해 닫을 수 없습니다'
  }
}

/**
 * 진행판이 있는 과목·호 목록. `_layout` 에 배치표가 있는 것만 보여 준다.
 * **없는 것을 목록에 올리지 않는다** — 골라도 빈 표가 나올 뿐이다.
 *
 * 그리고 **열 수 있는 다음 호**(M7) — 과목마다 따로 센다(`opensOf`).
 */
export async function listBoards(): Promise<BoardList> {
  try {
    const { paths, layout } = await loadForge()
    const dir = paths.repoPath('_layout')
    const boards: BoardItem[] = readdirSync(dir)
      .map((name) => LAYOUT_FILE.exec(name))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => {
        const subject = m[1] as string
        const issue = m[2] as string
        const skipped = new Set(layout.skippedOf(subject, issue).slots.map((s) => s.slot))
        const repo = join(paths.workRoot(), `sparkon_m${issue}`)
        return { subject, issue, closeWhy: closeWhy(join(dir, m[0]), layout.OPENED_NOTE), ...progressOf(repo, skipped, subject, issue) }
      })
      .sort((a, b) => a.issue.localeCompare(b.issue) || a.subject.localeCompare(b.subject))

    const opens = opensOf(boards, (i) => existsSync(join(paths.workRoot(), `sparkon_m${i}`)))

    if (boards.length === 0) {
      return { ...empty(`배치표가 없습니다. ${dir} 폴더에 {과목}{호}.json 파일을 넣으세요.`), opens }
    }
    return { boards, opens }
  } catch (error) {
    return empty(toMessage(error))
  }
}

/** 그 호를 연다 — 그 호에서 열 수 있는 과목(`opensOf`)마다 빈 배치표 한 장. 이미 있는 것은 안 건드린다 */
export async function openIssue(issue: string): Promise<BoardList> {
  try {
    const forge = await loadForge()
    const now = await listBoards()
    const open = now.opens.find((o) => o.issue === issue)
    // M 번호에 「호」를 붙이면 M11 이 「11호」가 된다(6호다) — 호 이름은 `hoLabel` 로만
    if (!open) return { ...now, error: `${hoLabel(issue)} 진행판은 지금 열 수 없습니다.` }
    const bad = open.subjects.map((s) => forge.layout.openLayout(s, issue)).find((r) => !r.ok)
    if (bad) return { ...(await listBoards()), error: bad.error }
    return listBoards()
  } catch (error) {
    return empty(toMessage(error))
  }
}

/**
 * 그 진행판을 닫는다 — 배치표 파일을 **휴지통으로.** 호 저장소와 리소스는 안 건드린다.
 * **화면이 연 빈 배치표만 닫는다**(`closeWhy`) — 사람이 정한 칸이나 사람이 만든 배치표는 그 결정이 같이 사라진다.
 */
export async function closeBoard(key: BoardKey): Promise<BoardList> {
  try {
    const { paths, layout } = await loadForge()
    const file = join(paths.repoPath('_layout'), `${key.subject}${key.issue}.json`)
    if (!existsSync(file)) return { ...(await listBoards()), error: `${key.subject}${key.issue} 배치표가 없습니다.` }
    const why = closeWhy(file, layout.OPENED_NOTE)
    if (why) return { ...(await listBoards()), error: `${key.subject}${key.issue}: ${why}.` }
    await toTrash(file)
    return listBoards()
  } catch (error) {
    return empty(toMessage(error))
  }
}
/**
 * 진행판 한 화면. forge 의 세 함수를 한 번에 부른다
 * (`boardOf` · `moduleOrder` · `skippedOf` — CLI `forge layout` 이 뿌리는 것과 같은 값).
 */
export async function board(key: BoardKey): Promise<BoardResult> {
  const empty: BoardResult = {
    ...key,
    rows: [],
    groups: [],
    skipped: { note: '', slots: [] }
  }

  try {
    const forge = await loadForge()
    const { layout } = forge
    const rows = layout.boardOf(key.subject, key.issue)

    // 칸이 0 이면 배치표나 호 저장소를 못 읽은 것이다. 빈 표를 그냥 보여주지 않는다.
    if (rows.length === 0) {
      return {
        ...empty,
        skipped: layout.skippedOf(key.subject, key.issue),
        error: `${key.subject}${key.issue} 배치표에 학습코드가 없습니다. 배치표와 호 저장소를 확인하세요.`
      }
    }

    return {
      ...key,
      rows: withWork(forge, key.subject, rows),
      groups: layout.moduleOrder(key.subject, key.issue),
      skipped: layout.skippedOf(key.subject, key.issue)
    }
  } catch (error) {
    return { ...empty, error: toMessage(error) }
  }
}
