/**
 * **완료 뒤 리소스 폴더 정리** — 기획서(`_plan`)만 남기고 나머지를 휴지통으로 (2026-10-12 사용자 요청 — 「앱에 완료 뒤 정리 단추로 넣어줘」).
 *
 * 리소스 폴더(`rscRoot/<코드>`)는 만들 때 쓰는 재료다. 완료해 호 저장소에 커밋하면 쓰인 파일은 호 저장소(`public/sparklab/<코드>`)에 있고,
 * 다음 학습코드는 원본 · 공용 파일을 호 저장소에서 가져온다(forge `rscOfDone`). 그때 리소스 폴더 49개가 776MB 였다.
 *
 * - **영어는 기획서를 남긴다** — 영어 다음 호의 모듈 고르기가 앞선 호 같은 자리의 기획서를 본다(`layoutasks.ts`). 수학 · 국어는 같이 옮긴다(2026-10-15)
 * - **빗장** — 개발 완료 · 내 것(남이 끝낸 것은 옮기지 않는다, `owner.ts`) · 대화가 안 도는 중 · 기다리는 대화 없음 · 호 저장소의 그 학습코드 두 자리에 커밋 안 한 것이 없음.
 *   개발 완료 표시만 믿지 않는다 — 대화로 다시 만들던 MAL3M08W2S3 도 그 표시가 있었다
 * - 리소스 자리를 안 정했으면(리소스 폴더가 곧 호 저장소 안) **하지 않는다** — 그것은 완성본 자체다
 * - 누른 때 다시 재고, **화면에 보인 항목과 겹치는 것만** 옮긴다(그새 넣은 파일은 사람이 못 봤다)
 * - 정리한 뒤 이 학습코드를 대화로 다시 만들려면 리소스를 다시 넣어야 한다 — 단추 설명에 적는다
 *
 * 2026-10-14 — 단추를 작업대 검수 칸에서 진행판 맨 위로 옮겼다(학습코드 전부를 한 번에, `rsccleanall.ts`). 학습코드 하나의 셈은 여기 그대로다.
 * 남이 끝낸 학습코드를 풀던 `force` 는 작업대 단추와 같이 걷었다 — 진행판은 늘 막는다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { LeftoverTrash, RscClean } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git, lines } from '../../lib/git'
import { toTrash } from '../../lib/trash'
import { chatHold } from './chatstore'
import { ownerLine, ownerOf } from './owner'
import { loadForge, type Forge } from './runtime'
import { repoOf } from './writecheck'

/**
 * 남기는 것 — 리소스 폴더 맨 위 이름. **영어만 기획서를 남긴다** — 앞선 호 기획서를 다시 읽는 것은 영어 모듈 고르기(`layoutasks.ts`)뿐이다.
 * 수학 · 국어도 남겼더니 다 끝낸 학습코드 폴더마다 기획서만 3.8MB 씩 남아, 사람이 「기획서는 왜 정리 못해?」라고 물었다(2026-10-15)
 */
const keepOf = (code: string): Set<string> => new Set(code.startsWith('EN') ? ['_plan'] : [])
const T = 30_000

/** 파일 · 폴더 크기(바이트). 못 읽은 것은 0 */
function sizeOf(p: string): number {
  try {
    const st = fs.statSync(p)
    if (!st.isDirectory()) return st.size
    return fs.readdirSync(p).reduce((n, name) => n + sizeOf(path.join(p, name)), 0)
  } catch {
    return 0
  }
}

/** 옮길 수 없는 까닭 한 문장 — 비면 옮길 수 있다 */
async function blocked(forge: Forge, code: string, dir: string, repo: string): Promise<string> {
  const inRepo = path.relative(repo, dir)
  if (!inRepo.startsWith('..') && !path.isAbsolute(inRepo)) return '리소스 폴더가 호 저장소 안에 있어 정리하지 않습니다.'
  const o = ownerOf(forge, code)
  if (o.finished !== true) return '검수 완료를 한 뒤에 정리할 수 있습니다.'
  if (o.theirs) return `${ownerLine(o)} 리소스 폴더를 정리하지 않습니다.`
  const hold = chatHold(forge.paths.REPO_ROOT, code)
  if (hold === 'busy') return '생성 중에는 정리할 수 없습니다.'
  if (hold === 'waiting') return '대화가 답을 기다리고 있어 정리할 수 없습니다.'
  const dirty = lines(
    await git(repo, ['--no-optional-locks', '-c', 'core.quotepath=false', 'status', '--porcelain', '--', `src/activity/${code}`, `public/sparklab/${code}`], T)
  )
  if (dirty.length) return '호 저장소에 커밋하지 않은 변경이 있습니다. 양산 완료 커밋을 한 뒤에 정리하세요.'
  return ''
}

export async function rscCleanPlan(code: string): Promise<RscClean> {
  try {
    const forge = await loadForge()
    const dir = forge.files.rscDir(code) ?? ''
    const repo = repoOf(forge.paths, code)
    if (!repo) return { dir, finished: false, entries: [], why: '', error: '호 저장소 위치를 정하지 못했습니다.' }
    const finished = ownerOf(forge, code).finished === true
    if (!dir || !fs.existsSync(dir)) return { dir, finished, entries: [], why: '' }
    const keep = keepOf(code)
    const entries = fs
      .readdirSync(dir)
      .filter((name) => !keep.has(name))
      .map((name) => ({ name, size: sizeOf(path.join(dir, name)) }))
    return { dir, finished, entries, why: entries.length ? await blocked(forge, code, dir, repo) : '' }
  } catch (error) {
    return { dir: '', finished: false, entries: [], why: '', error: toMessage(error) }
  }
}

/** 다시 재고 **화면에 보인 항목(`shown`)과 겹치는 것만** 휴지통으로. 하나가 안 돼도 나머지는 옮기고, 안 된 것을 알린다 */
export async function cleanRsc(code: string, shown: string[]): Promise<LeftoverTrash> {
  const out: LeftoverTrash = { moved: [], failed: [] }
  const now = await rscCleanPlan(code)
  if (now.error || now.why) return { ...out, error: now.error ?? now.why }
  const seen = new Set(shown)
  for (const e of now.entries.filter((x) => seen.has(x.name))) {
    try {
      await toTrash(path.join(now.dir, e.name))
      out.moved.push(e.name)
    } catch (error) {
      out.failed.push({ rel: e.name, why: toMessage(error) })
    }
  }
  return out
}
