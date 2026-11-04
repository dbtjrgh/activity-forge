/**
 * **대화로 만든 뒤 앱이 하는 일** (2026-10-08, `chat.ts`) — 리소스 복사 · 없는 파일 · 타입 검사 · 스펙 검사.
 *
 * - **리소스 복사** — Claude 가 끝 덩어리 `files` 에 적은 대로 리소스 폴더 → 호 저장소 `public/sparklab/<코드>`.
 *   Claude 에게 셸을 안 열어서 복사는 앱이 한다. 두 경로 다 제 폴더 밖을 가리키면 안 한다. 복사 뒤 크기를 대조한다
 * - **없는 파일** — 쓴 AssetTable 을 forge 가 다시 읽어(`api.clone`) 가리키는 파일이 호 저장소에 다 있나 본다.
 *   **대소문자까지 같은 이름으로** 본다 — Windows 는 대소문자를 안 가려 통과하고 서버(리눅스)에서 404 가 난다.
 *   로티 폴더는 AssetTable 의 경로 상수(`animation/` · `animations/`)를 따른다 — 레시피는 늘 `animations/` 로 읽는다
 * - **타입 검사(막음)** — 호 저장소 전체 `vue-tsc --noEmit`(`halltsc.ts`). **이 학습코드 폴더에서 난 오류만** 막는다 — 남의 폴더 오류는 우리 탓이 아니다.
 *   공용 모듈 오류는 막지 않고 실어 둔다(`common`, 화면이 경고) · 잰 시각(`at`)을 같이 남긴다 — 찍어 둔 결과라 스펙을 고쳐도 옛 결과가 보였다
 * - **받았는데 안 쓴 리소스(참고)** — 리소스 폴더에 왔는데 AssetTable 이 안 부르는 파일(`pubfiles.ts` `unusedRsc`). 9호 MAL2M08W1S3 의 새 정답 파티클이 그렇게 빠졌다
 * - **다른 호에서만 쓰던 녹음(참고)** — 원본에서 그대로 가져온 그 호 전용 녹음(`chatforeign.ts`)
 * - **스펙 검사(참고)** — 2026-10-08 사용자 결정으로 막지 않는다. 리소스 파일 검사(`asset-file-*`)는 뺀다 — 호 저장소가 아니라 리소스 폴더를 봐서 틀리게 나온다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ChatChecks } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import type { ChatFile } from './chatbrief'
import { foreignSounds } from './chatforeign'
import { identCheck } from './chatident'
import type { ChatCtx } from './chatprep'
import { hallTsc } from './halltsc'
import { listPub, unusedRsc, wantOf } from './pubfiles'
import type { Forge } from './runtime'

/** `base` 안에 머무는 경로인가 — `..` 로 밖을 가리키면 null */
function inside(base: string, rel: string): string | null {
  const full = path.resolve(base, rel)
  const r = path.relative(base, full)
  return r && !r.startsWith('..') && !path.isAbsolute(r) ? full : null
}

/**
 * 가져올 파일 — 리소스 폴더 안 상대 경로, 또는 리소스 폴더 · 원본 · 같은 모듈 완성본 리소스 폴더 안의 전체 경로.
 * 앞 호 틀 그림(타자기 · 자판)은 호마다 같은 파일을 돌려 썼다 — M07 대화도 바이트를 견줘 앞 호에서 가져왔다.
 * 리소스 폴더도 전체 경로로 받는다 — 붙인 그림은 브리프가 전체 경로로 준다
 */
function sourceOf(ctx: ChatCtx, from: string): string | null {
  if (!path.isAbsolute(from)) return inside(ctx.rsc, from)
  // 기획서가 다른 모듈을 적었으면 그 모듈 완성본 리소스도(`chatmodule.ts`)
  for (const d of [ctx.rsc, ctx.origin.rsc, ...ctx.others.map((o) => o.rsc), ...(ctx.planModule?.dones ?? []).map((o) => o.rsc)]) {
    const hit = inside(d, path.relative(d, path.resolve(from)))
    if (hit) return hit
  }
  return null
}

/** 그 자리에 대소문자만 다른 파일이 있으면 이름부터 맞춘다 — 덮어써도 옛 이름이 남는다(NTFS) */
function matchCase(dst: string): void {
  if (!fs.existsSync(dst)) return
  const name = path.basename(dst)
  const real = fs.readdirSync(path.dirname(dst)).find((n) => n.toLowerCase() === name.toLowerCase())
  if (real && real !== name) fs.renameSync(path.join(path.dirname(dst), real), dst)
}

