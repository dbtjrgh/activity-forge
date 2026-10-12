/**
 * 맞추기 물음을 **여러 묶음으로 나눠 동시에** 묻는다 (2026-09-21).
 *
 * **왜 나누나 — 재서 나온 것이다.** 한 학습코드의 자리를 통째로 한 번에 물으면
 * 오래 걸린다. `MAL2M07W2S1` 로 같은 브리프를 재 봤다 —
 *
 * | 물은 자리 | 걸린 시간 |
 * |---|---|
 * | 15자리 | **96초** |
 * | 71자리 | **216초** |
 *
 * 자리가 4.7배인데 시간은 2.3배다. **고정으로 드는 몫이 크고, 그 위로는 물은
 * 만큼 늘어난다.** 그러면 **나눠서 동시에 부르는 쪽이 이긴다** — 71자리를
 * 한 번에 물으면 216초지만, 15자리씩 다섯 묶음을 동시에 부르면 제일 느린
 * 하나(≈96초)다.
 *
 * **갈래로 먼저 가른다.** 그림 자리에 소리 파일을 줄 까닭이 없으므로, 묶음마다
 * 그 갈래의 파일만 준다 — 브리프도 짧아지고 고를 것도 줄어 답이 빨라진다.
 * 한 갈래가 그래도 많으면 다시 자른다. 나누는 셈은 `matchchunks.ts`.
 *
 * **검산은 나눠서 하지 않는다.** 묶음이 갈리면 **다른 묶음이 같은 파일을 골라도
 * 서로 모른다.** 그래서 받은 글을 다 모아 **한 번에** `checkPairs` 로 본다 —
 * 겹친 것은 거기서 걸린다.
 *
 * **그리고 두 판으로 나눈다 — 그림은 두 번째 판에만.** 까닭은 아래 `askChunks`
 * 머리말에 잰 값과 함께 있다. 한 줄로 말하면 **그림이 시간의 90%를 먹는데
 * 이름으로 아는 자리에는 아무 값도 안 했다.**
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { AI_SECONDS, askAi, type AiReply } from './ai'
import type { Chunk } from './matchchunks'

export interface Asked {
  /** 받은 글을 이어 붙인 것. 검산은 부르는 쪽이 **한 번에** 한다 */
  text: string
  /** 보낸 글 — 못 불렀을 때 사람이 붙여넣을 수 있게 그대로 둔다 */
  brief: string
  /** 한 묶음이라도 답이 왔나 */
  ok: boolean
  /** 못 부른 까닭. **묶음마다 다를 수 있어 한 줄로 모은다** */
  error: string
  /** `claude` 를 아예 못 찾았나 */
  missing: boolean
  /** 제일 오래 걸린 묶음(ms). 동시에 부르므로 이것이 실제로 기다린 시간이다 */
  took: number
  /** 몇 묶음을 불렀나 · 그중 몇이 답했나 · 그림까지 편 묶음은 몇인가 */
  parts: number
  done: number
  looked: number
}

/** 「AI 에게 묻기」 걸음이 끝났을 때 한 줄 — 몇 자리를 몇 묶음으로, 화면 · 기획서까지 폈나 (2026-09-30 에 `match.ts` 에서 옮김) */
export function askNote(r: Asked, slots: number, planGap: string): string {
  if (!r.ok) return r.error
  return (
    `항목 ${slots}개를 ${r.parts}묶음으로 나눠 동시에 물었습니다 (${Math.round(r.took / 1000)}초).` +
    (r.looked ? ` ${r.looked}묶음은 화면과 기획서까지 확인했습니다.` : ' 이름만으로 완료했습니다.') +
    (r.done < r.parts ? ` ${r.parts - r.done}묶음은 답을 받지 못했습니다.` : '') +
    (planGap ? ` ${planGap}` : '')
  )
}

/** 도는 동안 한 줄 — 이 걸음이 제일 오래 걸린다 */
export function askProgress(s: number, slots: number, parts: number, shots: number, plans: number): string {
  return (
    `항목 ${slots}개를 ${parts}묶음으로 동시에 묻는 중입니다` +
    (shots || plans ? ` (${[shots ? `figma ${shots}장` : '', plans ? `기획서 ${plans}개` : ''].filter(Boolean).join(', ')})` : '') +
    `. ${s}초 경과 (최대 ${AI_SECONDS}초)`
  )
}

/**
 * 묶음을 **동시에** 부른다. 한 묶음이 넘어져도 나머지는 그대로 받는다 —
 * 하나 때문에 다 버리면 사람이 손으로 하게 된다.
 */
