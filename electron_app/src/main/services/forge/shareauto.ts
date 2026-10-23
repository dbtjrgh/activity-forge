/**
 * **공유 폴더에서 저절로 가져오기 · 넣기** (2026-10-15, 사용자 말 — 2832 를 「음원만 넣으면 돼서」 시험한 뒤
 * 「자동으로 가져올 때 좀 잘 보이게 자동으로 공유 폴더에서 가져왔다 해라」). 찾기 흐름은 `sharefetch.ts`.
 *
 * - **찾기는 기다리지 않는다** — 영상은 수백 MB 라 몇 분 걸린다. 넣기는 뒤에서 돌고, 그동안 찾기는 `copying` 수를 돌려주어
 *   화면이 「가져오는 중」을 보이고 단추를 막는다(처음에는 넣기가 끝날 때까지 「확인하고 있습니다」에 머물렀다 — 2026-10-15 검토)
 * - 저절로 가져오지 않는 때 — 리소스 폴더가 아직 없음(열어 보기만 했는데 폴더가 생기면 안 된다, 함정 문서) · 개발 완료 ·
 *   대화가 도는 중 · **전에 가져온 적 있는 자리**(사람이 지운 것을 또 넣지 않는다, `sharelog.ts`) · 10분 안에 못 넣은 자리
 * - 한 개도 못 넣었으면 「가져왔다」고 하지 않는다 — 까닭은 `autoNote` 로 경고 줄에
 * - 단추(`shareTake`)와 같은 잠금을 쓴다 — 같은 학습코드에 두 넣기가 겹치지 않게
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import type { InboxResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { doneOf } from './chatothers'
import { chatBusy } from './chatstore'
import { finishedAt } from './hallwalk'
import { blank, putAsync } from './rsccopy'
import type { Forge } from './runtime'
import { readLog, takeNote, writeLog } from './sharelog'
import type { Pick } from './sharepick'

/** 넣기 한 번의 상한 — 영상은 수백 MB 라 네트워크로 몇 분 걸릴 수 있다 */
const TAKE_MIN = 10
/** 저절로 넣다 실패한 자리는 이만큼 다시 안 해 본다 — 창이 몇 초마다 찾을 때마다 같은 실패를 되풀이하지 않게 */
const RETRY_MS = 10 * 60_000

/** 사람이 누른 넣기 */
const taking = new Set<string>()
/** 저절로 넣는 중 — 넣을 수 */
const copying = new Map<string, number>()
/** 마지막 저절로 넣기에서 생긴 문제 한 줄 */
const notes = new Map<string, string>()
const failedAt = new Map<string, number>()

export const copyingOf = (code: string): number | undefined => copying.get(code)
export const autoNoteOf = (code: string): string | undefined => notes.get(code) || undefined
/** 넣는 중인가 — 사람이 누른 것이든 저절로든 */
export const busyTaking = (code: string): boolean => taking.has(code) || copying.has(code)

/** 사람이 누른 넣기를 잠그고 돌린다 — 이미 넣는 중이면 그 까닭 */
export async function withTake<T>(code: string, job: () => Promise<T>, busy: (why: string) => T): Promise<T> {
  if (copying.has(code)) return busy('공유 폴더에서 자동으로 가져오는 중입니다. 끝나면 다시 누르세요.')
  if (taking.has(code)) return busy('공유 폴더에서 가져오는 중입니다.')
  taking.add(code)
  try {
    return await job()
  } finally {
    taking.delete(code)
  }
}

/** 넣고 대조하고 남긴다 — 단추와 저절로가 같이 쓴다. 덮어쓰지 않는다(`putAsync`) */
export async function copyIn(repoRoot: string, code: string, dir: string, picks: Pick[], auto: boolean): Promise<InboxResult> {
  const put = blank(dir)
  put.found = picks.length
  await putAsync(
    dir,
    picks.map((p) => ({ from: p.abs, rel: p.name, bytes: p.bytes, to: p.to })),
    put,
    Date.now() + TAKE_MIN * 60_000
  )
  put.note = takeNote(put, picks.length, TAKE_MIN)
  writeLog(repoRoot, code, picks, put.took.map((t) => t.rel), auto)
  return put
}

/** 저절로 가져오면 안 되는 까닭 — 비면 가져온다 */
function autoWhy(forge: Forge, code: string, dir: string): string {
  if (!fs.existsSync(dir)) return '리소스 폴더가 아직 없습니다.'
  if (finishedAt(doneOf(forge, code).act) === true) return '개발 완료한 학습코드입니다.'
  if (chatBusy(code)) return '대화가 도는 중입니다.'
  return ''
}

/** 찾은 것 가운데 저절로 넣을 것을 뒤에서 넣기 시작한다 — 시작했으면 넣을 수, 아니면 0. 찾기는 이것을 기다리지 않는다 */
export function startAuto(forge: Forge, code: string, dir: string, picks: Pick[]): number {
  if (busyTaking(code)) return copying.get(code) ?? 0
  const repoRoot = forge.paths.REPO_ROOT
  const before = readLog(repoRoot, code).files
  const now = Date.now()
  const todo = picks.filter((p) => !before[p.to] && now - (failedAt.get(`${code}|${p.to}`) ?? 0) > RETRY_MS)
  if (!todo.length || autoWhy(forge, code, dir)) return 0
  copying.set(code, todo.length)
  void copyIn(repoRoot, code, dir, todo, true)
    .then((put) => {
      for (const to of [...put.failed.map((f) => f.name), ...put.clash.map((c) => c.rel)]) failedAt.set(`${code}|${to}`, Date.now())
      notes.set(code, put.failed.length || put.clash.length || put.truncated ? `자동으로 가져오다 멈춘 것이 있습니다. ${put.note}` : '')
    })
    .catch((error: unknown) => notes.set(code, `공유 폴더에서 자동으로 가져오지 못했습니다(${toMessage(error)}).`))
    .finally(() => copying.delete(code))
  return todo.length
}
