/**
 * **대화로 만들기** — 학습코드 하나를 앱 안의 Claude 한 명이 대화로 만든다 (2026-10-08 사용자 결정 — 「M07 했듯이」).
 *
 * 9-17(AI 가 만들고 도구가 검산) · 9-21(figma 가 기본 입력) 다음 세 번째 뒤집기다. 좁은 물음 수십 개를 걸음으로 잇던 길 대신
 * 8호(M07) 때 사람이 Claude Code 와 대화로 만들던 모습을 앱 안에 그대로 둔다(`_document/자동양산.md` 「틀」 10-08).
 *
 * 1. 앱이 준비한다 — 원본 추천 · 같은 모듈 완성본 · 공용과 돌려 쓰는 파일 복사 · 리소스 표(`chatprep.ts`)
 * 2. Claude 가 호 저장소의 그 학습코드 폴더에 GameData.ts · AssetTable.ts · Activity.ts 를 직접 쓴다(사용자 결정 — git 이 되돌리기)
 * 3. 모르면 묻고 멈춘다. 사람이 글로 답하면 같은 대화를 잇는다(`--resume`)
 * 4. 다 했다고 하면 앱이 리소스를 복사하고 타입 검사를 돌린다(`chatfinish.ts`). 막히면 그 결과를 주고 세 번까지 다시 맡긴다(`chatturns.ts`)
 *
 * 검수 완료 · 양산 완료 커밋은 지금처럼 사람이 단추로 한다. Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ChatInfo } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { toTrash } from '../../lib/trash'
import { stopSession } from './aisession'
import { firstBrief, fixBrief, replyBrief } from './chatbrief'
import { blocked } from './chatfinish'
import { ctxOf, diffInputs, inputsOf, prepChat, type ChatCtx } from './chatprep'
import { addProgress, askStop, beginLive, blankChat, chatBusy, chatFile, endLive, infoOf, readChat, saveChat, turnOf, type ChatSaved } from './chatstore'
import { runTurns } from './chatturns'
import { originNow } from './originpick'
import { plansOf, shotsOf } from './shot'
import { loadForge, type Forge } from './runtime'

// 이전 방식(「생성」 · 차례 줄)이 같은 학습코드를 도는 중이면 막던 검사는 걷었다 (2026-10-08) — 그 길이 앱에 없다
const ctxs = new Map<string, ChatCtx>()

export async function chatInfo(code: string): Promise<ChatInfo> {
  const forge = await loadForge()
  return infoOf(readChat(forge.paths.REPO_ROOT, code))
}

/** 새 대화로 시작한다 — 앞 대화는 버린다(같은 학습코드를 처음부터 다시) */
export async function chatStart(code: string): Promise<ChatInfo> {
  const forge = await loadForge()
  const root = forge.paths.REPO_ROOT
  if (chatBusy(code)) return infoOf(readChat(root, code))
  beginLive(code)
  try {
    saveChat(root, { ...blankChat(code), state: 'running', turns: [turnOf('app', '원본 후보와 리소스를 준비하는 중입니다.')] })
    let ctx: ChatCtx | string
    try {
      ctx = await prepChat(forge, code)
    } catch (error) {
      ctx = toMessage(error)
    }
    if (typeof ctx === 'string') {
      endLive(code)
      // AI 를 부르기 전에 멈췄다 — 쓴 파일이 없으니 시작 전(idle)으로 둔다. 검수 완료를 막지 않는다
      return saveChat(root, { ...blankChat(code), error: ctx, turns: [...readChat(root, code).turns, turnOf('app', ctx)] })
    }
    ctxs.set(code, ctx)
    const others = ctx.others.map((o) => o.code).join(', ')
    const said = [
      `원본으로 ${ctx.origin.code} 학습코드를 추천했습니다.${others ? ` 같은 모듈 완성본 ${others} 도 함께 열어 줍니다.` : ''}`,
      `figma 화면 ${ctx.shots.length}장, 기획서 ${ctx.plans.length}개를 넘깁니다.`,
      ctx.carried.length ? `앞 호들이 같이 쓰는 파일 ${ctx.carried.length}개를 리소스 폴더로 가져왔습니다.` : ''
    ].filter(Boolean).join(' ')
    const s = readChat(root, code)
    saveChat(root, { ...s, origin: ctx.origin.code, inputs: inputsOf(ctx.rsc), turns: [...s.turns, turnOf('app', said)] })
    void runTurns(forge, ctx, firstBrief(ctx), null)
    return infoOf(readChat(root, code))
  } catch (error) {
    endLive(code)
    return { ...infoOf(readChat(root, code)), error: toMessage(error) }
  }
}

/**
 * 이을 대화의 폴더들 — 이 앱에서 시작했으면 그것, 앱을 다시 켰으면 **파일을 안 건드리고** 경로만 다시 모은다(`ctxOf`).
 * 대화를 시작한 뒤 원본이 바뀌었으면 잇지 않는다 — Claude 는 옛 원본에서 출발해 이미 썼다
 */
