/**
 * **진행판에 놓은 기획서를 학습코드마다 나눠 넣는다** (2026-10-26).
 *
 * > *「기획서는 뭐 보고 알아서 나눠서 넣어놓는건 ㅇㅈ 그건 기능으로 냅둬도 되겠다 대신 설명은 해놔야할듯」* (2026-10-26)
 *
 * 진행판 놓는 칸은 이제 **기획서 PDF 만** 받는다. 리소스 · figma 화면 · 학습코드 폴더째 넣기(`sort.ts` `sortInbox`)는
 * 이름에 학습코드가 없으면 거의 다 못 가렸고(figma 프레임 이름도 영어만 안다) 그 일은 작업대가 학습코드 하나씩 한다.
 * `sortInbox` 는 forge 도구 `tool/inbox.ts` 가 불러 남는다.
 *
 * 가르는 일은 `sortpaper.ts` 의 `routePaper` 그대로다 — 1쪽 글을 읽어 수학 · 국어는 학습코드 리소스 폴더로, 영어는 공용 기획서로(국어는 파일 이름의 호 · 주도 본다).
 * 폴더를 놓으면 안까지 훑어 PDF 만 고른다(상한은 `rsccopy.ts` `gather`). PDF 가 아닌 것은 넣지 않고 수만 알린다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { basename } from 'node:path'
import type { SortedInbox } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { gather, type Found } from './rsccopy'
import { loadForge, type Forge } from './runtime'
import { routePaper } from './sortpaper'

export async function sortPlans(drops: string[], overwrite: boolean): Promise<SortedInbox> {
  const out: SortedInbox = { found: 0, truncated: false, lessons: [], papers: [], ask: [], failed: [], note: '' }
  let forge: Forge
  try {
    forge = await loadForge()
  } catch (error) {
    return { ...out, error: toMessage(error) }
  }

  const found: Found[] = []
  for (const one of drops) {
    try {
      if (gather(one, found)) out.truncated = true
    } catch {
      out.failed.push({ name: basename(one), from: one, why: '파일을 찾지 못했습니다.' })
    }
  }
  out.found = found.length

  let others = 0
  for (const f of found) {
    const routed = /\.pdf$/i.test(f.from) ? await routePaper(forge, f.from, overwrite) : null
    if (!routed) others += 1
    else if ('placed' in routed) out.papers.push(routed.placed)
    else out.ask.push(routed.hold)
  }
  out.note = summary(out, others)
  return out
}

/** 사람이 읽을 한 줄. 넣은 것과 이미 있던 것(`file` 이 빈 것)을 가른다 */
function summary(out: SortedInbox, others: number): string {
  const put = out.papers.filter((p) => p.file).length
  const had = out.papers.length - put
  const bits: string[] = []
  if (put) bits.push(`기획서 ${put}개를 넣었습니다.`)
  if (had) bits.push(`이미 있는 기획서 ${had}개는 건너뛰었습니다.`)
  if (out.ask.length) bits.push(`넣지 못한 기획서가 ${out.ask.length}개 있습니다.`)
  if (others) bits.push(`PDF 파일이 아닌 것 ${others}개는 넣지 않았습니다. 리소스와 figma 화면은 작업대에 넣으세요.`)
  if (out.failed.length) bits.push(`${out.failed.length}개는 찾지 못했습니다.`)
  if (out.truncated) bits.push('파일이 많아 일부만 확인했습니다.')
  return bits.join(' ') || '놓은 것에 파일이 없습니다.'
}
