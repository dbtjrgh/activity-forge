/**
 * 짜임을 AI 에게 물을 때 주고받는 글 — **배열 펴기 · 폴더 세기 · 브리프 · 받은 답 검산.**
 *
 * `shape.ts` 가 314줄이 되어 흐름과 글을 갈랐다 (2026-09-18, 동작 변화 없음).
 * 묻는 흐름·남기기·카드는 `shape.ts` 에 있고, 여기는 **무엇을 보여 주고
 * 무엇을 받아들이나**만 있다. `revisebrief.ts` 와 같은 갈래다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { ShapeFinding, ShapeFile } from '../../../shared/forge'
import { planBlock } from './pasted'
import { readRows } from '../../lib/table'

/** 배열 자리를 이만큼만 본다. 깊이 들어가면 브리프가 값싸지 않다. */
const MAX_ROWS = 80
const MAX_DEPTH = 6

export interface ArrayRow {
  path: string
  n: number
  /**
   * 칸마다 이름 한 낱말(`id` · `alias` · `texture` 가운데 먼저 있는 것) — **칸이 화면의 무엇인지** 보이게 (2026-10-02).
   * 자리 이름과 칸 수만 주니 K35 의 `targetData 4` 가 오른쪽 퍼즐 조각인 줄 몰라, 「플라스틱」 판이 6조각인 화면을 두 번 보고도 「없음」이었다
   */
  names: string[]
}

const NAME_KEYS = ['id', 'alias', 'texture', 'name', 'key']
function nameOf(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number') return String(v).slice(0, 24)
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ''
  const o = v as Record<string, unknown>
  const k = NAME_KEYS.find((x) => typeof o[x] === 'string')
  return k ? String(o[k]).slice(0, 24) : ''
}

/**
 * 값 안의 **배열 자리와 칸 수**를 모은다.
 *
 * 칸이 하나뿐인 배열도 담는다 — 「원본은 하나인데 이 회차는 셋」이 있을 수 있고,
 * 그것도 짜임이 다른 것이다.
 */
export function arrayRows(gameData: unknown): ArrayRow[] {
  const out: ArrayRow[] = []
  const walk = (v: unknown, at: string, depth: number): void => {
    if (out.length >= MAX_ROWS || depth > MAX_DEPTH || v === null || typeof v !== 'object') return
    if (Array.isArray(v)) {
      out.push({ path: at, n: v.length, names: v.slice(0, 8).map(nameOf).filter(Boolean) })
      v.forEach((x, i) => walk(x, `${at}[${i}]`, depth + 1))
      return
    }
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      walk(x, at ? `${at}.${k}` : k, depth + 1)
    }
  }
  walk(gameData, 'quizData', 0)
  return out
}

/** 이 회차 폴더의 파일을 **이름 무리로** 묶어 센다. forge 의 `familyOf` 를 그대로 쓴다. */
export function fileFamilies(
  files: { name: string; base: string }[],
  familyOf: (rel: string) => string
): ShapeFile[] {
  const count = new Map<string, number>()
  for (const f of files) {
    if (/(^|\/)readme\.md$/i.test(f.name)) continue
    const rel = f.base === 'root' ? f.name : `${f.base}/${f.name}`
    const key = familyOf(rel)
    count.set(key, (count.get(key) ?? 0) + 1)
  }
  return [...count]
    .map(([family, n]) => ({ family, n }))
    .sort((a, b) => b.n - a.n || a.family.localeCompare(b.family))
}

/**
 * 브리프 한 장. **원본의 칸 수와 폴더의 개수**, 있으면 **figma 화면**을 준다 — 값 자체는 안 준다.
 * 물음이 하나라 짧고, 짧아야 싸고 정확하다.
 */
