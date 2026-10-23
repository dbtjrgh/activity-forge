/**
 * **원본 · 같은 모듈 완성본에서 그대로 믿으면 안 되는 것** (2026-10-14) — 첫 지시에 싣는다(`chatrules.ts` `loreLines`). 대화를 시작할 때 한 번만 잰다(`chatprep.ts` `prepChat`).
 *
 * 1. **원본이 모듈 기본값을 덮는 별칭** — 모듈이 스스로 등록한 별칭을 원본 AssetTable 이 다른 파일로 다시 등록한 것. 원본에서 출발하면 그대로 옮는다.
 *    4호 ENL1M04W2S3 은 E11 의 nar2(「Let's decorate the book cover」, `Editor.ts` 가 `guide("nar2")` 로 부름)를 제목 녹음 SL_en_114_s3_nar01 로 덮었다.
 *    **덮음은 파일 이름이 다른 것만** 센다 — 5~7호 E11 도 nar2 를 적지만 모듈과 같은 SL_en_com_nar102 를 제 폴더에 둔 것이다.
 *    같은 모듈 다른 개발 완료 완성본의 절반 넘게 덮는 별칭은 관례로 보고 뺀다
 * 2. **대화로 만든 완성본의 어림 값** — 9호부터 원본 · 같은 모듈 완성본에 대화로 만든 것이 섞인다. figma 없이 앞 호 값으로 어림한 자리가
 *    다음 호의 원본이 되면 어림이 정답처럼 옮는다(9호 MAL1M08W2S1 프레임 자리 (0, 100) 은 6호 값 그대로였다).
 *    그 대화가 남긴 확인 목록 — chat.json 의 `look`, 없으면(옛 대화) 마지막 「미리보기에서 확인할 것」 앱 글(`chatturns.ts` 가 쓰는 꼴)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ChatTurn } from '../../../shared/forge'
import { escapeRe } from '../../lib/regex'
import { doneOf } from './chatothers'
import { lookFromTurns } from './chatlook'
import type { ChatCtx } from './chatprep'
import { chatFile } from './chatstore'
import { cellCode, finishedAt } from './hallwalk'
import type { Forge } from './runtime'
import { needsShot } from './shotfirst'

export type AliasOverride = { alias: string; file: string; base: string; at: string }
export type Guessed = { code: string; lines: string[] }
export type ChatLore = { needsShot: boolean; overrides: AliasOverride[]; guessed: Guessed[] }

/** 대화로 만든 완성본 하나에서 실을 확인 줄 수 · 한 줄 길이 */
const LOOK_MAX = 5
const LOOK_LEN = 180
/** 어림 · 임시를 말하는 줄 — 먼저 싣는다 */
const GUESS = /어림|임시|정한 값|figma.{0,4}없|그대로|메꿨|대신/

type Src = { rel: string; lines: string[] }

/** 모듈 폴더의 .ts 전부(주석 줄은 빈 줄로 — 줄 번호를 지킨다) */
function sourcesOf(dir: string): Src[] {
  try {
    return (fs.readdirSync(dir, { recursive: true, withFileTypes: true }) as fs.Dirent[])
      .filter((e) => e.isFile() && e.name.endsWith('.ts'))
      .map((e) => {
        const full = path.join(e.parentPath, e.name)
        const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/).map((l) => (l.trim().startsWith('//') ? '' : l))
        return { rel: path.relative(dir, full).split(path.sep).join('/'), lines }
      })
  } catch {
    return []
  }
}

const baseOf = (src: string): string => src.split('/').pop() ?? ''

/** 모듈이 등록하는 별칭 → 파일 이름 — `{ alias: 'x', src: `${path}/…/y.mp3` }` 꼴(Assets.ts · Asset.ts · 부품 파일) */
export function moduleAliases(src: Src[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const s of src) {
    const text = s.lines.join('\n')
    for (const m of text.matchAll(/alias\s*:\s*(['"`])([^'"`\n]+)\1\s*,\s*src\s*:\s*(['"`])([^'"`\n]+\.[A-Za-z0-9]{2,5})\3/g)) {
      if (!out.has(m[2] as string)) out.set(m[2] as string, baseOf(m[4] as string))
    }
  }
  return out
}

