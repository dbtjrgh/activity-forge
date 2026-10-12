/**
 * **붙인 차례 바꾸기** (2026-10-02) — figma 화면은 붙인 차례가 곧 이닝 차례다(사용자 결정, `wholebrief.ts`).
 * 그런데 차례를 바꿀 길이 없어 잘못 붙이면 다 지우고 다시 붙여야 했다.
 *
 * 차례는 파일 이름(`screen-<날짜>-<시각>.png`)의 정렬이다(`pasted.ts` `listPaper`) — 그래서 **이웃한 두 장의 이름을 맞바꾼다.**
 * 1x 로 줄이기 전 것(`_원본/<같은 이름>`)도 같이 바꾼다. 리소스 폴더가 바뀌므로 통째로 맡긴 결과는 다음 생성에서 다시 만든다 — 맞다, 이닝 차례가 바뀌었다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ShotResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { listPaper, ruleOf, type Paper } from './pasted'
import { rscOf } from './shot'

function swap(a: string, b: string): void {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return
  const tmp = `${a}.swap`
  fs.renameSync(a, tmp)
  fs.renameSync(b, a)
  fs.renameSync(tmp, b)
}

/** `step` -1 은 앞으로, +1 은 뒤로 */
export async function movePaper(code: string, file: string, step: -1 | 1, kind: Paper = 'figma'): Promise<ShotResult> {
  try {
    const dir = await rscOf(code)
    if (!dir) return { file: '', note: '', error: '리소스 폴더 위치를 정하지 못했습니다.' }
    const list = listPaper(dir, kind)
    const at = list.indexOf(file)
    const to = at + step
    if (at < 0) return { file: '', note: '', error: '파일이 없습니다. 목록을 다시 불러오세요.' }
    if (to < 0 || to >= list.length) return { file, note: '' }
    const a = list[at] as string
    const b = list[to] as string
    // 확장자가 다르면(png · jpg) 이름만 맞바꾸면 확장자가 섞인다 — 같은 확장자끼리만
    if (path.extname(a) !== path.extname(b)) return { file: '', note: '', error: '형식이 다른 파일끼리는 차례를 바꿀 수 없습니다.' }
    swap(path.join(dir, a), path.join(dir, b))
    const keep = path.join(dir, ruleOf(kind).dir, '_원본')
    swap(path.join(keep, path.basename(a)), path.join(keep, path.basename(b)))
    return { file: b, note: `${at + 1}번째와 ${to + 1}번째의 차례를 바꿨습니다.` }
  } catch (error) {
    return { file: '', note: '', error: toMessage(error) }
  }
}