function ctxFor(forge: Forge, code: string, s: ChatSaved): ChatCtx | string {
  const now = originNow(forge, code)
  if (typeof now === 'string') return now
  const cached = ctxs.get(code)
  const was = s.origin ?? cached?.origin.code
  if (was && was !== now.origin) return `대화를 시작한 뒤 원본이 바뀌었습니다(${was} → ${now.origin}). 「처음부터 다시 만들기」로 새 대화를 시작하세요.`
  if (cached) return cached
  const ctx = ctxOf(forge, code, now.origin, now.module)
  if (typeof ctx !== 'string') ctxs.set(code, ctx)
  return ctx
}

/** 사람의 답 — 붙인 그림은 리소스 폴더의 `_chat` 에 두고 경로를 넘긴다 */
export async function chatReply(code: string, text: string, images: Uint8Array[]): Promise<ChatInfo> {
  const forge = await loadForge()
  const root = forge.paths.REPO_ROOT
  const s = readChat(root, code)
  if (chatBusy(code)) return infoOf(s)
  if (!s.sessionId) return { ...infoOf(s), error: '이어 갈 대화가 없습니다. 「대화로 생성」을 먼저 누르세요.' }
  let ctx: ChatCtx | string
  try {
    ctx = ctxFor(forge, code, s)
  } catch (error) {
    ctx = toMessage(error)
  }
  if (typeof ctx === 'string') return { ...infoOf(s), error: ctx }
  beginLive(code)
  try {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '')
    const rels = images.map((_, i) => path.posix.join('_chat', `${stamp}-${i + 1}.png`))
    if (rels.length) fs.mkdirSync(path.join(ctx.rsc, '_chat'), { recursive: true })
    images.forEach((b, i) => fs.writeFileSync(path.join(ctx.rsc, rels[i] as string), Buffer.from(b)))
    // 지난 차례 뒤에 사람이 넣은 것 · 바꾼 것 — 이름과 도장으로 가린다
    const files = inputsOf(ctx.rsc)
    const moved = diffInputs(s.inputs, files)
    ctx.shots = shotsOf(ctx.rsc)
    ctx.plans = plansOf(ctx.rsc)
    const n = moved.added.length + moved.changed.length + moved.gone.length
    const told = n
      ? [turnOf('app', `지난 차례 뒤에 새로 들어온 파일 ${moved.added.length}개, 바뀐 파일 ${moved.changed.length}개, 없어진 파일 ${moved.gone.length}개를 함께 알렸습니다.`)]
      : []
    const mine = { ...turnOf('person', text), ...(rels.length ? { images: rels } : {}) }
    // 사람이 답할 때마다 고치기 횟수를 새로 센다 — 세 번에 한 번 걸리면 그 뒤로는 검사 결과가 Claude 에게 다시 안 갔다
    saveChat(root, { ...s, state: 'running', questions: [], error: undefined, fixRounds: 0, origin: ctx.origin.code, inputs: files, turns: [...s.turns, mine, ...told] })
    // 검사에 막힌 채 사람에게 넘어왔으면 그 결과도 같이 — 세 번째 고치기의 결과 · 못 돌린 까닭은 Claude 가 아직 못 봤다
    const left = s.checks.tsc && blocked(s.checks) ? `\n\n${fixBrief(s.checks, { spec: false, last: true })}` : ''
    void runTurns(forge, ctx, replyBrief(text, rels, ctx.rsc, moved, ctx.shots) + left, s.sessionId)
    return infoOf(readChat(root, code))
  } catch (error) {
    endLive(code)
    return { ...infoOf(readChat(root, code)), error: toMessage(error) }
  }
}

/** 멈추기 — 도는 claude 는 바로 내리고, 준비 · 검사 중이면 그것이 끝나는 대로 멈춘다 */
export async function chatStop(code: string): Promise<ChatInfo> {
  askStop(code)
  const killed = stopSession(code)
  const forge = await loadForge()
  if (!killed && chatBusy(code)) addProgress(forge.paths.REPO_ROOT, code, '지금 하는 검사가 끝나는 대로 멈춥니다.')
  return chatInfo(code)
}

/**
 * 대화 기록을 휴지통으로 — 시작 전으로 돌린다. **호 저장소에 쓴 파일은 그대로 둔다**(git 으로 본다).
 * 대화를 버리고 손으로 마쳤을 때 검수 완료 · 커밋을 다시 열어 준다 — 「처음부터 다시 만들기」는 Claude 를 또 부른다
 */
export async function chatClear(code: string): Promise<ChatInfo> {
  const forge = await loadForge()
  const root = forge.paths.REPO_ROOT
  if (chatBusy(code)) return { ...infoOf(readChat(root, code)), error: '대화가 도는 중에는 지울 수 없습니다. 멈춘 뒤 다시 누르세요.' }
  try {
    if (fs.existsSync(chatFile(root, code))) await toTrash(chatFile(root, code))
  } catch (error) {
    return { ...infoOf(readChat(root, code)), error: toMessage(error) }
  }
  ctxs.delete(code)
  return saveChat(root, blankChat(code))
}
