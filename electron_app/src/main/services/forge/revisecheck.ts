/**
 * B단계(`revise.ts`)가 받은 답의 **검산** — 믿지 않는다 (`revisebrief.ts` 에서 갈라 옴).
 *
 * 받는 꼴은 넷이다. 리소스 셋(`assets.…` · `#slot|…` · `?…`)은 처음부터 있었고,
 * **GameData 값(`<뿌리>.<자리> = <값>`)은 2026-09-28 에 열었다.** 그 전에는 브리프가 값 꼴을
 * 안 알려 줘 AI 가 기획서에 적힌 값을 보고도 못 고쳤다 — ENL3M07W3S1 의 거품이 뜨는 시간
 * (기획서 10~16초, 도구 15~22초)이 녹음 12개에서 한 번도 안 고쳐졌다.
 *
 * 값 답은 **준 경로만 · 원래 타입 그대로만** 받는다. 수 자리에 글이 오거나 없는 경로면 버린다.
 * 좌표·크기는 브리프가 「손대지 않는다」고 한 자리라 여기서도 막는다 — 기획서에 좌표는
 * 없고(figma 기준). 정답은 받되 사람이 카드로 닫는다(`answerkey.ts`).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Answer, ReviseResult } from '../../../shared/forge'
import { parseSlotPath } from '../../../shared/forge'
import { nameInBase } from './rscplace'
import type { Flat } from './revisebrief'

/** 값 꼴로 받지 않는 마지막 마디 — 좌표 · 크기. 정답은 기획서가 있을 때 받는다(2026-09-28 사용자 결정 · 사람이 카드로 닫는다) */
export const HANDS_OFF = new Set(['x', 'y', 'width', 'height', 'w', 'h', 'scale'])

/** 받은 글 값을 원래 타입으로. 못 바꾸면 null */
function typed(value: string, type: 'number' | 'boolean' | 'string'): string | number | boolean | null {
  if (type === 'number') {
    const n = Number(value)
    return value.trim() !== '' && Number.isFinite(n) ? n : null
  }
  if (type === 'boolean') return value === 'true' ? true : value === 'false' ? false : null
  // 따옴표로 싸서 보내는 일이 있다 — 목록에는 따옴표 없이 줬다
  const q = /^(['"`])(.*)\1$/.exec(value)
  return q ? (q[2] as string) : value
}

/**
 * 받은 글을 답으로. **믿지 않는다** — 준 경로인지, 폴더에 있는 파일인지, 값이면 타입이 맞는지 본다.
 *
 * 걸린 것은 버리고 **왜 버렸는지 담아 화면으로 보낸다.** 조용히 지우면
 * 「AI 가 아무것도 안 했다」로 보인다.
 */
export function checkEdits(
  text: string,
  flat: Flat,
  files: Set<string>
): { answers: Answer[]; refused: string[]; unsure: ReviseResult['unsure'] } {
  const answers: Answer[] = []
  const refused: string[] = []
  const unsure: ReviseResult['unsure'] = []
  for (const line of text.split(/\r?\n/)) {
    // **「모르겠다」를 먼저 걷는다.** 레시피 자리가 아니므로 아래 검산에
    // 넣으면 「준 목록에 없는 자리」로 물려 조용히 사라진다.
    const ask = /^\s*\?([^|]+)\|([^=]+?)\s*=\s*(.*?)\s*$/.exec(line)
    if (ask) {
      const kind = ask[1].trim()
      const alias = ask[2].trim()
      // 있지도 않은 자리를 물어 오면 사람에게 헛일을 시킨다.
      if (flat.known.has(`assets.${kind}.${alias}`)) {
        unsure.push({ kind, alias, why: ask[3] || '무엇이 필요한지 말하지 않았습니다.' })
      } else {
        refused.push(`?${kind}|${alias}: 요청한 목록에 없는 항목입니다.`)
      }
      continue
    }
    const m = /^\s*([#A-Za-z_$][^=]*?)\s*=\s*(.+?)\s*$/.exec(line)
    if (!m) continue
    const path = m[1].trim()
    const value = m[2].trim()
    const at = parseSlotPath(path)
    if (!(at ? flat.known.has(`assets.${at.kind}.${at.alias}`) : flat.known.has(path))) {
      refused.push(`${path}: 요청한 목록에 없는 항목입니다.`)
      continue
    }
    // 리소스를 가리키는 답은 **폴더에 그 파일이 있어야** 받는다.
    const isFile = at !== null || path.startsWith('assets.')
    if (isFile) {
      // 갈래 폴더(`sounds/`)만 뗀다. **한 겹 더 들어간 폴더(`narration/`)는 이름의
      // 일부다** — 마지막 `/` 까지 떼면 레시피에 `x.mp3` 가 들어가 404 가 된다.
      if (!files.has(nameInBase(value))) {
        refused.push(`${path} = ${value}: 폴더에 없는 파일입니다.`)
        continue
      }
      answers.push({ path, value })
      continue
    }
    // ─ 값 자리 ─
    const last = /([A-Za-z_$][\w$]*)$/.exec(path)?.[1] ?? ''
    if (HANDS_OFF.has(last)) {
      refused.push(`${path}: 좌표와 크기는 여기서 바꾸지 않습니다.`)
      continue
    }
    const v = typed(value, flat.types?.get(path) ?? 'string')
    if (v === null) {
      refused.push(`${path} = ${value}: 원래 값과 타입이 다릅니다(${flat.types?.get(path)}).`)
      continue
    }
    answers.push({ path, value: v })
  }

  // **한 자리를 두 꼴로 답한 것은 답 쪽을 믿는다** (2026-09-21).
  //
  // 브리프에 「한 꼴로만 답하라」고 적어 두긴 했지만 **말로 시킨 것은 검산하지
  // 않으면 지켜지는지 모른다**(저장소 규칙). 답이 있는데 「모르겠다」가 같이
  // 오면, 사람에게 **이미 풀린 자리를 다시 묻는 카드**가 나간다 — 헛일이다.
  const answered = new Set(
    answers.map((a) => {
      const at = parseSlotPath(a.path)
      return at ? `${at.kind}.${at.alias}` : a.path.replace(/^assets\./, '')
    })
  )
  return {
    answers,
    refused,
    unsure: unsure.filter((u) => !answered.has(`${u.kind}.${u.alias}`))
  }
}
