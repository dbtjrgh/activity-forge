/**
 * **대화 앞뒤에 사람이 지나는 문** (2026-10-14) — 새로 시작하기 전 빗장과 「확인할 것」을 확인했다는 표시. `chat.ts` 가 200줄을 넘어 여기 둔다.
 *
 * - **남이 끝낸 학습코드**(`owner.ts`)는 `force`(작업대 「그래도 고치기」) 없이는 시작하지 않는다 — 대화는 Claude 가 호 저장소의
 *   그 폴더를 직접 고친다. 그전에는 지난 호 완성본을 열어 「대화로 생성」을 누르면 남이 끝낸 것을 덮을 수 있었다
 * - **앞 대화 기록은 휴지통으로** 옮긴 뒤 새로 쓴다 — 「처음부터 다시 만들기」가 앞 대화(질문과 답 · 확인할 것)를 그냥 덮어 되돌릴 길이 없었다.
 *   「대화 기록 지우기」(`chatClear`)와 같은 길이다. 못 옮기면 시작하지 않는다
 * - 「확인했습니다」 — 검수 단추 위의 목록을 봤다는 표시(`lookSeenAt`). 막는 검사가 아니라 한 번 누르기다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import type { ChatInfo } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { toTrash } from '../../lib/trash'
import { chatFile, infoOf, readChat, saveChat, type ChatSaved } from './chatstore'
import { ownerLine, ownerOf } from './owner'
import { loadForge, type Forge } from './runtime'

/** 시작해도 되나 — 비면 된다. 앞 기록은 여기서 휴지통으로 옮긴다. `prev` 는 덮기 전에 읽은 앞 대화 */
export async function startGate(forge: Forge, prev: ChatSaved, force: boolean): Promise<string> {
  const o = ownerOf(forge, prev.code)
  if (o.theirs && !force) return `${ownerLine(o)} 고치려면 「그래도 고치기」를 누른 뒤 다시 누르세요.`
  const file = chatFile(forge.paths.REPO_ROOT, prev.code)
  // 빈 기록(처음 · 지운 뒤)은 잃을 것이 없다
  if (!fs.existsSync(file) || (!prev.sessionId && prev.turns.length === 0)) return ''
  try {
    await toTrash(file)
    return ''
  } catch (error) {
    return `앞 대화 기록을 휴지통으로 옮기지 못해 시작하지 않았습니다. ${toMessage(error)}`
  }
}

/** 「확인할 것」을 봤다 — 다 만든 대화에서만 남긴다(도는 중에 남기면 차례가 덮는다) */
export async function chatLookSeen(code: string): Promise<ChatInfo> {
  const forge = await loadForge()
  const root = forge.paths.REPO_ROOT
  const s = readChat(root, code)
  if (s.state !== 'done' || !s.look?.length) return infoOf(s)
  return saveChat(root, { ...s, lookSeenAt: new Date().toISOString() })
}
