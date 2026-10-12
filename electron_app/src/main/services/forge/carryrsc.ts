/**
 * **앞 호들이 똑같이 돌려 쓴 파일은 원본에서 가져온다** (2026-09-29).
 *
 * 9호 KOL1M08W1S3 에서 디자이너가 「안 바뀌는 파일」(나레이션 nar01 · 효과음 sfx03 · sfx05)을 빼고 주었다.
 * 앞 호 파일을 보니 2 · 4 · 7호가 **바이트까지 같은** 파일을 돌려 쓰고 있었다 — 사람이 「7호 것 복사해」로 풀었다.
 * `commonrsc.ts` 는 **모듈 완성본 전부가 같은 파일**일 때만 가져와서,
 * 판이 둘로 갈린 모듈(짝수 · 홀수 호)의 이런 파일은 못 가져왔다.
 * **새 판이 다른 이름으로 와 있으면 안 가져온다** — 9호 스티커를 7호 것으로 채웠다(forge `commonfresh.ts`, `commonrsc.ts` 와 한 셈).
 *
 * 여기 규칙은 좁다 —
 * - 원본 레시피가 쓰는 파일 가운데 **이번 폴더에 그 자리(같은 상대 경로)가 없는 것**만
 * - 원본 파일과 **바이트까지 같은 파일**이 다른 호의 **같은 칸 · 같은 자리**에 하나라도 더 있을 때만 — 돌려 쓰는 파일이라는 증거
 * - 이번 폴더에 아직 아무것도 없으면 안 한다(리소스가 안 왔다)
 * - 덮어쓰지 않는다. 복사 뒤 크기를 대조한다
 * 7호 `card_blur` · `book` 처럼 그 호에만 있는 그림은 안 가져온다 — 그대로 사람에게 묻는다.
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Forge } from './runtime'
import { talkBlocked } from './voice'
import type { Fresh } from '@/gen/commonfresh'

export type Carried = { took: string[]; failed: string[] }

const REPO = /^sparkon_m(\d\d)$/

/** 원본 레시피가 쓰는 파일 자리(`images/x.png`) — 갈래 폴더를 붙이는 셈은 forge `common.relOf` 하나다 */
function usedFiles(forge: Forge, recipe: unknown): string[] {
  return [...new Set(forge.common.relOf(recipe as Parameters<Forge['common']['relOf']>[0]).values())]
}

function same(a: string, b: string): boolean {
  try {
    const sa = fs.statSync(a)
    const sb = fs.statSync(b)
    return sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b))
  } catch {
    return false
  }
}

/**
 * 가져올 만한 자리 — 원본에 파일이 있고, 다른 호의 같은 칸 · 같은 자리에 **바이트까지 같은 것**이 있는 자리.
 * **고르기만 하고 복사하지 않는다** — 「받을 리소스」 창(`rscguide.ts`)이 「앱이 가져옵니다」를 가리려고 같이 본다.
 * `skip` 은 바이트를 견주기 전에 뺄 자리(이미 폴더에 있는 것) — 견주기가 제일 비싸다.
 */
export function carryable(
  forge: Forge,
  origin: string,
  code: string,
  recipe: unknown,
  skip?: (rel: string) => boolean
): { rel: string; src: string }[] {
  const from = forge.spec.parseStudyCode(origin)
  const me = forge.spec.parseStudyCode(code)
  if (!from || !me) return []
  const root = forge.paths.workRoot()
  const sparklab = (month: string, c: string): string => path.join(root, `sparkon_m${month}`, 'public', 'sparklab', c)
  const originDir = sparklab(String(from.month).padStart(2, '0'), from.code)
  // 같은 칸의 다른 호 폴더들 — 원본 호는 뺀다
  const others = fs
    .readdirSync(root)
    .map((d) => REPO.exec(d)?.[1])
    .filter((m): m is string => !!m && Number(m) !== from.month && Number(m) !== me.month)
    .map((m) => sparklab(m, `${me.subject}L${me.level}M${m}W${me.week}S${me.session}`))
    .filter((d) => fs.existsSync(d))

  // **대사는 성우 성별이 같을 때만** (2026-10-02, `voice.ts`) — 1호(남) 대사를 바이트가 같다고 9호(여)에 가져올 뻔했다
  const talk = talkBlocked(forge, code, origin, recipe)
  const out: { rel: string; src: string }[] = []
  for (const rel of usedFiles(forge, recipe)) {
    // 완성본의 로티는 `animation/` 폴더일 수 있다 — 새 폴더에는 레시피대로 `animations/` 로 넣는다 (forge `doneFile`)
    const src = forge.common.doneFile(originDir, rel)
    if (skip?.(rel) || talk.has(rel.toLowerCase()) || !fs.existsSync(src)) continue
    if (!others.some((d) => same(src, forge.common.doneFile(d, rel)))) continue
    out.push({ rel, src })
  }
  return out
}

export function carrySame(forge: Forge, origin: string, code: string, recipe: unknown, fresh?: Fresh): Carried {
  const out: Carried = { took: [], failed: [] }
  const target = forge.files.rscDir(code)
  if (!target || !fs.existsSync(target) || fs.readdirSync(target).length === 0) return out
  for (const { rel, src } of carryable(forge, origin, code, recipe, (rel) => fs.existsSync(path.join(target, rel)))) {
    if (fresh?.takes(src, rel)) continue // 다른 이름으로 새 판이 와 있다 (forge `commonfresh.ts`)
    const want = path.join(target, rel)
    try {
      fs.mkdirSync(path.dirname(want), { recursive: true })
      fs.copyFileSync(src, want, fs.constants.COPYFILE_EXCL)
      if (fs.statSync(want).size !== fs.statSync(src).size) throw new Error('복사한 파일의 크기가 원본과 다릅니다.')
      out.took.push(rel)
    } catch (error) {
      out.failed.push(`${rel}: ${(error as Error).message}`)
    }
  }
  return out
}

export function carryNote(r: Carried, origin: string): string {
  const bits: string[] = []
  if (r.took.length) bits.push(`앞 호들이 똑같이 쓴 파일 ${r.took.length}개를 원본 ${origin} 학습코드에서 가져왔습니다 (${r.took.slice(0, 3).join(', ')}${r.took.length > 3 ? ' …' : ''}).`)
  if (r.failed.length) bits.push(`파일 ${r.failed.length}개를 가져오지 못했습니다 (${r.failed[0]}).`)
  return bits.join(' ')
}
