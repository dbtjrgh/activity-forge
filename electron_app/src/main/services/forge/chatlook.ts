/**
 * **「미리보기에서 확인할 것」** — Claude 가 끝 보고(done 덩어리의 `check`)에 적은 목록. 글 꼴과 다시 뽑기를 여기 한 곳에 둔다 (2026-10-14).
 *
 * 처음에는 완료 글 끝에만 붙였다 — 오른쪽 대화 맨 아래라 검수 완료를 누르는 자리에서는 안 보였다.
 * 이제 `chat.json` 에 `look` 으로 따로 남기고 검수 단추 바로 위에 보인다(사용자 결정). 그 전에 끝난 대화는 `look` 이 없다 —
 * 마지막 완료 글에서 다시 뽑는다(`readChat`). 완료 글 꼴은 두 가지였다 —
 *   - 2026-10-08 이후 `**미리보기에서 확인할 것**` 제목 아래 `- ` 한 줄씩(MAL1M08W2S1)
 *   - 그 전 `미리보기에서 확인할 것: 가 / 나 / 다` 한 줄(KOL2M08W2S3)
 *
 * 양산을 모르는 글 셈만 한다 — 남기고 읽는 것은 `chatstore.ts`. Electron 을 import 하지 않는다(services 규칙).
 */

import type { ChatTurn } from '../../../shared/forge'

const HEAD = '미리보기에서 확인할 것'
/** 완료 글의 앞머리 — `chatturns.ts` 가 쓴다. 이 글이 든 앱 차례가 완료 글이다 */
const PASSED = '타입 검사를 통과했습니다.'

/** 완료 글 — 복사한 수 · 스펙 참고 뒤에 확인할 것을 굵은 제목 아래 한 줄씩. 한 줄에 「/」로 이으면 묻혔다(2026-10-08) */
export function doneText(copied: number, spec: string, look: string[]): string {
  const list = look.length ? `\n\n**${HEAD}**\n${look.map((c) => `- ${c}`).join('\n')}` : ''
  return `리소스 ${copied}개를 호 저장소로 복사했고 ${PASSED}${spec}${list}`
}

/** 완료 글 하나에서 목록을 뽑는다 — 두 꼴 다. 없으면 빈 것 */
function lookIn(text: string): string[] {
  const bold = text.indexOf(`**${HEAD}**`)
  if (bold >= 0) {
    return text
      .slice(bold + HEAD.length + 4)
      .split(/\r?\n/)
      .map((l) => /^\s*-\s+(.*)$/.exec(l)?.[1]?.trim() ?? '')
      .filter(Boolean)
  }
  const plain = text.indexOf(`${HEAD}:`)
  if (plain < 0) return []
  return text
    .slice(plain + HEAD.length + 1)
    .split(' / ')
    .map((x) => x.trim())
    .filter(Boolean)
}

/** 옛 대화 — 마지막 완료 글(앱 차례)의 목록. 완료 글이 없으면 빈 것 */
export function lookFromTurns(turns: ChatTurn[]): string[] {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i]
    if (t?.who === 'app' && t.text.includes(PASSED)) return lookIn(t.text)
  }
  return []
}
