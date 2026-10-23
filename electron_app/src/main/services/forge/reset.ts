/**
 * **학습코드 초기화** — 이 학습코드에 넣은 것과 만든 것을 휴지통으로 보내고 처음으로 돌린다 (2026-10-13 사용자 요청 —
 * MAL2M08W1S1 리소스를 MAL1M08W1S1 작업대에 넣고 대화까지 돌려 「꼬였는데 이걸 초기화 할 방법도 해놔야할듯」).
 *
 * 옮기는 것 셋:
 * - 리소스 폴더(`rscRoot/<코드>`) 통째로 — 리소스 자리를 안 정해 그 폴더가 호 저장소 안이면 아래 호 저장소 쪽이 본다
 * - 양산기 `_recipe/<코드>.*` — 대화 기록 · 입력 기록(`run.json`) · 가져온 파일 기록(`carried.json`) 같은 것
 * - 호 저장소 그 학습코드 두 자리(`src/activity/<코드>` · `public/sparklab/<코드>`)의 **커밋 안 한 변경** —
 *   바뀐 파일은 지금 것을 휴지통에 두고 마지막 커밋으로 되돌리고, 새 파일은 휴지통으로. **커밋한 것은 안 건드린다**
 *
 * - **빗장** — 생성 중 · 개발 완료로 커밋한 학습코드 · 다른 팀 학습코드는 안 한다. 남이 끝낸 학습코드는 「그래도 고치기」(`force`)로만 한다 —
 *   그때는 남이 개발 완료로 커밋한 것도 초기화한다(커밋한 것은 어차피 안 건드리고, 지우는 것은 내가 넣고 만든 것뿐이다). 내가 끝낸 것은 `force` 로도 안 한다(`owner.ts`)
 * - 누른 때 다시 재고 **화면에 보인 항목과 겹치는 것만** 옮긴다(`rscclean.ts` 와 같은 꼴 — 그새 넣은 파일은 사람이 못 봤다)
 * - 배치표의 원본 선택은 그대로 둔다 — 「원본 변경」에서 되돌린다
 * - 공용 파일과 앞 호에서 돌려 쓰는 파일은 다음에 대화를 시작할 때 앱이 다시 가져온다(`chatprep.ts`)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { CodeReset, LeftoverTrash } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { git } from '../../lib/git'
import { toTrash } from '../../lib/trash'
import { dropChatCtx } from './chat'
import { chatBusy, forgetChat } from './chatstore'
import { committedInfo, otherTeam, ownerFrom, ownerLine, ownerOf } from './owner'
import { loadForge, type Forge } from './runtime'
import { repoOf } from './writecheck'

const T = 30_000

/** 폴더 안 파일 수와 크기(바이트). 못 읽은 것은 건너뛴다 */
function walk(dir: string): { files: number; size: number } {
  let files = 0
  let size = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      const r = walk(p)
      files += r.files
      size += r.size
      continue
    }
    files += 1
    try {
      size += fs.statSync(p).size
    } catch {
      // 크기만 모른다
    }
  }
  return { files, size }
}

/**
 * 그 학습코드 두 자리의 커밋 안 한 변경 — `-z` 로 받아 띄어쓰기 · 한글 이름을 그대로 둔다.
 * 새 파일(`??`) · 색인에 새로 올린 파일(`A`)은 지우는 쪽, 나머지는 되돌리는 쪽. 옮긴 것(`R`)은 새 이름을 지우고 옛 이름을 되돌린다
 */
async function hallChanges(repo: string, code: string): Promise<CodeReset['hall']> {
  const out = await git(repo, ['-c', 'core.quotepath=false', 'status', '--porcelain', '-z', '--untracked-files=all', '--', `src/activity/${code}`, `public/sparklab/${code}`], T)
  const parts = out.split('\0')
  const list: CodeReset['hall'] = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] ?? ''
    if (p.length < 4) continue
    const x = p[0]
    const rel = p.slice(3)
    if (x === 'R' || x === 'C') {
      // `-z` 에서는 옛 이름이 다음 칸에 온다
      const old = parts[++i] ?? ''
      list.push({ rel, how: 'remove' })
      if (x === 'R' && old) list.push({ rel: old, how: 'restore' })
      continue
    }
    list.push({ rel, how: p.startsWith('??') || x === 'A' ? 'remove' : 'restore' })
  }
  return list
}

async function blocked(forge: Forge, code: string, repo: string, force: boolean): Promise<string> {
  if (chatBusy(code)) return '생성 중에는 초기화할 수 없습니다. 멈춘 뒤 다시 누르세요.'
  const now = ownerOf(forge, code)
  if (now.theirs && !force) return `${ownerLine(now)} 초기화하지 않습니다.`
  // 마지막 커밋의 것 — 지금 파일은 검수 완료를 잘못 눌렀어도 되돌릴 대상이라 커밋한 것을 본다
  const user = forge.user.loadUser()
  const was = ownerFrom(await committedInfo(repo, code), user)
  if (was.finished === true && !(force && was.theirs)) return '개발 완료로 커밋한 학습코드는 초기화하지 않습니다.'
  const team = otherTeam(was, user.devTeam)
  return team ? `${team} 담당 액티비티라 초기화하지 않습니다.` : ''
}

