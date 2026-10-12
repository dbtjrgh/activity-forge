/**
 * **리소스 이름과 차례를 정한다** — 양산보다 앞선 자리 (자동양산 ㉥·㉢).
 *
 * figma 에서 리소스를 내보내면 이름이 **저장되어 있지 않아 무작위**다 —
 * `Group 27.png` · `Frame 4.png` · `Rectangle 8.png`. 지금까지는 사람이 figma
 * 화면을 캡처해 Claude Code 에 붙이고 이름과 차례를 받아 손으로 고쳐 왔다.
 * **그 일을 그대로 도구에 들인다.**
 *
 * **재 보고 만들었다 (2026-09-15).** `ENL1M07W1S3` 의 무작위 이름 여섯 장과
 * figma 스샷을 같이 주니 **이름도 이닝 차례도 여섯 개 전부 맞았다** — $0.082 · 19초.
 * 그 차례(fork·toothbrush·scissors·crayon·umbrella·wateringcan)는 알파벳순도
 * 파일순도 아니다. **스샷이 그 뜻을 들고 있었다.**
 *
 * **그래서 차례도 여기서 같이 받는다.** 따로 물으면 사람이 같은 그림을 두 번 본다.
 *
 * **믿지 않는다.** 받은 답의 검산은 `namecheck.ts` 에 있다.
 */

import { planBlock } from './pasted'
import { readRows } from '../../lib/table'

/** figma 가 붙이는 이름들. 뜻이 없다는 신호다. */
const RANDOM = /^(group|frame|rectangle|ellipse|vector|layer|image|img|union|subtract|mask|component|instance|asset|untitled)[\s_-]*\d*$/i

/** 이름에서 확장자를 뗀다. `Group 27.png` → `Group 27`. */
export function stem(file: string): string {
  return file.replace(/\.[a-z0-9]+$/i, '')
}

/**
 * 이 이름이 **뜻을 담고 있나.** 담고 있지 않으면 그림을 봐야 한다.
 *
 * 한 장씩 보지 않고 **폴더째 본다** — 한둘이 `Group 27` 인 것과 열 장이 다 그런
 * 것은 다른 일이다. 앞엣것은 그 몇 장만 물으면 되고, 뒤엣것은 폴더 전체가
 * figma 에서 그대로 온 것이다.
 */
export function looksRandom(file: string): boolean {
  const name = stem(file.split('/').pop() ?? file).trim()
  if (!name) return true
  if (RANDOM.test(name)) return true
  // 숫자만 · 한 글자 · 무의미하게 긴 16진수(내보내기 해시)
  if (/^\d+$/.test(name)) return true
  if (name.length <= 1) return true
  if (/^[0-9a-f]{8,}$/i.test(name)) return true
  return false
}

export type NameCheck = {
  /** 이름만으로는 알 수 없는 파일들. 이것들이 그림을 봐야 하는 것이다. */
  blind: string[]
  /** 폴더의 파일 수 */
  total: number
}

/** 폴더에 놓인 파일 가운데 **이름으로 알 수 없는 것**을 고른다. */
export function blindFiles(files: string[]): NameCheck {
  return { blind: files.filter(looksRandom), total: files.length }
}

/** AI 가 정해 준 한 줄. */
export type NamePick = {
  /** 지금 파일 이름 (폴더에 있는 그대로) */
  file: string
  /** 새 이름. **확장자도 접두사도 없다** — 그대로 별칭이 된다 */
  name: string
  /** 몇 번째 이닝인가. 차례가 없는 자리면 `null` */
  inning: number | null
  /** 무엇을 보고 그렇게 정했는지 */
  why: string
}

/**
 * 이름과 차례를 물어보는 브리프.
 *
 * **파일 이름만 적는다 — 경로는 적지 않는다.** `askAi` 가 리소스 폴더를 `cwd` 로
 * 주므로 그 밖은 읽지 못하고, 브리프에도 울타리 밖을 가리킬 길을 두지 않는다.
 *
 * **스샷이 없어도 부른다.** 그때는 이름만 정하고 차례는 비운다 — 그림이 무엇인지는
 * 알 수 있다. 차례는 그 뒤에 사람에게 묻는다.
 */
export function nameBrief(
  files: string[],
  shots: string[],
  innings: number | null,
  /** 붙여넣은 기획서 **전부.** 차례가 거기 적혀 있는 일이 많다 */
  plans: string[] = [],
  /** 리소스 폴더 — 기획서가 몇 쪽인지 세는 데만 쓴다 */
  rscDir = ''
): string {
  const shot = shots.length > 0
  const lines = [
    '# 리소스 이름 정하기',
    '',
    'figma 에서 내보낸 파일이라 이름이 무작위입니다. **그림을 열어 보고** 무엇인지 정해 주세요.',
    ''
  ]

  lines.push(...planBlock(plans, rscDir))

  if (shot) {
    lines.push(
      `## 이 액티비티의 figma 화면 ${shots.length}장`,
      '',
      ...shots.map((s) => `- ${s}`),
      '',
      '**다 읽고 나서 답하세요.** 각 파일이 화면의 어디에 쓰이는지, **몇 번째 차례인지**가 거기 있습니다.',
      // 여러 장이면 한 장에 안 담겼다는 뜻이다 — 첫 장만 보고 넘기면 사람이 헛일을 했다.
      ...(shots.length > 1 ? ['**한 장에 안 보이는 것은 다른 장에 있습니다.**'] : []),
      ''
    )
  }

  lines.push('## 이름을 정할 파일', '', ...files.map((f) => `- ${f}`), '', '## 답하는 법', '')
  lines.push('한 줄에 하나씩, 탭으로 나눠 주세요. 다른 말은 쓰지 마세요.', '')
  lines.push('지금이름\t새이름\t차례\t왜 그렇게 봤는지 한 줄', '')
  lines.push(
    '- **새이름에 확장자를 붙이지 마세요.** `crayon` 이지 `crayon.png` 가 아닙니다.',
    '- **접두사를 붙이지 마세요.** `word_crayon` 이 아니라 `crayon` 입니다.',
    '- 영어 소문자로, 그림에 보이는 것을 그대로 적으세요.'
  )

  if (shot) {
    lines.push(
      `- **차례**는 화면에서 몇 번째로 나오는지입니다${innings ? ` (1~${innings})` : ''}. ` +
        '한 번호를 두 파일에 주지 마세요.'
    )
  } else {
    lines.push('- **차례는 빈칸(-)으로 두세요.** 화면을 안 줬으니 알 수 없습니다.')
  }

  lines.push('- **모르면 그 줄을 아예 쓰지 마세요.** 억지로 지은 이름이 제일 나쁩니다.')
  return lines.join('\n')
}

/** AI 가 낸 글에서 이름과 차례를 읽는다. 표를 가르는 셈은 `lib/table.ts` 하나다. */
export function readNames(text: string): NamePick[] {
  const out: NamePick[] = []
  for (const [file, name, order, ...rest] of readRows(text)) {
    if (!file || !name || file === '지금이름') continue
    const n = Number(String(order ?? '').replace(/[^\d]/g, ''))
    out.push({
      file,
      // 「확장자도 접두사도 붙이지 마라」고 시켜 두었어도 붙여 오는 일이 있다.
      // 재 봤을 때 `word_crayon.png` 로 왔다 — 여기서 한 번 더 벗긴다.
      name: stem(name).replace(/^(word|img|image|snd|sound)[_-]/i, ''),
      inning: Number.isFinite(n) && n > 0 ? n : null,
      why: rest.join(' ').trim()
    })
  }
  return out
}
