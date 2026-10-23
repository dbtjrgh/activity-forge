/**
 * **사내 공유 폴더에서 파일 찾기** — 자리는 `sharerule.ts` 가 셈하고, 여기는 그 자리를 **비동기로** 훑어 파일 목록을 낸다(2026-10-14).
 *
 * - 네트워크 폴더라 **동기로 읽지 않는다** — 서버가 안 닿으면 한 번 읽는 데 수십 초 멈추고, 메인 스레드면 화면 전체가 멈춘다(함정 문서)
 * - **상한** — 한 번 읽기 8초, 한 번 찾기 전체 20초, 파일 3,000개. 걸리면 숨기지 않고 `truncated` · 까닭으로 알린다
 * - 같은 자리는 5분 들고 있는다 — 같은 주차의 다른 소리 이름 · 다시 열기마다 다시 훑지 않게
 * - 닿는지(`reach`)는 훑기 전에 한 번 — 못 닿으면 사용자와 정한 글(`OFFLINE`)을 그대로 보이고 가져오기 단추를 막는다
 * 앞 호 완성본(호 저장소) · 리소스 폴더는 내 디스크라 동기로 읽는다(`localFiles`).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import type { Spot } from './sharerule'

/** 찾은 파일 하나 — `rel` 은 그 자리(세션 폴더 · 호 폴더)에서부터의 길 */
export type Hit = { abs: string; rel: string; bytes: number }

const STEP_MS = 8_000
const LOOK_MS = 20_000
// 국어 한 호 소리 폴더가 1,000~1,600개다 — 다시 쓰는 앞 호가 둘셋이면 3,000 을 넘었다(2026-10-15 검토). 시간 상한이 주 빗장이다
const MAX_FILES = 8_000
const MAX_DEPTH = 6
const KEEP_MS = 5 * 60_000
const MAX_WITHIN = 80 // 한 겹 안을 볼 부모 폴더 수의 상한 — 영어 Level 폴더 하나가 40개 남짓이다

/** 한 번 찾는 동안의 상한 — 넘기면 그만 읽고 `truncated`. `fresh` 면 들고 있던 목록을 안 쓴다(사람이 누름 · 「다시 확인」) */
export type Budget = { until: number; files: number; truncated: boolean; why: string; fresh: boolean }
export const budget = (fresh = false): Budget => ({ until: Date.now() + LOOK_MS, files: 0, truncated: false, why: '', fresh })

/** 자리 하나를 훑은 것 — `complete` 가 거짓이면 다 못 읽었다(상한 · 오류). 거기서 못 찾은 이름은 「없음」이 아니라 「모름」이다 */
export type Listed = { hits: Hit[]; complete: boolean }

const kept = new Map<string, { at: number; hits: Hit[] }>()

/** 다 못 읽었다고 적는다 — 처음 까닭만 남긴다 */
const cut = (b: Budget, why: string): void => {
  b.truncated = true
  if (!b.why) b.why = why
}

/** 시간 안에 끝나면 그 값, 아니면 `null` — 끝나지 않은 읽기는 버려 둔다(취소할 길이 없다) */
async function within<T>(job: Promise<T>, ms: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<null>((done) => (timer = setTimeout(() => done(null), ms)))
  try {
    return await Promise.race([job, late])
  } finally {
    clearTimeout(timer)
  }
}

/** 닿지 않을 때 화면에 그대로 보일 글 — 사용자와 정한 문장(2026-10-14) */
export const OFFLINE = '공유 폴더에 연결할 수 없습니다. 파일 탐색기에서 공유 폴더에 한 번 로그인하거나 설정에서 위치를 정하세요.'

const PORT_MS = 2_000
const STAT_MS = 5_000
const DOWN_KEEP_MS = 3 * 60_000
const UP_KEEP_MS = 60_000
const reached = new Map<string, { at: number; ok: boolean }>()

/** `\\서버\공유\…` 의 서버 — 드라이브 글자 · 내 디스크 경로면 null */
const hostOf = (root: string): string | null => /^[\\/]{2}([^\\/]+)[\\/]/.exec(root)?.[1] ?? null

