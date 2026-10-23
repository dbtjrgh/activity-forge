/**
 * **대화로 만들기** — 학습코드 하나를 앱 안의 Claude 한 명이 대화로 만든다 (2026-10-08 사용자 결정 — 「M07 했듯이」).
 *
 * 9-17(AI 가 만들고 도구가 검산) · 9-21(figma 가 기본 입력) 다음 세 번째 뒤집기다. 좁은 물음 수십 개를 걸음으로 잇던 길 대신
 * 8호(M07) 때 사람이 Claude Code 와 대화로 만들던 모습을 앱 안에 그대로 둔다(`_document/자동양산.md` 「틀」 10-08).
 *
 * 1. 앱이 준비한다 — 원본 추천 · 같은 모듈 완성본 · 공용과 돌려 쓰는 파일 복사 · 리소스 표(`chatprep.ts`)
 * 2. Claude 가 호 저장소의 그 학습코드 폴더에 GameData.ts · AssetTable.ts · Activity.ts 를 직접 쓴다(사용자 결정 — git 이 되돌리기)
 * 3. 모르면 묻고 멈춘다. 사람이 글로 답하면 같은 대화를 잇는다(`--resume`). 시작 전에 사람이 남긴 말은 첫 지시에 싣는다(`chatNote`)
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
import { carriedRels } from './carrylog'
import { firstBrief, fixBrief, replyBrief } from './chatbrief'
import { carryFiles } from './chatcarry'
import { blocked } from './chatfinish'
import { startGate } from './chatgate'
import { loreOf } from './chatlore'
import { planSaid, variantSaid } from './chatmodule'
import { pageLines, pagesOf, picsMoved } from './chatpages'
import { diffInputs, inputsOf, prepChat, type ChatCtx } from './chatprep'
import { ctxFor, ctxs, reopened } from './chatresume'
import { reopenBrief } from './chatrules'
import { sceneSaid } from './chatscene'
import { addProgress, askStop, beginLive, blankChat, chatBusy, chatFile, endLive, infoOf, readChat, saveChat, turnOf, type ChatSaved } from './chatstore'
import { runTurns } from './chatturns'
import { plansOf, shotsOf } from './shot'
import { loadForge, type Forge } from './runtime'

/** 들고 있던 대화 준비를 버린다 — 학습코드 초기화(`reset.ts`)가 리소스 폴더째 치운 뒤 */
export function dropChatCtx(code: string): void {
  ctxs.delete(code)
}

export async function chatInfo(code: string): Promise<ChatInfo> {
  const forge = await loadForge()
  return infoOf(readChat(forge.paths.REPO_ROOT, code))
}

/** 새 대화로 시작한다 — 앞 대화는 휴지통으로(같은 학습코드를 처음부터 다시). 남이 끝낸 학습코드는 `force` 일 때만(`chatgate.ts`) */
export async function chatStart(code: string, force = false): Promise<ChatInfo> {
  const forge = await loadForge()
  const root = forge.paths.REPO_ROOT
  if (chatBusy(code)) return infoOf(readChat(root, code))
  // 시작 전에 남긴 말(`chatNote`) — 앞 대화가 있었으면(처음부터 다시) 그 대화의 말은 앞 대화와 같이 버린다
  const prev = readChat(root, code)
  const notes = prev.sessionId ? [] : prev.turns.filter((t) => t.who === 'person')
  const held = await startGate(forge, prev, force)
  if (held) return { ...infoOf(prev), error: held }
  beginLive(code)
  try {
    saveChat(root, { ...blankChat(code), state: 'running', turns: [...notes, turnOf('app', '원본 후보와 리소스를 준비하는 중입니다.')] })
    let ctx: ChatCtx | string
    try {
      ctx = await prepChat(forge, code, (line) => addProgress(root, code, line))
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
      planSaid(ctx),
      `원본으로 ${ctx.origin.code} 학습코드를 추천했습니다.${others ? ` 같은 모듈 완성본 ${others} 도 함께 열어 줍니다.` : ''}`,
      sceneSaid(ctx.scene),
      variantSaid(ctx),
      // 커밋 목록이 든 note 는 첫 지시에만 — 대화 칸에는 개수만(note 는 마침표 없이 커밋 제목으로 끝난다)
      ctx.drift ? `스펙을 맞춘 뒤 ${ctx.module} 모듈에 커밋이 ${ctx.drift.commits.length}개 더 있습니다. Claude 에게 모듈 소스를 같이 보라고 알렸습니다.` : '',
      `figma 화면 ${ctx.shots.length}장, 기획서 ${ctx.plans.length}개를 넘깁니다.`,
      notes.length ? `시작 전에 남긴 말 ${notes.length}개를 첫 지시에 넣었습니다.` : '',
      ctx.carried.length ? `앞 호들이 같이 쓰는 파일 ${ctx.carried.length}개를 리소스 폴더로 가져왔습니다.` : ''
    ].filter(Boolean).join(' ')
    const s = readChat(root, code)
    saveChat(root, { ...s, origin: ctx.origin.code, module: ctx.module, inputs: inputsOf(ctx.rsc), turns: [...s.turns, turnOf('app', said)] })
    void runTurns(forge, ctx, firstBrief(ctx, notes), null)
    return infoOf(readChat(root, code))
  } catch (error) {
    endLive(code)
    return { ...infoOf(readChat(root, code)), error: toMessage(error) }
  }
}

