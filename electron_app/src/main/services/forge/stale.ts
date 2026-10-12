/**
 * **반영한 뒤 바뀐 것이 있나** (2026-10-02 사용자 말 — 캔 조각 그림에 테두리를 넣고 「반영했어」 했는데 안 갔다).
 *
 * 반영한 학습코드는 순서 막대가 「저장소에 반영 ✓」로 남고 단추도 숨는다. 그 뒤에 리소스 그림을 바꾸거나 답을 고쳐도
 * 다시 반영하라는 말이 없어, 사람은 반영한 줄 알았다. 그래서 만들어 본 결과(`--dry`)를 호 저장소에 있는 것과 비교한다 —
 *
 *   - 액티비티 파일: 만들어 본 글과 호 저장소의 파일 글. 줄바꿈은 LF 로 맞춰 본다(git 이 꺼낸 파일은 CRLF 다).
 *     `activityInfo.json` 은 안 본다 — 「검수 완료」가 개발 완료 · 이름 · 날짜를 거기 적어 늘 다르다
 *   - 리소스: 리소스 폴더를 호 저장소 밖에 둘 때만. 레시피가 쓰는 파일마다 호 저장소의 사본과 바이트로(`rsccopy.ts` 와 같은 셈)
 *
 * 걸음이 아니다(걸음 이름은 얼렸다) — 결과에 붙는 계산 하나다. Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { RunResult } from '../../../shared/forge'
import { sameBytes } from './rsccopy'
import type { Forge } from './runtime'
import { repoOf } from './writecheck'
import { usedFiles } from './writeside'

const SKIP = new Set(['activityinfo.json'])

const lf = (s: string): string => s.replace(/\r\n/g, '\n')

/** 호 저장소에 이 액티비티가 아직 없으면 null — 새로 만드는 것은 「다시」가 아니다 */
export function staleOf(forge: Forge, code: string, preview: Record<string, string>, recipe: unknown): RunResult['stale'] {
  const repo = repoOf(forge.paths, code)
  const act = repo ? join(repo, 'src', 'activity', code) : ''
  if (!act || !existsSync(act)) return undefined
  const files = Object.entries(preview)
    .filter(([name]) => !SKIP.has(name.toLowerCase()))
    .filter(([name, text]) => {
      try {
        return lf(readFileSync(join(act, name), 'utf8')) !== lf(text)
      } catch {
        return true
      }
    })
    .map(([name]) => name)

  const rsc: string[] = []
  const dir = forge.files.rscDir(code)
  const hall = join(repo, 'public', 'sparklab', code)
  if (dir && join(dir) !== hall && existsSync(dir)) {
    for (const rel of usedFiles(forge, recipe)) {
      const from = join(dir, rel)
      if (!existsSync(from)) continue
      const to = join(hall, rel)
      if (!existsSync(to) || !sameBytes(to, from, statSync(to).size, statSync(from).size)) rsc.push(rel)
    }
  }
  return { files, rsc }
}
