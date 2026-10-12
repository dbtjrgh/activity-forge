/**
 * `_run.json` — **한 차시를 만드는 데 사람이 몇 번 손을 댔나** (1단계 시험대).
 *
 * 3·5단계가 둘 다 「1단계에서 닫는다」로 끝났습니다. 끝 기준이 전부 이
 * 파일에 걸려 있어서입니다 —
 *
 *   3단계  클릭 수 / 차시 5 → 1
 *   5단계  카드 수 / 차시 「사람이 봐야 1 + 그 외 ≤ 1」
 *   6단계  입력 한 번에 브라우저까지 (사이에 누른 것은 카드뿐)
 *
 * **「클릭」을 사람이 시킨 일로 셉니다.** 화면에서 마우스가 몇 번 눌렸나가
 * 아니라 **일을 몇 번 시켰나**입니다 — 양산 · 답 넣기 · 리소스 놓기 · 화면
 * 붙여넣기 · 실제로 쓰기 · 띄워 보기. 마우스를 세면 접었다 폈다 한 것까지
 * 세어져 숫자가 늘 다르고, 줄이려는 것은 그것이 아닙니다.
 *
 * **세는 자리는 흐름 층 하나입니다.** `ipc/` 에 두면 채널마다 한 줄씩 붙어
 * 얇은 층이 아니게 되고, 도구로 돌릴 때는 안 세어집니다 — 도구도 앱과 같은
 * 서비스를 부르므로 여기서 세면 양쪽이 같은 자로 잽니다.
 *
 * **한 판이 끝나는 자리는 「실제로 쓰기」입니다.** 쓰고 나서 또 손대면 그것은
 * 다음 판이라, 앞 판을 `past` 로 밀어 두고 새로 셉니다. 안 그러면 며칠 뒤에
 * 다시 열어 본 것까지 한 차시의 클릭 수로 쌓입니다.
 *
 * 자리는 답·AI 원문과 **같은 `_recipe`** 입니다. 계획서는 「액티비티 옆
 * `_note.md` 와 같은 자리」라고 적었는데, 그 메모는 2026-09-16 에 걷어냈고
 * 호 저장소 안에 파일을 더 두면 **완성본과의 diff 에 잡힙니다** — 리허설에서
 * 견주는 것이 바로 그 diff 입니다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import type { AiSpent } from '../../../shared/forge'
import path from 'node:path'

/** 사람이 시킨 일 하나. */
export interface RunMark {
  /** 언제 (ISO) */
  at: string
  /** 무엇을 — 양산 · 답 · 리소스 · 화면 · 쓰기 · 띄우기 */
  what: string
  /** 한 줄 덧말. 없어도 된다 */
  note?: string
}

/** 한 판 — 학습코드를 넣고 실제로 쓸 때까지. */
export interface RunPass {
  started: string
  marks: RunMark[]
  /** 마지막 양산에서 아직 안 정해진 카드 수 */
  cards?: number
  /** 그 판에서 AI 를 부른 횟수와 대략 토큰 — 옛 셈(맞추기 바퀴 수 · 글자 수 어림). 새 판은 아래 `spent` 를 본다 */
  calls?: number
  tokens?: number
  /**
   * 그 판에서 **실제로** 부른 것의 합 (2026-09-28, M2) — claude 가 적어 준 토큰 넷 · 값 · 시간.
   * 양산을 여러 번 돌리면 **더한다**(카드 수와 다르다 — 돈은 쌓인다).
   */
  spent?: AiSpent
  /** 실제로 썼나. 이것이 참이면 그 판은 끝난 것이다 */
  wrote?: boolean
  /** 처음 손댄 때부터 마지막까지 (초) */
  seconds?: number
}

export interface RunLog {
  code: string
  now: RunPass
  /** 끝난 판들. 새로 시작할 때 밀어 둔다 */
  past: RunPass[]
}

function fileOf(repoRoot: string, code: string): string {
  return path.join(repoRoot, '_recipe', `${code}.run.json`)
}