/** 붙인 그림을 리소스 폴더의 `_chat` 에 두고 그 안 경로를 돌려준다 */
function savePics(rsc: string, images: Uint8Array[]): string[] {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '')
  const rels = images.map((_, i) => path.posix.join('_chat', `${stamp}-${i + 1}.png`))
  if (rels.length) fs.mkdirSync(path.join(rsc, '_chat'), { recursive: true })
  images.forEach((b, i) => fs.writeFileSync(path.join(rsc, rels[i] as string), Buffer.from(b)))
  return rels
}

/**
 * **시작 전에 남기는 말** (2026-10-13 사용자 — 「먼저 채팅으로 말도 못 걸고」). Claude 를 부르지 않고 대화에 사람 말로만 남긴다.
 * 「대화로 생성」을 누르면 첫 지시에 실린다(`firstBrief`). 기획서에 없는 값(인터북 어포던스 위치 · 배율 같은 것)을 여기 적는다
 */
function chatNote(forge: Forge, s: ChatSaved, text: string, images: Uint8Array[]): ChatInfo {
  const rsc = forge.files.rscDir(s.code)
  if (!rsc) return { ...infoOf(s), error: '리소스 폴더 자리를 정하지 못했습니다.' }
  const rels = savePics(rsc, images)
  const mine = { ...turnOf('person', text), ...(rels.length ? { images: rels } : {}) }
  return saveChat(forge.paths.REPO_ROOT, { ...s, error: undefined, turns: [...s.turns, mine] })
}

/** 사람의 답 — 붙인 그림은 리소스 폴더의 `_chat` 에 두고 경로를 넘긴다. 대화를 시작하기 전이면 남겨 둔다(`chatNote`) */
export async function chatReply(code: string, text: string, images: Uint8Array[]): Promise<ChatInfo> {
  const forge = await loadForge()
  const root = forge.paths.REPO_ROOT
  const s = readChat(root, code)
  if (chatBusy(code)) return infoOf(s)
  if (!s.sessionId) {
    try {
      return chatNote(forge, s, text, images)
    } catch (error) {
      return { ...infoOf(s), error: toMessage(error) }
    }
  }
  let ctx: ChatCtx | string
  try {
    ctx = ctxFor(forge, code, s)
  } catch (error) {
    ctx = toMessage(error)
  }
  if (typeof ctx === 'string') return { ...infoOf(s), error: ctx }
  beginLive(code)
  try {
    const rels = savePics(ctx.rsc, images)
    // 대화를 시작한 뒤 모듈이나 원본이 바뀌어 폴더를 다시 열었으면 알린다 — Claude 는 첫 지시의 옛 폴더만 안다(9호 MAL3M08W4S1, 2026-10-14).
    // 원본이 바뀌었으면 옛 원본에서 가져온 파일을 치우고 새 원본 것을 가져온다(시작할 때와 같은 차례) · 원본 주의도 새 원본으로 잰다
    const re = reopened(s, ctx)
    const carry = re && s.origin !== ctx.origin.code ? await carryFiles(forge, code, { origin: ctx.origin.code, module: ctx.module, sceneFrom: '' }, ctx.rsc) : null
    if (re) {
      ctx.carried = [...carriedRels(root, code)].sort()
      ctx.lore = loreOf(forge, ctx)
    }
    // 지난 차례 뒤에 사람이 넣은 것 · 바꾼 것 — 이름과 도장으로 가린다
    const files = inputsOf(ctx.rsc)
    const moved = diffInputs(s.inputs, files)
    ctx.shots = shotsOf(ctx.rsc)
    ctx.plans = plansOf(ctx.rsc)
    const n = moved.added.length + moved.changed.length + moved.gone.length
    const told = n
      ? [turnOf('app', `지난 차례 뒤에 새로 들어온 파일 ${moved.added.length}개, 바뀐 파일 ${moved.changed.length}개, 없어진 파일 ${moved.gone.length}개를 함께 알렸습니다.`)]
      : []
    if (re) told.push(turnOf('app', `${ctx.module} 모듈로 읽을 폴더를 다시 열었습니다. 원본은 ${ctx.origin.code} 학습코드입니다.`))
    if (typeof carry === 'string') told.push(turnOf('app', `새 원본에서 파일을 가져오지 못했습니다: ${carry}`))
    const mine = { ...turnOf('person', text), ...(rels.length ? { images: rels } : {}) }
    // 사람이 답할 때마다 고치기 횟수를 새로 센다 — 세 번에 한 번 걸리면 그 뒤로는 검사 결과가 Claude 에게 다시 안 갔다
    saveChat(root, { ...s, state: 'running', questions: [], error: undefined, fixRounds: 0, origin: ctx.origin.code, module: ctx.module, inputs: files, turns: [...s.turns, mine, ...told] })
    // 검사에 막힌 채 사람에게 넘어왔으면 그 결과도 같이 — 세 번째 고치기의 결과 · 못 돌린 까닭은 Claude 가 아직 못 봤다
    const left = s.checks.tsc && blocked(s.checks) ? `\n\n${fixBrief(s.checks, { spec: false, last: true })}` : ''
    const pages = picsMoved([...moved.added, ...moved.changed, ...moved.gone]) ? pageLines(pagesOf(forge, code, ctx.rsc)) : []
    void runTurns(forge, ctx, replyBrief(text, rels, ctx.rsc, moved, ctx.shots, pages) + (re ? `\n\n${reopenBrief(ctx, carry && typeof carry !== 'string' ? carry : null)}` : '') + left, s.sessionId)
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
