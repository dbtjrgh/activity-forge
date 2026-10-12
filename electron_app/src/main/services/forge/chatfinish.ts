/**
 * **대화로 만든 뒤 앱이 하는 일** (2026-10-08, `chat.ts`) — 리소스 복사 · 없는 파일 · 타입 검사 · 스펙 검사.
 *
 * - **리소스 복사** — Claude 가 끝 덩어리 `files` 에 적은 대로 리소스 폴더 → 호 저장소 `public/sparklab/<코드>`.
 *   Claude 에게 셸을 안 열어서 복사는 앱이 한다. 두 경로 다 제 폴더 밖을 가리키면 안 한다. 복사 뒤 크기를 대조한다
 * - **없는 파일** — 쓴 AssetTable 을 forge 가 다시 읽어(`api.clone`) 가리키는 파일이 호 저장소에 다 있나 본다.
 *   **대소문자까지 같은 이름으로** 본다 — Windows 는 대소문자를 안 가려 통과하고 서버(리눅스)에서 404 가 난다.
 *   로티 폴더는 AssetTable 의 경로 상수(`animation/` · `animations/`)를 따른다 — 레시피는 늘 `animations/` 로 읽는다
 * - **타입 검사(막음)** — 호 저장소 전체 `vue-tsc --noEmit`(재 보니 10~12초). **이 학습코드 폴더에서 난 오류만** 막는다 — 남의 폴더 오류는 우리 탓이 아니다.
 *   **검사를 못 돌린 것은 오류와 따로 둔다**(`ran: false`) — 처음에는 못 돌린 것을 「통과」로, 프로그램이 없는 것을 「타입 오류」로 AI 에게 세 번 맡겼다
 * - **스펙 검사(참고)** — 2026-10-08 사용자 결정으로 막지 않는다. 리소스 파일 검사(`asset-file-*`)는 뺀다 — 호 저장소가 아니라 리소스 폴더를 봐서 틀리게 나온다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { ChatChecks } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import type { ChatFile } from './chatbrief'
import type { ChatCtx } from './chatprep'
import { listPub, wantOf } from './pubfiles'
import type { Forge } from './runtime'

const TSC_TIMEOUT = 180_000

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
  for (const d of [ctx.rsc, ctx.origin.rsc, ...ctx.others.map((o) => o.rsc)]) {
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
function readBack(forge: Forge, ctx: ChatCtx): { missing: string[]; spec: string[]; unread?: string } {
  const c = forge.api.clone(ctx.code, ctx.code)
  if (!c.ok) return { missing: [], spec: [], unread: `쓴 액티비티를 다시 읽지 못했습니다: ${c.error ?? ''}` }
  const lost = c.notes.filter((n) => n.includes('못 읽었습니다'))
  if (lost.length) return { missing: [], spec: [], unread: lost.join(' ') }
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
  return { missing, spec }
}

/**
 * 호 저장소 타입 검사 — 이 학습코드 폴더의 오류 줄.
 * **앱의 실행 파일을 node 로 쓴다**(`view.ts` · `repro.ts` 와 같은 길) — `.cmd` 를 셸로 부르면 PATH 의 node 에 기대고,
 * 오류 글이 CP949 로 깨지고, 시간 초과에 cmd 만 죽어 손주 node 가 남는다
 */
function tsc(hall: string, code: string): Promise<NonNullable<ChatChecks['tsc']>> {
  const bin = path.join(hall, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js')
  if (!fs.existsSync(bin)) {
    return Promise.resolve({ ok: false, ran: false, errors: [], why: '호 저장소에 타입 검사 프로그램(vue-tsc)이 없습니다. 호 저장소에서 yarn 을 먼저 실행하세요.' })
  }
  return new Promise((done) => {
    execFile(
      process.execPath,
      [bin, '--noEmit', '-p', 'tsconfig.app.json'],
      {
        cwd: hall,
        timeout: TSC_TIMEOUT,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', FORCE_COLOR: '0' }
      },
      (error, stdout, stderr) => {
        const lines = `${stdout ?? ''}\n${stderr ?? ''}`.split(/\r?\n/).filter((l) => /error TS\d+/.test(l))
        const mine = lines.filter((l) => l.replace(/\\/g, '/').includes(`src/activity/${code}/`))
        // 오류가 있으면 vue-tsc 는 0 이 아닌 코드로 끝난다 — 오류 줄을 읽었으면 돈 것이다
        if (!error || lines.length) return done({ ok: mine.length === 0, ran: true, errors: mine })
        const e = error as { killed?: boolean; code?: number | string }
        if (e.killed) return done({ ok: false, ran: false, errors: [], why: `타입 검사가 ${TSC_TIMEOUT / 60000}분 안에 끝나지 않았습니다.` })
        const said = `${stderr ?? ''}`.trim().split(/\r?\n/)[0]?.slice(0, 200) ?? ''
        done({ ok: false, ran: false, errors: [], why: `타입 검사를 실행하지 못했습니다(종료 코드 ${e.code ?? '알 수 없음'}).${said ? ` ${said}` : ''}` })
      }
    )
  })
}

export async function finishChat(forge: Forge, ctx: ChatCtx, files: ChatFile[]): Promise<ChatChecks> {
  const copy = copyAll(ctx, files)
  const back = readBack(forge, ctx)
  const hall = path.resolve(ctx.act, '..', '..', '..')
  const types = await tsc(hall, ctx.code)
  return {
    tsc: types,
    spec: back.spec,
    files: { copied: copy.copied, missing: back.missing, failed: copy.failed },
    ...(back.unread ? { unread: back.unread } : {})
  }
}

/** 막는 것이 남았나 — 타입 오류(또는 못 돌림) · 다시 못 읽음 · 없는 파일 · 복사 실패 */
export const blocked = (c: ChatChecks): boolean => !c.tsc?.ok || Boolean(c.unread || c.files?.missing.length || c.files?.failed.length)
