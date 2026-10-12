/**
 * **완료 뒤 리소스 폴더 정리** — 기획서(`_plan`)만 남기고 나머지를 휴지통으로 (2026-10-12 사용자 요청 — 「앱에 완료 뒤 정리 단추로 넣어줘」).
 *
 * 리소스 폴더(`rscRoot/<코드>`)는 만들 때 쓰는 재료다. 완료해 호 저장소에 커밋하면 쓰인 파일은 호 저장소(`public/sparklab/<코드>`)에 있고,
 * 다음 학습코드는 원본 · 공용 파일을 호 저장소에서 가져온다(forge `rscOfDone`). 그때 리소스 폴더 49개가 776MB 였다.
 *
 * - **기획서는 남긴다** — 영어 다음 호의 모듈 고르기가 앞선 호 같은 자리의 기획서를 본다(`layoutasks.ts`)
 * - **빗장** — 개발 완료 · 우리 팀 · 대화가 안 도는 중 · 기다리는 대화 없음 · 호 저장소의 그 학습코드 두 자리에 커밋 안 한 것이 없음.
 *   개발 완료 표시만 믿지 않는다 — 대화로 다시 만들던 MAL3M08W2S3 도 그 표시가 있었다
 * - 리소스 자리를 안 정했으면(리소스 폴더가 곧 호 저장소 안) **하지 않는다** — 그것은 완성본 자체다
 * - 누른 때 다시 재고, **화면에 보인 항목과 겹치는 것만** 옮긴다(그새 넣은 파일은 사람이 못 봤다)
 * - 정리한 뒤 이 학습코드를 대화로 다시 만들려면 리소스를 다시 넣어야 한다 — 단추 설명에 적는다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import { chatWaiting, type LeftoverTrash, type RscClean } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git, lines } from '../../lib/git'
import { toTrash } from '../../lib/trash'
import { chatBusy, infoOf, readChat } from './chatstore'
import { loadForge, type Forge } from './runtime'
import { repoOf } from './writecheck'

/** 남기는 것 — 리소스 폴더 맨 위 이름 */
const KEEP = new Set(['_plan'])
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

function infoOfAct(repo: string, code: string): { devFinished?: unknown; devTeam?: unknown } | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(repo, 'src', 'activity', code, 'activityInfo.json'), 'utf8')) as { devFinished?: unknown; devTeam?: unknown }
  } catch {
    return null
  }
}

/** 옮길 수 없는 까닭 한 문장 — 비면 옮길 수 있다 */
async function blocked(forge: Forge, code: string, dir: string, repo: string): Promise<string> {
  const inRepo = path.relative(repo, dir)
  if (!inRepo.startsWith('..') && !path.isAbsolute(inRepo)) return '리소스 폴더가 호 저장소 안에 있어 정리하지 않습니다.'
  const info = infoOfAct(repo, code)
  if (info?.devFinished !== true) return '검수 완료를 한 뒤에 정리할 수 있습니다.'
  if (info.devTeam !== forge.user.loadUser().devTeam) return `${String(info.devTeam)} 담당 액티비티라 정리하지 않습니다.`
  if (chatBusy(code)) return '생성 중에는 정리할 수 없습니다.'
  // 파일에 「도는 중」으로 남았는데 이 앱에서 안 도는 것은 `readChat` 이 「멈춤」으로 읽는다 — 그것도 기다리는 대화로 막힌다
  if (chatWaiting(infoOf(readChat(forge.paths.REPO_ROOT, code)))) return '대화가 답을 기다리고 있어 정리할 수 없습니다.'
  const dirty = lines(
    await git(repo, ['-c', 'core.quotepath=false', 'status', '--porcelain', '--', `src/activity/${code}`, `public/sparklab/${code}`], T)
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
    const finished = infoOfAct(repo, code)?.devFinished === true
    if (!dir || !fs.existsSync(dir)) return { dir, finished, entries: [], why: '' }
    const entries = fs
      .readdirSync(dir)
      .filter((name) => !KEEP.has(name))
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
