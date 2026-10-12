/**
 * **대화의 형편을 남기고 화면에 민다** (2026-10-08, `chat.ts`).
 *
 * - 남기는 자리는 `_recipe/<코드>.chat.json` — 사람 답이 들어 있어 저장소에 안 올린다(`_recipe` 규칙). 앱을 다시 켜도 대화가 이어진다(`--resume`)
 * - 도는 동안의 진행 줄(`progress`) · 시작 시각 · 멈춤 요청은 메모리에만 둔다
 * - 화면에 미는 길은 IPC 층이 꽂아 준다(`onChat`) — services 는 Electron 을 모른다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ChatInfo, ChatTurn } from '../../../shared/forge'

/** 화면에 보일 진행 줄 상한 */
const PROGRESS_MAX = 200

/**
 * 화면에 안 보내는 것 —
 * `inputs` Claude 에게 마지막으로 알린 때의 리소스 폴더 파일(`이름|도장`, figma · 기획서 포함 — `chatprep.ts` `inputsOf`).
 * 옛 대화는 이름만 들었다.
 * `origin` 대화를 시작할 때 정한 원본 — 그 뒤 원본이 바뀌면 같은 대화로 잇지 않는다
 */
type Saved = Omit<ChatInfo, 'progress' | 'since' | 'rev'> & { fixRounds: number; inputs?: string[]; origin?: string }

const live = new Map<string, { progress: string[]; since: number | null; stop: boolean }>()
let push: (info: ChatInfo) => void = () => {}
let rev = 0

/** IPC 층이 화면으로 미는 길을 꽂는다 */
export function onChat(fn: (info: ChatInfo) => void): void {
  push = fn
}

export const chatFile = (repoRoot: string, code: string): string => path.join(repoRoot, '_recipe', `${code}.chat.json`)

export function blankChat(code: string): Saved {
  return { code, state: 'idle', sessionId: null, turns: [], questions: [], checks: { tsc: null, spec: null, files: null }, cost: 0, fixRounds: 0 }
}

export const turnOf = (who: ChatTurn['who'], text: string): ChatTurn => ({ who, text, at: new Date().toISOString() })

export function readChat(repoRoot: string, code: string): Saved {
  try {
    const s = JSON.parse(fs.readFileSync(chatFile(repoRoot, code), 'utf8')) as Saved
    // 도는 중으로 남았는데 이 앱에서 도는 것이 없다 — 앱을 껐다 켰다. 멈춘 것으로 본다
    if ((s.state === 'running' || s.state === 'checking') && !chatBusy(code)) return { ...s, state: 'stopped' }
    return s
  } catch {
    return blankChat(code)
  }
}

export function infoOf(s: Saved): ChatInfo {
  const l = live.get(s.code)
  const { fixRounds: _f, inputs: _i, origin: _o, ...rest } = s
  return { ...rest, progress: l?.progress ?? [], since: l?.since ?? null, rev }
}

/** 남기고 화면에 민다 */
export function saveChat(repoRoot: string, s: Saved): ChatInfo {
  fs.mkdirSync(path.dirname(chatFile(repoRoot, s.code)), { recursive: true })
  fs.writeFileSync(chatFile(repoRoot, s.code), JSON.stringify(s, null, 1) + '\n')
  rev += 1
  const info = infoOf(s)
  push(info)
  return info
}

/**
 * 이 앱에서 그 학습코드의 대화가 도는 중인가(준비 · 부르는 중 · 검사 중).
 * 「끝나지 않은 대화가 있나」(`chatOpen`)는 그것을 쓰던 차례 줄과 같이 2026-10-08 에 걷었다 — 같은 가름은 `shared/forge/chat.ts` `chatWaiting`
 */
export const chatBusy = (code: string): boolean => (live.get(code)?.since ?? null) !== null

export function beginLive(code: string): void {
  live.set(code, { progress: [], since: Date.now(), stop: false })
}

export function endLive(code: string): void {
  const l = live.get(code)
  if (l) {
    l.since = null
    l.stop = false
  }
}

/** 멈춰 달라는 요청 — 도는 claude 가 없는 때(준비 · 검사 중)에 눌러도 다음 차례 앞에서 멈춘다 */
export function askStop(code: string): void {
  const l = live.get(code)
  if (l && l.since !== null) l.stop = true
}

export const stopWanted = (code: string): boolean => live.get(code)?.stop === true

/** 진행 줄은 이만큼 모아 한 번에 민다 — 줄마다 대화 전체를 모든 창에 보내면 메인 스레드가 붙잡힌다 */
const PROGRESS_EVERY = 250
const pending = new Map<string, ReturnType<typeof setTimeout>>()

/** 진행 한 줄 — 남기지 않고 화면에만. 바로 앞 줄과 같으면 안 붙인다(같은 그림을 다섯 번 연 「읽음」) */
export function addProgress(repoRoot: string, code: string, line: string): void {
  if (!line) return
  const l = live.get(code) ?? { progress: [], since: null, stop: false }
  if (l.progress[l.progress.length - 1] === line) return
  l.progress = [...l.progress, line].slice(-PROGRESS_MAX)
  live.set(code, l)
  if (pending.has(code)) return
  pending.set(
    code,
    setTimeout(() => {
      pending.delete(code)
      rev += 1
      push(infoOf(readChat(repoRoot, code)))
    }, PROGRESS_EVERY)
  )
}

export type { Saved as ChatSaved }