export function shapeBrief(
  code: string,
  origin: string,
  rows: ArrayRow[],
  families: ShapeFile[],
  /**
   * 리소스 폴더 안의 figma 화면 **전부**(`_figma/…`). 비면 폴더 개수만 준다.
   * **파일 이름만 적는다** — `askAi` 가 그 폴더를 울타리로 준다(`name.ts` 와 같다).
   */
  shots: string[] = [],
  /** 붙여넣은 기획서 **전부.** 이닝 수·칸 수가 표로 적혀 있는 일이 많다 */
  plans: string[] = [],
  /** 리소스 폴더 — 기획서가 몇 쪽인지 세는 데만 쓴다 */
  rscDir = ''
): string {
  const shot = shots.length > 0
  return [
    ...planBlock(plans, rscDir),
    `# 짜임이 원본과 다른 자리 찾기 — ${code}`,
    '',
    `${origin} 을 그대로 베껴 이 회차를 만듭니다. 그런데 회차마다 걸음 수와`,
    '칸 수가 다릅니다 — 자막이 한 장 늘거나, 걸음 하나가 빠지거나 합니다.',
    '베낀 값은 **원본의 칸 수** 그대로입니다. 이 회차에 맞는지 봐 주세요.',
    '',
    // **화면이 제일 센 근거다.** 폴더 개수는 칸 수와 거의 안 맞았다
    // (8호 맨 윗단 53자리 중 0 — `forge/src/tool/cells.ts`).
    ...(shot
      ? [
          `## 이 회차의 figma 화면 ${shots.length}장`,
          '',
          ...shots.map((s) => `- ${s}`),
          '',
          '**다 읽고 나서 세세요.** 이닝(문제) 수, 한 화면의 보기·칸 수가 거기 보입니다.',
          '**화면에서 센 것을 근거로 삼으세요.** 아래 폴더 개수는 참고일 뿐이고 자주 틀립니다.',
          ...(shots.length > 1
            ? ['**한 장에 안 보이는 자리는 다른 장에 있습니다.** 첫 장만 보고 세지 마세요.']
            : []),
          '어느 장에도 안 보이는 자리는 짚지 마세요.',
          ''
        ]
      : []),
    '## 베껴 온 배열 자리와 칸 수',
    '',
    '칸 이름은 원본 값입니다. 화면에서 같은 구실을 하는 것(조각 · 보기 · 글자)을 **이닝마다 따로** 세어 견주세요 — 이닝마다 칸 수가 다를 수 있습니다.',
    '',
    '자리\t칸수\t칸 이름(원본)',
    rows.map((r) => `${r.path}\t${r.n}\t${r.names.join(', ')}${r.n > r.names.length && r.names.length ? ', …' : ''}`).join('\n'),
    '',
    '## 이 회차 폴더에 실제로 있는 파일 (이름 무리로 묶어 셈)',
    '',
    '무리\t개수',
    families.map((f) => `${f.family}\t${f.n}`).join('\n'),
    '',
    '## 무엇을 답하나',
    '',
    '칸 수가 이 회차와 안 맞아 보이는 자리만 한 줄씩 적어 주세요.',
    '',
    '자리\t몇칸이어야하나\t왜 그렇게 봤는지 한 줄',
    '',
    '- 보기 — 자막 자리가 15칸인데 폴더에 자막 그림이 13쌍뿐이면 13칸입니다.',
    '- **맞아 보이는 자리는 쓰지 마세요.** 다른 것만 적습니다.',
    '- **확신이 없으면 쓰지 마세요.** 억지로 짚은 것이 제일 나쁩니다 —',
    '  사람이 그걸 믿고 값을 고치면 되돌리기 어렵습니다.',
    '- 위 「자리」 목록에 있는 글자를 그대로 쓰세요. 없는 자리는 버려집니다.'
  ].join('\n')
}

/**
 * AI 가 낸 글에서 짚은 자리를 읽는다. 못 읽는 줄은 버린다.
 *
 * **표를 가르는 셈은 `lib/table.ts` 하나다.** 여기도 탭만 읽고 있었는데,
 * AI 는 마크다운 표로 답하는 일이 잦아서 그런 답이 통째로 사라진다 —
 * 맞추기에서 실제로 그랬다 (2026-09-15).
 */
export function readShape(text: string): { where: string; should: number; why: string }[] {
  const out: { where: string; should: number; why: string }[] = []
  for (const [where, n, ...rest] of readRows(text)) {
    if (!where || where === '자리') continue
    const should = Number(String(n).replace(/[^0-9]/g, ''))
    if (!Number.isInteger(should) || should < 0) continue
    out.push({ where, should, why: rest.join(' ').trim() })
  }
  return out
}

/**
 * 짚은 것을 검산한다. **없는 자리와 안 바뀐 칸 수는 버린다** —
 * 앞쪽은 지어낸 것이고, 뒤쪽은 「다르다」고 해 놓고 같은 수를 적은 것이다.
 */
export function checkShape(
  found: { where: string; should: number; why: string }[],
  rows: ArrayRow[]
): { taken: ShapeFinding[]; refused: { where: string; why: string }[] } {
  const at = new Map(rows.map((r) => [r.path, r.n]))
  const taken: ShapeFinding[] = []
  const refused: { where: string; why: string }[] = []
  for (const f of found) {
    const now = at.get(f.where)
    if (now === undefined) {
      refused.push({ where: f.where, why: '베껴 온 값에 없는 자리입니다.' })
      continue
    }
    if (now === f.should) {
      refused.push({ where: f.where, why: `지금도 ${now}칸이라 다를 것이 없습니다.` })
      continue
    }
    if (taken.some((t) => t.where === f.where)) {
      refused.push({ where: f.where, why: '같은 자리를 두 번 짚었습니다.' })
      continue
    }
    taken.push({ where: f.where, now, should: f.should, why: f.why })
  }
  return { taken, refused }
}