async function callAll(chunks: Chunk[], lookIn?: string): Promise<AiReply[]> {
  return Promise.all(
    chunks.map((c) =>
      askAi(c.brief, lookIn).catch(
        (e): AiReply => ({ ok: false, text: '', error: String(e), missing: false, took: 0 })
      )
    )
  )
}

/** 받은 글에서 「모르겠다」로 온 별칭. 두 번째 판에서 **그것만** 다시 묻는다. */
function unsureAliases(text: string): Set<string> {
  const out = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const cell = line.split('\t')
    if (cell.length >= 2 && cell[0].trim() && (cell[1].trim() === '?' || cell[1].trim() === '？')) {
      out.add(cell[0].trim())
    }
  }
  return out
}

/**
 * **그림은 두 번째 판에서만 준다** (2026-09-21).
 *
 * **재서 정한 것이다.** 같은 묶음(자리 15 · 고를 파일 59)을 두 꼴로 돌렸다 —
 *
 * | | 걸린 시간 | 답 |
 * |---|---|---|
 * | figma 그림 같이 | **178~244초** | 15줄 · 모르겠다 13 |
 * | 그림 없이 | **24.7초** | 15줄 · 모르겠다 13 |
 *
 * **그림이 시간의 90%를 먹는데 답은 같았다.** 이름으로 아는 자리
 * (`character_0_idle` → `character_0_body_idle.png`)에는 그림이 필요 없기
 * 때문이다. 그림이 값을 하는 것은 **이름으로 알 수 없는 자리**뿐이다 —
 * 실제로 그 자리들이 「어느 것이 기본인지 화면을 봐야 안다」고 답해 왔다.
 *
 * 그래서 두 판으로 나눈다 —
 *
 *   ① 그림 없이 전부 묻는다          묶음마다 ≈25초, 동시에
 *   ② `?` 로 온 자리만 그림과 함께    남은 것이 없으면 **아예 안 부른다**
 *
 * 이름이 깨끗한 회차는 ②가 통째로 안 돌고 30초에 끝난다. `auto.ts` 가 화면을
 * 먼저 받아 두는 것(`shotfirst.ts`)과 어긋나지 않는다 — 화면은 짜임·이름차례가
 * 먼저 쓰고, 여기서는 **필요할 때만** 편다.
 *
 * **뒤엣것을 앞에 붙여 돌려준다.** 검산(`pairs.ts`)이 한 별칭에 온 첫 줄을
 * 받으므로, 두 번째 판에서 고른 것이 첫 판의 `?` 를 이긴다.
 */
export async function askChunks(
  chunks: Chunk[],
  lookIn?: string,
  shots: string[] = [],
  plans: string[] = [],
  rscDir = ""
): Promise<Asked> {
  const blind = chunks.map((c) => ({ ...c, brief: c.brief }))
  const first = await callAll(blind)
  const firstText = first
    .filter((r) => r.ok)
    .map((r) => r.text)
    .join('\n')

  // ─ ② 그림이 있어야 아는 자리만 다시 ─
  const stuck = unsureAliases(firstText)
  // **기획서만 있어도 두 번째 판을 돈다** (2026-09-23). 전에는 figma 가
  // 있을 때만 다시 물었다 — 소리 자리는 화면에 안 보이고 기획서에 있다.
  const paper = shots.length + plans.length
  const again = lookIn && paper ? chunks.filter((c) => c.slots.some((s) => stuck.has(s.alias))) : []
  const second = again.length
    ? await callAll(
        again.map((c) => {
          const mine = c.slots.filter((s) => stuck.has(s.alias))
          return { ...c, slots: mine, brief: c.reask(mine, { shots, plans, rscDir }) }
        }),
        lookIn
      )
    : []

  const all = [...first, ...second]
  const bad = all.filter((r) => !r.ok)
  return {
    text: [
      ...second.filter((r) => r.ok).map((r) => r.text),
      ...first.filter((r) => r.ok).map((r) => r.text)
    ].join('\n'),
    brief: [...chunks.map((c) => c.brief)].join('\n\n───────────────\n\n'),
    ok: all.some((r) => r.ok),
    // **다 같은 까닭이면 한 번만 말한다** — 같은 글이 다섯 줄 나오면 읽기만 나쁘다.
    error: [...new Set(bad.map((r) => r.error))].join(' '),
    missing: bad.some((r) => r.missing),
    // 두 판을 줄 세워 돌리므로 기다린 시간은 **판마다 제일 느린 것의 합**이다.
    took:
      Math.max(0, ...first.map((r) => r.took)) + (second.length ? Math.max(...second.map((r) => r.took)) : 0),
    parts: chunks.length,
    done: first.filter((r) => r.ok).length,
    looked: again.length
  }
}