const recipeDir = (forge: Forge): string => path.join(forge.paths.REPO_ROOT, '_recipe')

/** 새 파일을 치워 빈 폴더가 남으면 그 학습코드 자리(`src/activity/<코드>` · `public/sparklab/<코드>`) 안에서만 위로 지운다 — 빈 폴더만 */
function pruneEmpty(repo: string, relDir: string): void {
  let rel = relDir.split(path.sep).join('/')
  while (rel.split('/').length > 3) {
    try {
      fs.rmdirSync(path.join(repo, rel))
    } catch {
      return
    }
    rel = path.posix.dirname(rel)
  }
}

export async function resetPlan(code: string, force = false): Promise<CodeReset> {
  const none: CodeReset = { rsc: null, recipe: [], hall: [], why: '' }
  try {
    const forge = await loadForge()
    const repo = repoOf(forge.paths, code)
    if (!repo || !fs.existsSync(repo)) return { ...none, error: '호 저장소 위치를 정하지 못했습니다.' }
    const dir = forge.files.rscDir(code) ?? ''
    const inRepo = dir ? path.relative(repo, dir) : ''
    const outside = Boolean(dir) && (inRepo.startsWith('..') || path.isAbsolute(inRepo))
    const rsc = outside && fs.existsSync(dir) ? { dir, ...walk(dir) } : null
    const rd = recipeDir(forge)
    const recipe = fs.existsSync(rd) ? fs.readdirSync(rd).filter((n) => n.startsWith(`${code}.`)).sort() : []
    const hall = await hallChanges(repo, code)
    return { rsc, recipe, hall, why: await blocked(forge, code, repo, force) }
  } catch (error) {
    return { ...none, error: toMessage(error) }
  }
}

/** 다시 재고 **화면에 보인 열쇠(`shown`, `resetKeys`)와 겹치는 것만** 옮긴다. 하나가 안 돼도 나머지는 하고, 안 된 것을 알린다 */
export async function resetCode(code: string, shown: string[], force = false): Promise<LeftoverTrash> {
  const out: LeftoverTrash = { moved: [], failed: [] }
  const now = await resetPlan(code, force)
  if (now.error || now.why) return { ...out, error: now.error ?? now.why }
  const seen = new Set(shown)
  const forge = await loadForge()
  const repo = repoOf(forge.paths, code)
  const trash = async (file: string, label: string): Promise<boolean> => {
    try {
      if (fs.existsSync(file)) await toTrash(file)
      return true
    } catch (error) {
      out.failed.push({ rel: label, why: toMessage(error) })
      return false
    }
  }

  // 1. 호 저장소 — 새 파일은 색인에서 빼고 휴지통으로
  const hall = now.hall.filter((h) => seen.has(`hall:${h.rel}`))
  const removes = hall.filter((h) => h.how === 'remove').map((h) => h.rel)
  if (removes.length) {
    try {
      await git(repo, ['rm', '--cached', '-q', '--ignore-unmatch', '--', ...removes], T)
    } catch (error) {
      out.failed.push({ rel: removes.join(', '), why: `색인에서 빼지 못했습니다(${toMessage(error)})` })
    }
  }
  for (const rel of removes) {
    if (!(await trash(path.join(repo, rel), rel))) continue
    out.moved.push(rel)
    pruneEmpty(repo, path.dirname(rel))
  }
  // 바뀐 파일은 지금 것을 휴지통에 둔 뒤 마지막 커밋으로 — 되돌린 것만 「옮김」으로 센다
  const restores: string[] = []
  for (const h of hall.filter((x) => x.how === 'restore')) if (await trash(path.join(repo, h.rel), h.rel)) restores.push(h.rel)
  if (restores.length) {
    try {
      await git(repo, ['checkout', 'HEAD', '--', ...restores], T)
      out.moved.push(...restores)
    } catch (error) {
      for (const rel of restores) out.failed.push({ rel, why: `마지막 커밋으로 되돌리지 못했습니다(${toMessage(error)})` })
    }
  }

  // 2. 양산기 기록 — 이 앱이 들고 있던 대화 준비도 버린다
  for (const n of now.recipe.filter((x) => seen.has(`recipe:${x}`))) {
    if (await trash(path.join(recipeDir(forge), n), `_recipe/${n}`)) out.moved.push(`_recipe/${n}`)
  }
  dropChatCtx(code)
  forgetChat(forge.paths.REPO_ROOT, code)

  // 3. 리소스 폴더 통째로
  if (now.rsc && seen.has('rsc') && (await trash(now.rsc.dir, now.rsc.dir))) out.moved.push(now.rsc.dir)
  return out
}
