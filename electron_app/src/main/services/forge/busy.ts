/**
 * **끄거나 다시 켜면 안 되는 일** (2026-10-14) — 도는 대화(`chatstore.ts` `busyChats`)와 「main 에 모두 올리기」(`hallsyncall.ts`).
 *
 * 끌 때 묻기(`index.ts`) · 업데이트 뒤 다시 켜기(`update.ts` · `ipc/forge.ts`)가 같이 본다.
 * 처음에는 대화만 봐서, 올리기 도중(받기 · 합치기 · 커밋 · 푸시) 창을 닫거나 업데이트로 다시 켜면 git 이 중간에 끊길 수 있었다 —
 * 충돌 뒤 `merge --abort` 전에 끊기면 호 저장소에 MERGE_HEAD 가 남는다.
 * 회귀 검사(`regress.ts`, 2026-10-15)는 끊겨도 남는 흠은 없지만 몇 분 돈 결과를 잃으니 같이 묻는다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { busyChats } from './chatstore'
import { syncBusy } from './hallsyncall'
import { regressBusy } from './regress'
import { setupBusy } from './setup'

/** 하던 일 이름들 — 대화는 학습코드, 올리기 · 회귀 검사 · 초기 설정(2026-10-16, 양산기 받기 · 호마다 yarn)은 그 단추 · 화면 이름 */
export function busyWork(): string[] {
  return [
    ...busyChats(),
    ...(syncBusy() ? ['main 에 모두 올리기'] : []),
    ...(regressBusy() ? ['모듈 회귀 검사'] : []),
    ...(setupBusy() ? ['초기 설정'] : [])
  ]
}
