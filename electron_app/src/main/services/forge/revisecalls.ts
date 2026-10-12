/**
 * **앞 회차 값 고치기를 묶음으로 나눠 동시에 묻는다** (2026-09-21).
 *
 * `matchcalls.ts` 가 맞추기에 한 것과 같은 일이다. 까닭도 같다 — 한 번에
 * 432줄을 물으면 **181초**가 걸렸다. 한 판이 6분 20초인데 그 절반이 여기였다.
 *
 * **다른 점이 하나 있다 — 여기는 두 판으로 나누지 않는다.** 맞추기는 ① 그림
 * 없이 전부 → ② `?` 인 자리만 그림과 함께로 갈라서 시간의 90%를 줄였다
 * (`matchcalls.ts` 에 잰 값). 여기는 그 수가 안 통한다. 물음이
 * **「이 값이 이 회차의 것이 맞나」**라서 **그림 없이는 첫 판이 통째로 `?`** 다.
 * 값을 보고 알 수 있으면 애초에 도구가 벌써 고쳤다. 그래서 **모든 묶음이
 * 처음부터 화면을 편다.**
 *
 * 그림값을 묶음 수만큼 더 내는 셈이지만, 맞추기가 이미 하고 있는 맞바꿈이다 —
 * 사람을 기다리게 하는 쪽이 비싸다.
 *
 * **자리를 갈라 묶지 않는다.** `inningData[2]` 의 값들이 서로 다른 묶음에 가면
 * AI 가 한 이닝을 반만 보고 답한다. 맨 앞 마디로 묶은 뒤 그 덩어리째 담는다 —
 * 한 덩어리가 상한보다 커도 쪼개지 않는다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { askAi, type AiReply } from './ai'

/**
 * 한 묶음에 담을 값 줄 수. **150 에서 100 으로 내렸다** (2026-09-23) — MAL2M07W2S1
 * 403줄을 150씩 나누면 묶음마다 267·287·300(끊김)초였고, 새로 부른 세 번 가운데
 * 두 번이 한 묶음을 300초 한도에서 잃었다. 잃은 묶음의 답(캐릭터 자리 18개)이
 * 통째로 빠지는 것이 그림을 한 번 더 싣는 값보다 비싸다.
 */
const CHUNK = 100

export interface Asked {
  text: string
  ok: boolean
  error: string
  missing: boolean
  /** 동시에 돌렸으므로 기다린 시간은 **제일 느린 것** 하나다 */
  took: number
  parts: number
  done: number
}

/**
 * 값 줄을 묶음으로 가른다. **맨 앞 마디가 같은 것끼리 붙여 둔다** —
 * `quizData.M05_View.answer[0]` 과 `[1]` 이 갈리면 안 된다.
 */
export function partsOf(lines: string[], max: number = CHUNK): string[][] {
  const group = new Map<string, string[]>()
  for (const line of lines) {
    const head = line.split(' = ')[0].split(/[.[]/)[0]
    group.set(head, [...(group.get(head) ?? []), line])
  }
  const out: string[][] = []
  let now: string[] = []
  for (const one of group.values()) {
    // **한 덩어리가 상한보다 크면 그 안에서 자른다** (2026-09-21, 재서 잡았다).
    // 처음엔 덩어리째 담기만 했는데, 값의 99%가 `gameData` 뿌리 한 마디 아래
    // 있어서 **391줄이 2묶음**이 됐다 — 큰 쪽이 그대로 300초에 걸려 끊겼다.
    // 나누는 뜻이 없어진다. 잘리는 자리가 생기더라도 **끊기는 것보다 낫다.**
    if (one.length > max) {
      if (now.length) {
        out.push(now)
        now = []
      }
      for (let at = 0; at < one.length; at += max) out.push(one.slice(at, at + max))
      continue
    }
    if (now.length && now.length + one.length > max) {
      out.push(now)
      now = []
    }
    now = [...now, ...one]
  }
  if (now.length) out.push(now)
  return out
}

/**
 * 묶음을 **동시에** 부른다. 한 묶음이 넘어져도 나머지는 받는다 — 하나 때문에
 * 다 버리면 사람이 손으로 하게 된다. 받은 글은 그냥 이어 붙인다. 검산
 * (`revisebrief.ts` 의 `checkEdits`)이 **경로로** 보므로 차례는 상관없다.
 */
export async function askParts(briefs: string[], lookIn?: string): Promise<Asked> {
  const all = await Promise.all(
    briefs.map((b) =>
      askAi(b, lookIn).catch(
        (e): AiReply => ({ ok: false, text: '', error: String(e), missing: false, took: 0 })
      )
    )
  )
  const bad = all.filter((r) => !r.ok)
  return {
    text: all
      .filter((r) => r.ok)
      .map((r) => r.text)
      .join('\n'),
    ok: all.some((r) => r.ok),
    // **다 같은 까닭이면 한 번만 말한다** — 같은 글이 세 줄 나오면 읽기만 나쁘다.
    error: [...new Set(bad.map((r) => r.error))].join(' '),
    missing: bad.some((r) => r.missing),
    took: Math.max(0, ...all.map((r) => r.took)),
    parts: briefs.length,
    done: all.filter((r) => r.ok).length
  }
}
