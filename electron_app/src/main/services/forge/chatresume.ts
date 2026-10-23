/**
 * **이을 대화의 폴더들** — `chat.ts` 에서 뗐다(2026-10-14, 200줄을 넘어).
 *
 * 이 앱에서 시작했으면 들고 있는 것, 앱을 다시 켰으면 **파일을 안 건드리고** 경로만 다시 모은다(`ctxOf`).
 * - 사람이 원본을 바꿨으면 잇지 않는다 — Claude 는 옛 원본에서 출발해 이미 썼다
 * - 앱이 저절로 고른 원본이 바뀐 것이면 시작한 원본으로 잇는다(2026-10-13)
 * - **모듈이 바뀌었으면 새 모듈 완성본에서 고른 원본으로 간다** — 옛 모듈 원본에 새 모듈을 섞지 않는다(2026-10-14)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { oneModule } from '../../../shared/forge'
import { ctxOf, type ChatCtx } from './chatprep'
import type { OriginPick } from './chatscene'
import type { ChatSaved } from './chatstore'
import { cellCode } from './hallwalk'
import { originNow, pinnedHere } from './originpick'
import type { Forge } from './runtime'

// 이전 방식(「생성」 · 차례 줄)이 같은 학습코드를 도는 중이면 막던 검사는 걷었다 (2026-10-08) — 그 길이 앱에 없다
export const ctxs = new Map<string, ChatCtx>()

/**
 * 그 완성본이 실제로 쓰는 모듈 — 호 저장소를 훑은 칸(`scanCells`). 못 찾으면 빈 글.
 * 배치표 짐작으로 보면 지난 호 칸이 틀린다(832칸 중 254칸, 2026-10-14 함정) — 그러면 멀쩡한 원본을 「모듈이 바뀌었다」로 버린다
 */
function madeModule(forge: Forge, code: string): string {
  const subject = code.slice(0, 2)
  const cell = forge.layout.scanCells(subject).find((c) => cellCode(subject, c) === code)
  return cell ? oneModule(cell.module) : ''
}

export function ctxFor(forge: Forge, code: string, s: ChatSaved): ChatCtx | string {
  const now = originNow(forge, code)
  if (typeof now === 'string') return now
  const cached = ctxs.get(code)
  const was = s.origin ?? cached?.origin.code
  let pick: OriginPick = now
  if (was && was !== now.origin) {
    // 대화를 시작한 모듈 — 옛 대화 기록에는 없어 그 원본이 실제로 쓰는 모듈로 본다
    const started = s.module ?? cached?.module ?? madeModule(forge, was)
    // 모듈이 바뀌었으면(기획서와 배치표가 달라 사람이 배치표를 고침) 옛 모듈 원본으로 잇지 않는다 — 9호 MAL3M08W4S1 은
    // 배치표를 M30_3 으로 고친 뒤에도 M30 원본(MAL3M06W4S1)에 M30_3 모듈을 섞어 이을 뻔했다. 적어 둔 원본은 모듈을 바꿀 때 같이 지워진다
    if (!started || started === now.module) {
      // 사람이 원본을 바꿨으면(배치표에 적음) 잇지 않는다. 앱이 저절로 고른 원본(그림 크기 맞추기 · 배경)이 리소스를 더 넣어 바뀐 것이면
      // 대화를 시작한 원본으로 잇는다 — 9호 MAL2M08W1S1 에 별 없는 판 7장을 넣자 크기 맞추기가 MAL2M06W1S1 로 바뀌어 답을 못 보냈다(2026-10-13)
      if (pinnedHere(forge, code)) return `대화를 시작한 뒤 원본이 바뀌었습니다(${was} → ${now.origin}). 「처음부터 다시 만들기」로 새 대화를 시작하세요.`
      pick = { origin: was, module: now.module, sceneFrom: '' }
    }
  }
  // 모듈이 바뀌었으면(대화가 기획서와 배치표가 다르다고 물어 사람이 배치표를 고침) 다시 모은다 — 모듈 소스 · 같은 모듈 완성본 · 스펙 폴더가
  // 옛 모듈 것으로 남아, 9호 MAL3M08W2S1 이 M30_3 으로 정한 뒤에도 M30_3 폴더를 못 읽었다(2026-10-14)
  if (cached && cached.origin.code === pick.origin && cached.module === pick.module) return cached
  const ctx = ctxOf(forge, code, pick)
  if (typeof ctx !== 'string') ctxs.set(code, ctx)
  return ctx
}

/** 대화를 시작한 뒤 원본이나 모듈이 바뀌어 폴더를 다시 열었나 — 그때만 사람과 Claude 에게 알린다(옛 기록에 모듈이 없으면 원본만 본다) */
export function reopened(s: ChatSaved, ctx: ChatCtx): boolean {
  return Boolean(s.origin) && (s.origin !== ctx.origin.code || Boolean(s.module && s.module !== ctx.module))
}
