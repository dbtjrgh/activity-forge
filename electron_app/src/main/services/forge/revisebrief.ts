/**
 * B단계(`revise.ts`)가 AI 에게 주는 글 — **펴기 · 브리프.** 받은 답 검산은 `revisecheck.ts`.
 *
 * `revise.ts` 가 303줄이 되어 흐름과 글을 갈랐다 (2026-09-18, 동작 변화 없음).
 * 흐름(모으기 → 부르기 → 얹기)과 「모르겠다」 카드는 `revise.ts` 에 있고,
 * 여기는 **무엇을 보여 주고 무엇을 받아들이나**만 있다.
 *
 * `brief.ts` 와 다른 물음이다 — 저쪽은 맞추기(못 맞춘 자리)의 글이다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { planBlock } from './pasted'
import { HANDS_OFF } from './revisecheck'

export interface Flat {
  lines: string[]
  known: Set<string>
  /** 값 자리의 원래 타입 — 받은 답이 그 타입을 지키는지 본다(`revisecheck.ts`). 리소스 자리는 없다 */
  types?: Map<string, 'number' | 'boolean' | 'string'>
}

/**
 * 레시피를 **얹는 쪽이 알아듣는 말**로 편다.
 *
 *   `assets.<갈래>.<별칭> = <파일>`   그 별칭이 가리키는 파일
 *   `<뿌리>.<자리> = <값>`            gameData 안의 값
 */
export function flatten(recipe: unknown, root: string): Flat {
  const lines: string[] = []
  const r = recipe as {
    assets?: Record<string, { alias: string; file: string }[]>
    gameData?: unknown
  }
  for (const kind of ['image', 'sound', 'lottie', 'font']) {
    for (const one of r.assets?.[kind] ?? []) lines.push(`assets.${kind}.${one.alias} = ${one.file}`)
  }
  const types = new Map<string, 'number' | 'boolean' | 'string'>()
  walk(r.gameData, root, lines, types)
  return { lines, known: new Set(lines.map((l) => l.slice(0, l.indexOf(' = ')))), types }
}