/** 모듈 코드가 그 별칭을 부르는 첫 자리(`component/Editor.ts:54`) — 등록하는 줄은 뺀다 */
function usedAt(src: Src[], alias: string): string {
  const q = new RegExp(`(['"\`])${escapeRe(alias)}\\1`)
  for (const s of src) {
    const i = s.lines.findIndex((l) => q.test(l) && !/alias\s*:/.test(l))
    if (i >= 0) return `${s.rel}:${i + 1}`
  }
  return ''
}

/** 완성본 AssetTable 의 별칭 → 파일 이름(forge `common.fileOf`, 못 읽으면 빈 표) */
function tableOf(forge: Forge, code: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const [slot, rel] of forge.common.fileOf(code)) out.set(slot.slice(slot.indexOf('|') + 1), baseOf(rel))
  return out
}

const same = (a: string | undefined, b: string | undefined): boolean => (a ?? '').toLowerCase() === (b ?? '').toLowerCase()

/** 원본이 모듈 기본값을 덮는 별칭 — 같은 모듈 완성본 절반 넘게 덮는 것은 뺀다 */
export function overridesOf(forge: Forge, code: string, module: string, moduleDir: string, origin: string): AliasOverride[] {
  const src = sourcesOf(moduleDir)
  const mod = moduleAliases(src)
  if (!mod.size) return []
  const cand = [...tableOf(forge, origin)].filter(([a, f]) => mod.has(a) && !same(mod.get(a), f))
  if (!cand.length) return []
  const subject = code.slice(0, 2)
  const peers = forge.layout
    .scanCells(subject)
    .filter((c) => c.module === module)
    .map((c) => cellCode(subject, c))
    .filter((c) => c !== origin && c !== code && finishedAt(doneOf(forge, c).act) === true)
    .map((c) => tableOf(forge, c))
  return cand
    .filter(([a]) => !(peers.length && peers.filter((t) => t.has(a) && !same(t.get(a), mod.get(a))).length * 2 > peers.length))
    .map(([alias, file]) => ({ alias, file, base: mod.get(alias) ?? '', at: usedAt(src, alias) }))
}

/**
 * 확인 목록 — `look` 이 있으면 그것, 없으면 옛 대화의 완료 글에서 뽑는다(`chatlook.ts` 한 셈 — 작업대 「확인할 것」과 같다).
 * 따로 굵은 제목 꼴만 읽던 셈은 합칠 때 걷었다 — 옛 꼴(`미리보기에서 확인할 것: 가 / 나`)로 끝난 KO 둘의 어림 목록이 비어 나갔다(2026-10-14)
 */
function lookOf(saved: { look?: unknown; turns?: ChatTurn[] }): string[] {
  if (Array.isArray(saved.look)) return saved.look.filter((x): x is string => typeof x === 'string')
  return lookFromTurns(saved.turns ?? [])
}

/** 대화로 만든 완성본과 그 어림 값 — `root` 는 forge 폴더(`_recipe` 가 든 곳). 대화 기록이 없으면 사람이 만든 것이라 안 싣는다 */
export function guessedOf(root: string, codes: string[]): Guessed[] {
  const out: Guessed[] = []
  for (const code of codes) {
    let saved: { look?: unknown; turns?: ChatTurn[]; sessionId?: string | null }
    try {
      saved = JSON.parse(fs.readFileSync(chatFile(root, code), 'utf8'))
    } catch {
      continue
    }
    if (!saved.sessionId) continue
    const all = lookOf(saved).map((l) => l.replace(/\*\*/g, '').trim()).filter(Boolean)
    const lines = [...all.filter((l) => GUESS.test(l)), ...all.filter((l) => !GUESS.test(l))]
      .slice(0, LOOK_MAX)
      .map((l) => (l.length > LOOK_LEN ? `${l.slice(0, LOOK_LEN)}…` : l))
    out.push({ code, lines })
  }
  return out
}

/** 첫 지시에 실을 것 — `root` 는 대화 기록을 읽을 forge 폴더(시험할 때만 바꾼다) */
export function loreOf(forge: Forge, ctx: ChatCtx, root = forge.paths.REPO_ROOT): ChatLore {
  let shot = true
  try {
    shot = needsShot(forge, ctx.subject, ctx.module)
  } catch {
    // 스펙을 못 읽으면 화면이 필요한 것으로 본다(`shotfirst.ts` 와 같은 쪽)
  }
  return {
    needsShot: shot,
    overrides: overridesOf(forge, ctx.code, ctx.module, ctx.moduleDir, ctx.origin.code),
    guessed: guessedOf(root, [ctx.origin.code, ...ctx.others.map((o) => o.code)])
  }
}