function copyAll(ctx: ChatCtx, files: ChatFile[]): { copied: number; failed: string[] } {
  let copied = 0
  const failed: string[] = []
  for (const f of files) {
    const src = sourceOf(ctx, f.from)
    const dst = inside(ctx.pub, f.to)
    if (!src) {
      failed.push(`${f.from} → ${f.to}: 가져올 수 있는 폴더 밖입니다. 리소스 폴더 안 상대 경로나 원본 · 같은 모듈 완성본 리소스의 전체 경로로 적어야 합니다.`)
      continue
    }
    if (!dst) {
      failed.push(`${f.from} → ${f.to}: 놓을 자리가 public/sparklab/${ctx.code} 밖입니다.`)
      continue
    }
    try {
      if (!fs.existsSync(src)) throw new Error('가져올 파일이 없습니다.')
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      matchCase(dst)
      fs.copyFileSync(src, dst)
      if (fs.statSync(dst).size !== fs.statSync(src).size) throw new Error('복사한 크기가 원본과 다릅니다.')
      copied += 1
    } catch (error) {
      failed.push(`${f.from} → ${f.to}: ${toMessage(error)}`)
    }
  }
  return { copied, failed }
}

/** AssetTable 이 가리키는데 호 저장소에 없는 파일 · 스펙 에러 — 둘 다 forge 가 쓴 액티비티를 다시 읽어서 */
function readBack(forge: Forge, ctx: ChatCtx): { missing: string[]; spec: string[]; want: string[]; unread?: string } {
  const c = forge.api.clone(ctx.code, ctx.code)
  if (!c.ok) return { missing: [], spec: [], want: [], unread: `쓴 액티비티를 다시 읽지 못했습니다: ${c.error ?? ''}` }
  const lost = c.notes.filter((n) => n.includes('못 읽었습니다'))
  if (lost.length) return { missing: [], spec: [], want: [], unread: lost.join(' ') }
  // 있는 것과 부르는 것은 「안 쓰는 리소스」(`pubextra.ts`)와 같은 셈이다(`pubfiles.ts`)
  const want = wantOf(forge, c.recipe, ctx.act)
  const have = listPub(ctx.pub)
  const exact = new Set(have)
  const lower = new Map(have.map((h) => [h.toLowerCase(), h]))
  const missing = want
    .filter((r) => !exact.has(r))
    .map((r) => {
      const near = lower.get(r.toLowerCase())
      if (near) return `${r} (호 저장소에는 ${near} — 대소문자가 다릅니다)`
      const other = r.replace(/^animations?\//, (d) => (d === 'animation/' ? 'animations/' : 'animation/'))
      if (other !== r && exact.has(other)) return `${r} (AssetTable 은 ${r.split('/')[0]}/ 인데 파일은 ${other.split('/')[0]}/ 에 있습니다)`
      return r
    })
  const g = forge.api.check(c.recipe as never)
  const spec =
    'error' in g
      ? [String(g.error)]
      : g.issues.filter((i) => i.level === 'error' && !i.rule.startsWith('asset-file-')).map((i) => `${i.rule} ${i.path} — ${i.message}`)
  return { missing, spec, want }
}

export async function finishChat(forge: Forge, ctx: ChatCtx, files: ChatFile[]): Promise<ChatChecks> {
  const copy = copyAll(ctx, files)
  const back = readBack(forge, ctx)
  const hall = path.resolve(ctx.act, '..', '..', '..')
  const t = await hallTsc(hall, ctx.code)
  return {
    tsc: { ok: t.ok, ran: t.ran, errors: t.lines, ...(t.why ? { why: t.why } : {}), ...(t.common.length ? { common: t.common } : {}) },
    at: new Date().toISOString(),
    spec: back.spec,
    // 받았는데 안 쓴 리소스 — 막지 않고 보인다(빠뜨린 이펙트 · 소리를 짚는다)
    files: { copied: copy.copied, missing: back.missing, failed: copy.failed, unused: back.unread ? [] : unusedRsc(ctx.rsc, ctx.pub, back.want, files, ctx.moduleDir) },
    ...(back.unread ? { unread: back.unread } : {}),
    // 학습코드가 폴더와 다르면 학습 기록이 다른 학습코드로 간다 — 막는다(`chatident.ts`)
    ident: identCheck(ctx.act, ctx.code, ctx.origin.act),
    // 다른 호에서만 쓰던 녹음 — 막지 않고 보인다(9호 KOL1M09W4S2 가 7호 박사 대사를 썼다)
    foreign: back.unread ? [] : foreignSounds(forge, ctx.code, ctx.act, ctx.rsc, back.want)
  }
}

/** 막는 것이 남았나 — 타입 오류(또는 못 돌림) · 다시 못 읽음 · 없는 파일 · 복사 실패 · 학습코드 다름 */
export const blocked = (c: ChatChecks): boolean =>
  !c.tsc?.ok || Boolean(c.unread || c.files?.missing.length || c.files?.failed.length) || c.ident?.ok === false
