/**
 * **올라간 그림이 이번 호 것인가** — 반영한 뒤 호 저장소의 그림을 원본 호 그림과 바이트로 견준다 (2026-09-30).
 *
 * 9호 KOL1M08W1S3 에 7호 스티커 15장이 오류도 질문도 없이 올라갔다(`_document/함정.md` 「공용 가져오기는…」).
 * 사용자 규칙 — 「반영한 뒤에는 미리보기 콘솔 오류 0 과 올라간 그림이 이번 호 것인지 확인한다」.
 * 콘솔 오류는 미리보기 창이 모은다(`PreviewIssues.tsx`). 여기는 뒤엣것 —
 *
 * **앞 호 그림이 그대로 올라갔는데, 리소스 폴더에 같은 크기의 안 쓴 그림이 남아 있으면** 적는다.
 * 앞 호와 같은 것만으로는 안 된다 — 단추 · 틀처럼 늘 같은 그림(공용 · 돌려 쓴 파일)이 다 걸린다.
 * 그렇다고 공용을 빼면 **바로 그 사고가 빠진다** — 스티커는 2 · 4 · 7호가 같아 공용으로 잡혀 있었다(재 봤다).
 * 「같은 크기로 새 판이 와 있는데 안 썼다」가 그 사고의 모양이다(forge `commonfresh.ts` 가 막는 것과 같은 셈).
 * 막지 않는다 — 사람이 보고 가를 목록이다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import type { Forge } from './runtime'

type Rel = Parameters<Forge['common']['relOf']>[0]

export function samePictures(forge: Forge, code: string, origin: string, recipe: unknown, dest: string): string[] {
  const now = forge.common.relOf(recipe as Rel)
  const was = forge.common.fileOf(origin)
  const originDir = forge.common.rscOfDone(origin)
  // 리소스 폴더에 남은(안 쓴) png 의 크기
  const src = forge.files.rscDir(code) ?? ''
  const used = new Set([...now.values()].map((r) => r.toLowerCase()))
  const spare = new Set<string>()
  for (const rel of forge.commonfresh.walkPng(src)) {
    if (used.has(rel.toLowerCase())) continue
    const s = forge.png.pngSize(path.join(src, rel))
    if (s) spare.add(`${s.w}x${s.h}`)
  }
  if (!spare.size) return []
  const out: string[] = []
  for (const [slot, rel] of now) {
    const old = was.get(slot)
    if (!slot.startsWith('image|') || !old) continue
    const file = path.join(dest, rel)
    const a = forge.common.printOf(file)
    if (!a || a !== forge.common.printOf(path.join(originDir, old))) continue
    const s = forge.png.pngSize(file)
    if (s && spare.has(`${s.w}x${s.h}`)) out.push(rel.replace(/^images\//, ''))
  }
  return out
}

/** 걸음 글에 붙일 한 토막 */
export function sameNote(list: string[], origin: string): string {
  if (!list.length) return ''
  return `${origin} 학습코드의 그림이 그대로 올라갔는데, 폴더에 같은 크기의 쓰지 않은 그림이 ${list.length}장 있습니다(${list.slice(0, 4).join(', ')}${list.length > 4 ? ' …' : ''}). 이번 호 그림이 맞는지 확인하세요.`
}
