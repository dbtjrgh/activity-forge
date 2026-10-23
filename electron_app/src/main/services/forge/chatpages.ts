/**
 * **대화로 만들기와 같은 배경 그림 짝** (2026-10-13, forge `gen/pagepairs.ts` 를 대화에 잇는 자리 — 인터북).
 *
 * 리소스 폴더의 1920×1080 그림마다 가장 덜 다른 짝과 다른 자리(모듈 좌표)를 재서 첫 지시와 답에 싣는다.
 * 9호 MAL2M08W1S1 이 별(누를 자리 표시)이 그려진 판으로 만들어져 별이 처음부터 떠 있었다 — 사용자 말 「같은 배경일 때
 * 어포던스 위치 있고 없고랑 이펙트 있고 없고의 차이를 구별 할 줄 알게」. 무엇이 다른지는 Claude 가 그 자리를 열어 가른다.
 *
 * 그림 스무 장에 3초쯤 걸린다(메인 스레드). 리소스 폴더 도장이 같으면 남긴 것(`_recipe/<코드>.pages.json`)을 읽는다.
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { PageNeeds } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { loadForge, type Forge } from './runtime'
import { stamp } from './stamp'

type Pages = ReturnType<Forge['pagepairs']['pagePairs']>

/** 리소스 폴더의 png — `_` 로 시작하는 폴더(figma 화면 · 기획서 · 대화 그림)는 뺀다 */
function pngsOf(rsc: string): { rel: string; file: string }[] {
  const out: { rel: string; file: string }[] = []
  const walk = (dir: string, rel: string): void => {
    let names: fs.Dirent[]
    try {
      names = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of names) {
      if (e.name.startsWith('_')) continue
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(path.join(dir, e.name), r)
      else if (e.name.toLowerCase().endsWith('.png')) out.push({ rel: r, file: path.join(dir, e.name) })
    }
  }
  walk(rsc, '')
  return out.sort((a, b) => a.rel.localeCompare(b.rel))
}

/** 잰 것 — 그림이 둘 밑이면 null. 처음 재는 것이면 `onSlow` 를 먼저 부른다 */
export function pagesOf(forge: Forge, code: string, rsc: string, onSlow: () => void = () => {}): Pages | null {
  const files = pngsOf(rsc)
  if (files.length < 2) return null
  // 셈의 꼴이 바뀌면 판(v3)을 올린다 — 별 · 아직 없는 판이 없던 때 남긴 것을 그대로 읽지 않게
  const key = ['v3', ...files.map((f) => `${f.rel}|${stamp(f.file)}`)].join('\n')
  const cache = path.join(forge.paths.REPO_ROOT, '_recipe', `${code}.pages.json`)
  try {
    const kept = JSON.parse(fs.readFileSync(cache, 'utf8')) as { key: string; pages: Pages }
    if (kept.key === key) return kept.pages
  } catch {
    // 처음이거나 못 읽음 — 다시 잰다
  }
  onSlow()
  const pages = forge.pagepairs.pagePairs(files)
  try {
    fs.mkdirSync(path.dirname(cache), { recursive: true })
    fs.writeFileSync(cache, JSON.stringify({ key, pages }))
  } catch {
    // 남기지 못해도 이번 결과는 쓴다
  }
  return pages
}

const pct = (n: number): string => `${Math.round(n * 100)}%`

/** 별을 찾은 것 · 아직 없는 판 — 첫 지시와 작업대 · 받을 리소스 창이 같은 셈을 본다 */
function starLines(p: Pages): string[] {
  if (!p.stars.length) return []
  return [
    '',
    '## 누를 자리 별 (앱이 그림에서 찾음)',
    'figma 그림에 그려진 별 자리의 가운데다(화면 가운데가 0,0). affPos 로 이 값을 쓴다. 별이 그려진 그림은 누르는 씬에 쓰지 않는다.',
    ...p.stars.map((s) => `- ${s.rel}: (${s.center.x}, ${s.center.y}), 별 크기 ${s.box.w}×${s.box.h}`),
    ...(p.needs.length
      ? [
          '',
          '## 아직 없는 판 (앱이 셈)',
          '이 판이 없으면 그 씬을 별이 그려진 그림으로 만들지 말고, 사람에게 이 목록 그대로 달라고 ask 로 묻는다.',
          ...p.needs.map((n) => `- ${n.rel}: ${n.missing.join(', ')}`)
        ]
      : [])
  ]
}

/** 첫 지시 · 답에 싣는 글 — 짝도 별도 없으면 빈 목록 */
export function pageLines(p: Pages | null): string[] {
  if (!p) return []
  if (!p.near.length && !p.same.length) return starLines(p)
  return [
    '',
    '## 같은 배경 그림 (앱이 픽셀로 견줌)',
    '리소스 폴더의 1920×1080 그림마다 가장 덜 다른 짝과 그 다른 자리다. 좌표는 다른 자리의 가운데이고 화면 가운데가 (0,0)이다.',
    '두 그림에서 그 자리를 열어 보고 무엇이 다른지(누를 자리 표시, 누른 뒤 효과, 바뀐 내용) 가른다. 어떻게 쓰는지는 모듈 스펙 설명(notes)을 따른다.',
    ...p.same.map(([a, b]) => `- ${a} 와 ${b} 는 픽셀까지 같다`),
    ...p.near.map(
      (n) =>
        `- ${n.a} ↔ ${n.b} (바뀐 칸 ${pct(n.ratio)}): ` +
        n.diffs.map((d) => `(${d.center.x}, ${d.center.y}) ${d.box.w}×${d.box.h}${d.more ? ` ${d.more} 쪽에 더 있음` : ''}, 노란색 ${pct(d.yellow)}`).join(' / ') +
        (n.cut ? ` 외 ${n.cut}곳` : '')
    ),
    ...starLines(p)
  ]
}

/**
 * 작업대 · 받을 리소스 창의 「인터북 그림」 — 학습코드만 받는다. 별이 없으면 `stars` 0(칸을 안 그린다).
 * 처음 재면 그림 스무 장에 4초쯤 메인을 붙잡는다 — 그 뒤로는 리소스 폴더가 바뀌기 전까지 남긴 것을 읽는다
 */
export async function pageNeedsOf(code: string): Promise<PageNeeds> {
  const none: PageNeeds = { stars: 0, needs: [], same: [] }
  try {
    const forge = await loadForge()
    const rsc = forge.files.rscDir(code)
    if (!rsc || !fs.existsSync(rsc)) return none
    const p = pagesOf(forge, code, rsc)
    if (!p) return none
    return { stars: p.stars.length, needs: p.needs.map((n) => ({ rel: n.rel, missing: [...n.missing] })), same: p.same }
  } catch (error) {
    return { ...none, error: toMessage(error) }
  }
}

/** 지난 차례 뒤 바뀐 파일에 그림이 있나 — 있으면 답에 다시 싣는다 */
export const picsMoved = (rels: string[]): boolean => rels.some((r) => !r.startsWith('_') && r.toLowerCase().endsWith('.png'))