export function readRun(repoRoot: string, code: string): RunLog | null {
  const at = fileOf(repoRoot, code)
  if (!fs.existsSync(at)) return null
  try {
    const got = JSON.parse(fs.readFileSync(at, 'utf8')) as RunLog
    if (!got?.now || !Array.isArray(got.now.marks)) return null
    return { code, now: got.now, past: Array.isArray(got.past) ? got.past : [] }
  } catch {
    // 깨졌으면 없는 셈 치고 새로 셉니다. 잴 자가 양산을 막으면 안 됩니다.
    return null
  }
}

function save(repoRoot: string, code: string, log: RunLog): void {
  const at = fileOf(repoRoot, code)
  try {
    fs.mkdirSync(path.dirname(at), { recursive: true })
    fs.writeFileSync(at, JSON.stringify(log, null, 2) + '\n', 'utf8')
  } catch {
    // **재다가 양산을 넘어뜨리지 않습니다.** 못 적으면 그냥 안 적습니다.
  }
}

function blank(code: string): RunLog {
  return { code, now: { started: new Date().toISOString(), marks: [] }, past: [] }
}

/**
 * 사람이 시킨 일 하나를 적는다.
 *
 * 앞 판이 이미 쓰기까지 끝났으면 **새 판을 연다** — 그 뒤의 손길은 다음 판이다.
 */
export function mark(repoRoot: string, code: string, what: string, note?: string): void {
  const log = readRun(repoRoot, code) ?? blank(code)
  if (log.now.wrote) {
    log.past.push(log.now)
    log.now = { started: new Date().toISOString(), marks: [] }
  }
  log.now.marks.push({ at: new Date().toISOString(), what, ...(note ? { note } : {}) })
  log.now.seconds = elapsed(log.now)
  save(repoRoot, code, log)
}

/**
 * 그 판의 셈을 고쳐 적는다 (카드 수 · AI 호출 · 썼나).
 *
 * **더하지 않고 덮어씁니다.** 한 판에서 양산을 두 번 돌리면 뒤엣것이 지금
 * 형편이라, 카드 수를 더하면 「줄었는데 늘어난 것」이 됩니다. AI 호출만은
 * 판 전체의 합이라 부르는 쪽(`auto.ts`)이 합쳐서 줍니다.
 */
export function record(repoRoot: string, code: string, patch: Partial<RunPass>): void {
  const log = readRun(repoRoot, code) ?? blank(code)
  log.now = { ...log.now, ...patch }
  log.now.seconds = elapsed(log.now)
  save(repoRoot, code, log)
}

/** 그 판의 실제 부름에 이번 몫을 더한다. 부른 것이 없으면 안 적는다 — 파일이 괜히 안 바뀌게 */
export function addSpent(repoRoot: string, code: string, s: AiSpent): void {
  if (!s.calls) return
  const log = readRun(repoRoot, code) ?? blank(code)
  const was = log.now.spent
  const sum = { ...s }
  if (was) for (const k of Object.keys(sum) as (keyof AiSpent)[]) sum[k] += was[k] ?? 0
  log.now.spent = sum
  save(repoRoot, code, log)
}

function elapsed(pass: RunPass): number {
  const first = Date.parse(pass.marks[0]?.at ?? pass.started)
  if (!Number.isFinite(first)) return 0
  return Math.max(0, Math.round((Date.now() - first) / 1000))
}

/** 한 줄 요약 — 표에 그대로 넣을 수 있게. */
export function runLine(pass: RunPass): string {
  const what = pass.marks.map((m) => m.what).join(' → ')
  return (
    `손댄 횟수 ${pass.marks.length} (${what || '없음'})` +
    ` · 남은 카드 ${pass.cards ?? '모름'}` +
    (pass.spent
      ? ` · AI ${pass.spent.calls}번 · ${Math.round(pass.spent.ms / 1000)}초 · 새 입력 ${pass.spent.input + pass.spent.cacheWrite} · 캐시 읽기 ${pass.spent.cacheRead} · 출력 ${pass.spent.output} · ${pass.spent.cost.toFixed(2)}`
      : ` · AI ${pass.calls ?? 0}번 (대략 ${(pass.tokens ?? 0).toLocaleString()}토큰)`) +
    ` · ${pass.wrote ? '썼음' : '아직 안 씀'}` +
    ` · ${pass.seconds ?? 0}초`
  )
}
