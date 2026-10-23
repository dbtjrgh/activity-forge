/**
 * **처음 설정의 점검표 — 받아 둘 저장소** (2026-10-16, 사용자 결정 — 「저장소는 전부 사람이 git 으로 받는다」).
 *
 * 공용 둘(resource_common · sparkon_common) · sparkon_cli · 호 저장소(sparkon_mNN)가 작업 폴더에 있나만 잰다. **받지 않는다.**
 * 없으면 받을 명령 한 줄(`git clone <주소> "<작업 폴더>\<이름>"` — 어디서 쳐도 그 자리로 받는다)을 보인다.
 * - 「있다」는 폴더 이름을 믿지 않는다 — `.git` 이 있고 HEAD 를 읽어야 한다(받다 만 것을 걸러 낸다)
 * - resource_common 은 그 안의 common · font · landing 까지 — `sparkon link` 가 이 셋에 정션을 건다
 * - 「설정 완료」는 공용 둘 · sparkon_cli · 호 하나 이상이 있을 때만(`link_activity` 가 호 폴더와 sparkon_common 을 본다)
 * 디스크가 정본이다 — 기록 파일을 두지 않고 누를 때마다 다시 잰다. 읽기만 한다. Electron 을 import 하지 않는다.
 */

import { existsSync, readdirSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { HO_OF, SETUP_FORGE_DIR, SETUP_RSC_DIR, hoLabel, hoOrder, type SetupRepo, type WorkPick } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { tryGit } from '../../lib/git'
import { looksLikeForge } from './home'
import { CLI_DIR } from './sparkoncli'

/** 팀 저장소 주소 — sparkon CLI(`src/index.ts` 의 git_addr)와 이 PC 저장소들의 origin 이 같다 */
const SPARKON_GIT = 'https://git.example.com/your-org'
export const repoUrl = (name: string): string => `${SPARKON_GIT}/${name}.git`

export const HALL = /^sparkon_m(\d\d)$/
const COMMONS = ['resource_common', 'sparkon_common']
/** `sparkon link` 가 정션을 거는 resource_common 안 폴더 */
const RSC_PARTS = ['common', 'font', 'landing']
const T = 15_000

async function repoAt(work: string, name: string, kind: SetupRepo['kind']): Promise<SetupRepo> {
  const dir = join(work, name)
  const m = HALL.exec(name)
  const out: SetupRepo = { name, kind, have: false, command: `git clone ${repoUrl(name)} "${dir}"`, ...(m ? { label: hoLabel(m[1] as string) } : {}) }
  if (!existsSync(dir)) return out
  if (!existsSync(join(dir, '.git'))) return { ...out, why: '폴더가 git 저장소가 아니니 폴더 이름을 바꾼 뒤 다시 받으세요.' }
  if (!(await tryGit(dir, ['rev-parse', '--verify', '-q', 'HEAD'], T)).ok) {
    return { ...out, why: '받다 만 저장소이니 폴더 이름을 바꾼 뒤 다시 받으세요.' }
  }
  const branch = (await tryGit(dir, ['branch', '--show-current'], T)).out.trim()
  if (name === 'resource_common') {
    const lost = RSC_PARTS.filter((p) => !existsSync(join(dir, p)))
    if (lost.length) return { ...out, branch, why: `resource_common 안에 ${lost.join(', ')} 폴더가 없습니다.` }
  }
  return { ...out, have: true, branch }
}

/** 호 저장소 이름 — 이름이 정해진 호(HO_OF) 전부와 폴더에 있는 것, 호 차례로 */
function hallNames(work: string): string[] {
  let onDisk: string[] = []
  try {
    onDisk = readdirSync(work, { withFileTypes: true })
      .filter((d) => d.isDirectory() && HALL.test(d.name))
      .map((d) => d.name)
  } catch {
    // 못 읽으면 아래 inspectWork 가 까닭을 말한다
  }
  const all = new Set([...Object.keys(HO_OF).map((m) => `sparkon_m${m}`), ...onDisk])
  return [...all].sort((a, b) => hoOrder(a.slice(-2)) - hoOrder(b.slice(-2)))
}

/** 고른 폴더를 잰다 — 호가 0개여도 거부하지 않고 점검표를 돌려준다 */
export async function inspectWork(dir: string): Promise<WorkPick> {
  const clean = dir.trim()
  const forgeDir = join(clean, SETUP_FORGE_DIR)
  const rscDir = join(clean, SETUP_RSC_DIR)
  const out: WorkPick = { dir: clean, repos: [], ready: false, missing: '', forgeDir, forgeReady: false, rscDir, rscReady: false }
  if (!clean || !isAbsolute(clean)) return { ...out, error: '폴더를 선택하세요.' }
  if (clean.startsWith('\\\\')) return { ...out, error: '네트워크 폴더는 쓸 수 없으니 내 컴퓨터의 폴더를 선택하세요.' }
  try {
    readdirSync(clean)
  } catch (error) {
    return { ...out, error: `선택한 폴더를 읽지 못했습니다. ${toMessage(error)}` }
  }
  out.repos = await Promise.all([
    ...COMMONS.map((n) => repoAt(clean, n, 'common')),
    repoAt(clean, CLI_DIR, 'cli'),
    ...hallNames(clean).map((n) => repoAt(clean, n, 'hall'))
  ])
  out.forgeReady = looksLikeForge(join(forgeDir, 'forge'))
  out.rscReady = existsSync(rscDir)
  const lack = out.repos.filter((r) => r.kind !== 'hall' && !r.have).map((r) => r.name)
  if (!out.repos.some((r) => r.kind === 'hall' && r.have)) lack.push('호 저장소 하나 이상')
  out.ready = lack.length === 0
  // 받는 법(명령 복사 · 「다시 확인」)은 점검표 머리 글이 말한다 — 여기는 한 문장
  out.missing = lack.length ? `아직 받지 않은 저장소가 있습니다(${lack.join(', ')}).` : ''
  return out
}
