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
import { chatWaiting, type ChatInfo, type ChatTurn } from '../../../shared/forge'
import { lookFromTurns } from './chatlook'

/** 화면에 보일 진행 줄 상한 */
const PROGRESS_MAX = 200

/**
 * 화면에 안 보내는 것 —
 * `inputs` Claude 에게 마지막으로 알린 때의 리소스 폴더 파일(`이름|도장`, figma · 기획서 포함 — `chatprep.ts` `inputsOf`).
 * 옛 대화는 이름만 들었다.
 * `origin` 대화를 시작할 때 정한 원본 — 그 뒤 원본이 바뀌면 같은 대화로 잇지 않는다
 * `module` 그때의 모듈 — 대화 도중 배치표 모듈이 바뀌면 읽을 폴더를 다시 열고 알린다(`chatresume.ts`). 옛 대화에는 없다
 */
type Saved = Omit<ChatInfo, 'progress' | 'since' | 'rev'> & { fixRounds: number; inputs?: string[]; origin?: string; module?: string }

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
    // 「확인할 것」을 따로 남기기 전(2026-10-14)에 끝난 대화 — 마지막 완료 글에서 다시 뽑는다(`chatlook.ts`)
    if (s.state === 'done' && s.look === undefined) return { ...s, look: lookFromTurns(s.turns ?? []) }
    return s
  } catch {
    return blankChat(code)
  }
}

export function infoOf(s: Saved): ChatInfo {
  const l = live.get(s.code)
  const { fixRounds: _f, inputs: _i, origin: _o, module: _m, ...rest } = s
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

/** 이 앱에서 대화가 도는 학습코드 전부 — 끄기 · 업데이트 뒤 다시 켜기 전에 본다(`busy.ts`) */
export const busyChats = (): string[] => [...live.keys()].filter(chatBusy).sort()

/**
 * 그 학습코드의 대화를 건드리면 안 되는 형편 — 도는 중(`busy`) · 답을 기다림(`waiting`) · 아님(빈 글).
 * 리소스 폴더 정리(`rscclean.ts`)와 「main 에 모두 올리기」(`hallsyncall.ts`)가 같은 셈을 쓴다 — 두 곳에 따로 있었다(2026-10-14).
 * 파일에 「도는 중」으로 남았는데 이 앱에서 안 도는 것은 `readChat` 이 「멈춤」으로 읽는다 — 그것도 기다리는 대화다
 */
export function chatHold(repoRoot: string, code: string): 'busy' | 'waiting' | '' {
  if (chatBusy(code)) return 'busy'
  return chatWaiting(infoOf(readChat(repoRoot, code))) ? 'waiting' : ''
}

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

/** 대화 기록 파일을 치운 뒤(학습코드 초기화) — 진행 줄을 버리고 지금 파일 형편을 화면에 민다. 파일은 새로 안 쓴다 */
export function forgetChat(repoRoot: string, code: string): void {
  live.delete(code)
  rev += 1
  push(infoOf(readChat(repoRoot, code)))
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