function walk(value: unknown, at: string, out: string[], types: Map<string, 'number' | 'boolean' | 'string'>): void {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${at}[${i}]`, out, types))
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(v, at ? `${at}.${k}` : k, out, types)
    }
    return
  }
  // **좌표·크기 줄은 안 싣는다** (2026-09-28). 받지 않는 자리다(`revisecheck.ts` 의 HANDS_OFF) —
  // 좌표는 figma 화면이 넣는다(`shotcoords.ts`). 자리 표를 채우자 MAL2M07W2S1 이 361 → 433줄 · 6묶음이 되어
  // 한 묶음이 450초에 끊겼다. 받지도 않을 줄을 AI 에게 읽힐 까닭이 없다.
  const last = at.split(/[.[\]]/).filter(Boolean).pop() ?? ''
  if (HANDS_OFF.has(last)) return
  out.push(`${at} = ${String(value)}`)
  types.set(at, typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string')
}

export function briefOf(
  code: string,
  flat: Flat,
  spec: string,
  files: string[],
  /** 붙여넣은 figma 화면 **전부.** 붙인 차례다 */
  shots: string[],
  /** 붙여넣은 기획서 **전부.** 값의 정본이다(`pasted.ts`) */
  plans: string[] = [],
  /** 리소스 폴더 — 기획서가 몇 쪽인지 세는 데만 쓴다 */
  rscDir = ''
): string {
  const p: string[] = []
  p.push(`학습코드 ${code} 의 값을 고친다.`)
  p.push('')
  // **화면을 먼저 읽으라고 맨 앞에 둔다.** 뒤에 붙이면 값 목록 수백 줄을
  // 다 본 뒤라 「이미 정한 답」을 그림으로 되짚지 않는다.
  if (shots.length) {
    p.push(`## 이 액티비티의 figma 화면 ${shots.length}장`)
    p.push(...shots.map((s) => `- \`${s}\``))
    p.push('')
    p.push('**위의 것을 다 읽고 나서 답하라.** 사람이 이 화면을 붙여넣은 까닭은')
    p.push('파일 이름만으로는 어느 것이 이 회차의 어느 자리인지 알 수 없었기')
    p.push('때문이다. 무엇이 어느 자리에 몇 번째로 나오는지가 거기 있다.')
    // **여러 장이면 왜 여러 장인지를 말해 준다** (2026-09-21). 한 장에 다
    // 담겼으면 사람이 더 붙일 까닭이 없었다 — 장면이 갈렸거나 잘렸다는 뜻이다.
    if (shots.length > 1) {
      p.push('**한 장에 안 보이는 자리는 다른 장에 있다.** 사람이 나눠 붙인 것은')
      p.push('한 장에 다 안 담겼기 때문이다. 첫 장만 보고 「없다」고 하지 마라.')
    }
    p.push('')
  }
  // **기획서는 화면 바로 뒤에 둔다.** 값을 고치는 일이라 여기가 제일 센 근거다.
  p.push(...planBlock(plans, rscDir))
  const shot = shots[0] ?? ''
  // **값 꼴은 기획서가 있을 때만 연다** (2026-09-28, `revisecheck.ts`). 값의 정본이 기획서다 —
  // 없으면 AI 는 앞 회차 값을 두고 짐작만 한다. 없을 때는 글을 한 글자도 안 바꿔 녹음이 그대로 맞는다.
  const values = plans.length > 0
  p.push(`## 도구가 지금 넣어 둔 값 ${flat.lines.length}줄 — 경로 = 값`)
  // **이 줄의 「짝짓기」는 일부러 안 고쳤다** (2026-09-23 이름을 맞추기로 바꾼 날).
  // AI 에게 실제로 나가는 글이라 한 글자만 바뀌어도 녹음(`tape.ts`)이 통째로
  // 빗나간다. 이 브리프를 진짜로 고칠 일이 생기는 날 같이 고친다.
  p.push('앞선 호의 같은 모듈 액티비티에서 떠 온 뒤 리소스 짝짓기까지 끝난 것이다.')
  p.push(flat.lines.join('\n'))
  p.push('')
  if (spec) {
    p.push('## 모듈 스펙 — 칸이 무엇을 뜻하나')
    p.push(spec.trimEnd())
    p.push('')
  }
  p.push(`## ${code} 의 리소스 폴더에 실제로 있는 파일 ${files.length}개`)
  p.push(files.join('\n'))
  p.push('')
  p.push('## 고칠 것')
  p.push('- 별칭이 이 회차와 상관없는 낱말이면 (앞 회차가 skirt·tshirt 인데')
  p.push('  이번 리소스는 crayon·fork 인 식) 그 자리를 갈아 끼운다.')
  p.push('- 위 목록에 없는 파일 이름을 지어내지 않는다.')
  if (values) {
    p.push('- **값은 기획서대로 고친다.** 낱말·문장·숫자·시간·차례가 앞 회차 것 그대로이고')
    p.push('  기획서에 이 회차 값이 적혀 있으면 그 값으로 바꾼다 (거품이 뜨는 때 `10~16` 초 같은 것).')
    p.push('  기획서에 없는 값은 건드리지 않는다. **좌표는 기획서에 없다** — figma 기준이라 손대지 않는다.')
  }
  // **「근거가 없다」고 쓰면 화면이 있을 때 거짓말이 된다** (2026-09-21).
  // 화면을 보면 정답도 칸 수도 보인다. 손대지 말라는 까닭은 근거가 없어서가
  // 아니라 **여기가 그것을 받는 자리가 아니어서**다 — 칸 수는 `#cells`,
  // 정답은 사람이 닫는 카드(`answerkey.ts`)로 따로 간다.
  if (values) {
    // **기획서가 있으면 정답도 여기서 받는다** (2026-09-28 사용자 결정). 사람은 정답 카드에서
    // 눌러 보고 한 번 닫는다(`answerkey.ts`) — 옛 양산 창에 가서 고치는 일만 없어진다.
    p.push('- 좌표·크기는 손대지 않는다. 칸 수도 다른 물음으로 따로 묻는다.')
    p.push('- **정답도 기획서대로 고친다.** 번호가 단추·그림을 가리키면 위 목록의 파일로 이어 본다')
    p.push('  (기획서가 「37 → SL_drum_sfx04」면 `assets.sound.btn_sfx_4 = sfx/SL_drum_sfx04.mp3` 인 단추 4 가 정답).')
    p.push('  이을 근거가 글자 어디에도 없으면 정답은 그대로 둔다.')
  } else {
    p.push('- 좌표·크기·정답(correct)은 손대지 않는다. 여기서 받는 답이 아니다 —')
    p.push('  칸 수와 정답은 다른 물음으로 따로 묻는다.')
  }
  p.push('- **이름으로 아는 것은 이름으로 정한다.** 파일 이름에 그 낱말이 들어 있거나')
  p.push('  (`SL_en_word_fork.mp3` → `fork`), 앞 회차 이름에서 학습코드·호 숫자만')
  p.push('  바뀐 것이면 (`SL_ma_227_…` → `SL_ma_127_…`) 그것은 **아는 것이다. 답하라.**')
  p.push('- **정말 근거가 없을 때만** 아래 세 번째 꼴을 쓴다.')
  p.push('')
  p.push(`## 답하는 꼴 — ${values ? '넷' : '셋'}뿐이다`)
  p.push('assets.<갈래>.<별칭> = <파일 이름>    그 별칭이 가리키는 파일만 바꾼다')
  p.push('#slot|<갈래>|<별칭> = <파일 이름>     그 자리를 통째로 갈아 끼운다')
  p.push('?<갈래>|<별칭> = <무엇이 있으면 알겠나>  **모르겠다.** 사람에게 물어 달라')
  if (values) p.push('<값 경로> = <값>                    위 값 목록의 그 자리 값을 바꾼다 — 경로는 글자 그대로, 수는 수로')
  p.push('')
  // **여기 문장이 세기를 정한다** (2026-09-21). 처음엔 「세 번째 꼴을 아끼지
  // 마라」라고 썼더니 AI 가 **답하는 대신 모르겠다고 했다** — 22개에서 얹은
  // 자리 38 · 모르겠다 152 였다(같은 도구가 2026-09-17 엔 76개에서 664를 얹었다).
  // 짐작을 막으려다 **아는 것까지 안 답하게** 만든 것이다. 그래서 「마지막 수단」
  // 으로 세기를 낮추고, 무엇이 「아는 것」인지를 위에 못 박았다.
  p.push(`세 번째 꼴은 **마지막 수단이다.** ${values ? '다른 꼴' : '위 두 꼴'}로 답할 수 있으면 그것으로 답하라.`)
  p.push('쓰는 것은 **어느 것을 골라야 할 근거가 글자 어디에도 없을 때**뿐이다 —')
  p.push('이를테면 낱말이 통째로 바뀌었는데 파일 이름이 `Group 27.png` 처럼 무작위라')
  p.push('어느 자리인지 알 길이 없는 때다. 그럴 때 짐작해서 쓰면 **에러도 안 나고')
  p.push('아무도 모른 채** 틀린 액티비티가 나간다. 모르겠다고 하면 도구가')
  p.push('사람에게 figma 화면이나 기획서를 달라고 하고 다시 묻는다.')
  p.push('')
  p.push('**한 자리는 한 꼴로만 답한다.** 답을 쓴 자리를 세 번째 꼴로 또 쓰지 마라.')
  if (shot) {
    // **화면을 이미 줬는데도 모르겠다가 그대로 오면 사람이 헛일을 한 것이다.**
    // 그래서 화면이 있을 때는 무엇이 더 있어야 알겠는지까지 적게 한다 —
    // 그 글이 그대로 카드의 물음이 된다(`unsureAsks`).
    p.push('')
    p.push(`다만 화면 ${shots.length}장은 이미 줬다. 거기 **보이는 자리는 화면으로 정하고**,`)
    p.push('세 번째 꼴은 **어느 장에도 안 보이는 자리에만** 쓴다. 그때는 화면의 무엇이')
    p.push('모자랐는지(잘려 있다 · 다른 장면이다 · 소리는 화면에 안 보인다) 적어라.')
  }
  p.push('')
  p.push('별칭 자체가 이 회차와 안 맞으면 아래쪽을 쓴다 — 새 별칭은 도구가')
  p.push('파일 이름에서 짓고 GameData 안의 이름도 같이 바꾼다.')
  p.push('별칭은 맞는데 파일만 다르면 위쪽을 쓴다.')
  p.push('바꿀 자리만 한 줄에 하나씩. 갈래와 별칭은 위에 준 것을 글자 그대로 쓴다.')
  p.push('바꿀 것이 없으면 아무 줄도 쓰지 않는다. 그 밖의 말은 한 줄도 쓰지 않는다.')
  return p.join('\n')
}