/** 파일 공유(SMB, 445) 포트가 열리나 — 파일 시스템을 거치지 않아 꺼진 서버에도 2초 안에 끝난다 */
function portOpen(host: string): Promise<boolean> {
  return new Promise((done) => {
    const sock = net.connect({ host, port: 445 })
    const end = (ok: boolean): void => {
      sock.destroy()
      done(ok)
    }
    sock.setTimeout(PORT_MS, () => end(false))
    sock.once('connect', () => end(true))
    sock.once('error', () => end(false))
  })
}

/**
 * 공유 폴더가 닿나 — 비면 닿는다, 아니면 `OFFLINE`.
 * - 서버 주소(`\\서버\…`)면 445 포트부터 묻는다 — 꺼진 서버에 `stat` 을 보내면 Windows 가 포기할 때까지(수십 초) libuv 스레드 하나를
 *   붙잡는다. 그 스레드는 넷뿐이라 받을 리소스 창이 몇 초마다 물으면 앱의 파일 읽기가 통째로 멈춘다(시간 상한은 기다림만 끊는다)
 * - 못 닿은 것은 3분, 닿은 것은 1분 들고 있는다. `fresh` 면(사람이 가져오기를 누름) 다시 묻는다
 * - 서버는 닿는데 로그인 전이면 `stat` 이 바로 거부된다 — 같은 글(탐색기에서 한 번 로그인)이 맞다
 */
export async function reach(root: string, fresh = false): Promise<string> {
  const hit = reached.get(root)
  if (!fresh && hit && Date.now() - hit.at < (hit.ok ? UP_KEEP_MS : DOWN_KEEP_MS)) return hit.ok ? '' : OFFLINE
  const host = hostOf(root)
  const port = host ? await portOpen(host) : true
  const ok = port && (await within(fsp.stat(root).then((s) => s.isDirectory()).catch(() => false), STAT_MS)) === true
  reached.set(root, { at: Date.now(), ok })
  return ok ? '' : OFFLINE
}

async function dirents(dir: string, b: Budget): Promise<fs.Dirent[] | null> {
  if (Date.now() > b.until) {
    cut(b, `공유 폴더 확인이 ${LOOK_MS / 1000}초를 넘어 멈췄습니다.`)
    return null
  }
  // 없는 폴더(ENOENT · ENOTDIR)만 빈 것이다 — 권한 · 네트워크 오류는 「다 못 읽음」이다. 모르는 것을 「없음」으로 들고 있지 않게(2026-10-15 검토)
  const read = fsp.readdir(dir, { withFileTypes: true }).then(
    (list) => list,
    (e: NodeJS.ErrnoException) => (e.code === 'ENOENT' || e.code === 'ENOTDIR' ? ([] as fs.Dirent[]) : e)
  )
  const got = await within(read, STEP_MS)
  if (got === null) cut(b, `공유 폴더에서 ${path.basename(dir)} 폴더를 ${STEP_MS / 1000}초 안에 읽지 못했습니다.`)
  else if (got instanceof Error) cut(b, `공유 폴더에서 ${path.basename(dir)} 폴더를 읽지 못했습니다(${(got as NodeJS.ErrnoException).code ?? got.message}).`)
  else return got
  return null
}

async function walk(root: string, rel: string, depth: number, b: Budget, out: Hit[], skip?: RegExp): Promise<void> {
  const list = (await dirents(path.join(root, rel), b)) ?? []
  const at = (e: fs.Dirent): string => (rel ? `${rel}/${e.name}` : e.name)
  let files = list.filter((e) => e.isFile()).map(at)
  if (b.files + files.length > MAX_FILES) {
    cut(b, `공유 폴더에서 한 번에 ${MAX_FILES.toLocaleString()}개까지만 확인합니다.`)
    files = files.slice(0, Math.max(0, MAX_FILES - b.files))
  }
  b.files += files.length
  // 크기는 한 폴더씩 한꺼번에 묻는다 — 파일마다 차례로 물으면 네트워크 왕복이 그 수만큼 쌓인다
  const sizes = await within(Promise.all(files.map((r) => fsp.stat(path.join(root, r)).then((s) => s.size).catch(() => -1))), STEP_MS)
  if (sizes === null) {
    // 늦은 링크에서 크기를 못 받으면 그 폴더 파일이 말없이 다 빠졌고 빈 목록이 5분 남았다(2026-10-15 검토) — 다 못 읽은 것으로 한다
    cut(b, `공유 폴더에서 ${path.basename(path.join(root, rel)) || '세션'} 폴더의 파일 크기를 ${STEP_MS / 1000}초 안에 읽지 못했습니다.`)
    return
  }
  files.forEach((r, i) => {
    const bytes = sizes?.[i] ?? -1
    if (bytes >= 0) out.push({ abs: path.join(root, r), rel: r, bytes })
  })
  if (depth >= MAX_DEPTH) return
  for (const e of list.filter((d) => d.isDirectory() && !skip?.test(d.name))) await walk(root, at(e), depth + 1, b, out, skip)
}

/** 훑을 폴더들 — `pick` 이 없으면 `base`, 있으면 그 이름의 폴더들(`within` 이면 그 겹만큼 안). 한 겹의 부모가 상한을 넘으면 이 자리만 「다 못 읽음」(전체를 끊으면 뒤 자리까지 비었다, 2026-10-16) */
async function rootsOf(spot: Spot, b: Budget): Promise<{ roots: string[]; partial: boolean }> {
  if (!spot.pick) return { roots: [spot.base], partial: false }
  const levels = [...[spot.within ?? []].flat(), spot.pick]
  let dirs = [spot.base]
  let partial = false
  for (const [i, re] of levels.entries()) {
    const next: string[] = []
    for (const d of dirs) next.push(...((await dirents(d, b)) ?? []).filter((e) => e.isDirectory() && re.test(e.name)).map((e) => path.join(d, e.name)))
    const last = i === levels.length - 1
    partial ||= !last && next.length > MAX_WITHIN
    dirs = last ? next : next.slice(0, MAX_WITHIN)
  }
  if (partial && !b.why) b.why = `공유 폴더에서 하위 폴더는 ${MAX_WITHIN}개까지만 확인합니다.`
  return { roots: dirs, partial }
}

/**
 * 자리 하나의 파일 전부 — `pick` 이면 그 이름의 폴더들 아래를 합친다. 자리가 없으면 빈 목록(다 읽음). 들고 있는 열쇠는 `within` 의 겹마다 갈린다.
 * 이번 찾기가 이미 상한에 걸렸으면 더 읽지 않고 「다 못 읽음」을 돌려준다 — 안 본 자리를 「없음」으로 세지 않게
 */
export async function filesAt(spot: Spot, b: Budget): Promise<Listed> {
  const key = [spot.base, spot.pick?.source, [spot.within ?? []].flat().map((r) => r.source).join('>'), spot.skip?.source].join('|')
  const hit = kept.get(key)
  if (!b.fresh && hit && Date.now() - hit.at < KEEP_MS) return { hits: hit.hits, complete: true }
  if (b.truncated) return { hits: [], complete: false }
  const hits: Hit[] = []
  const { roots, partial } = await rootsOf(spot, b)
  for (const root of roots) await walk(root, '', 0, b, hits, spot.skip)
  // 상한 · 오류에 걸린 목록은 들고 있지 않는다 — 다음에 다시 훑게
  const complete = !b.truncated && !partial
  if (complete) kept.set(key, { at: Date.now(), hits })
  return { hits, complete }
}

/** 내 디스크 폴더의 파일 전부(앞 호 완성본 · 리소스 폴더) — 없으면 빈 목록 */
export function localFiles(root: string): Hit[] {
  const out: Hit[] = []
  const stack = ['']
  while (stack.length && out.length < MAX_FILES) {
    const rel = stack.pop() as string
    let list: fs.Dirent[]
    try {
      list = fs.readdirSync(path.join(root, rel), { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of list) {
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) stack.push(r)
      else if (e.isFile()) {
        try {
          out.push({ abs: path.join(root, r), rel: r, bytes: fs.statSync(path.join(root, r)).size })
        } catch {
          // 못 읽는 파일은 없는 셈
        }
      }
    }
  }
  return out
}
