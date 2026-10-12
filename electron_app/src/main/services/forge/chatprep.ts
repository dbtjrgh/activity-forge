/**
 * **대화로 만들기 전에 앱이 해 두는 것** (2026-10-08, `chat.ts`).
 *
 * M07 대화에서 Claude 가 손으로 하던 일 가운데 **결정적인 것**은 앱이 먼저 한다 — 원본 후보 고르기(배치표 · 그림 크기),
 * 같은 모듈 완성본 목록, 공용 · 돌려 쓰는 파일 복사(`commonrsc.ts` · `carryrsc.ts`), 리소스 표(크기 · 원본과 같은 파일인가).
 * Claude 는 그것을 받아 **뜻으로 맞추는 일**(기획서 · figma 를 보고 값 · 자리 · 리소스 고르기)만 한다.
 *
 * 폴더 셋 — 쓰는 곳(호 저장소의 그 학습코드 폴더)과 읽기만 하는 곳(리소스 · 원본 · 같은 모듈 완성본 · 모듈 소스 · 스펙).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import { carriedRels, logCarried, pruneCarried } from './carrylog'
import { carrySame } from './carryrsc'
import { copyCommon } from './commonrsc'
import { originNow } from './originpick'
import type { Forge } from './runtime'
import { plansOf, shotsOf } from './shot'
import { pullCommonPlans } from './sortpaper'
import { stamp } from './stamp'
import { rscTable } from './wholebrief'

/** 같은 모듈 완성본을 몇 개까지 열어 주나 — 원본 하나에는 안 나오는 규칙을 본다(`whole.ts` 와 같은 까닭) */
const OTHERS_MAX = 5

export type Done = { code: string; act: string; rsc: string }

export type ChatCtx = {
  code: string
  subject: string
  module: string
  /** 쓰는 곳 — 호 저장소 `src/activity/<코드>` */
  act: string
  /** 호 저장소 `public/sparklab/<코드>` — 앱이 리소스를 여기로 복사한다 */
  pub: string
  /** 리소스 폴더(사람이 넣은 것 · figma · 기획서) */
  rsc: string
  origin: Done
  others: Done[]
  moduleDir: string
  specFile: string
  shots: string[]
  plans: string[]
  table: string
  /** 앱이 리소스 폴더로 가져온 파일 — 이번과 지난번 모두(`carrylog.ts` 기록) */
  carried: string[]
}

const hallOf = (forge: Forge, code: string): string =>
  forge.paths.workPath(`sparkon_m${String(forge.spec.parseStudyCode(code)?.month ?? 0).padStart(2, '0')}`)

const doneOf = (forge: Forge, code: string): Done => ({
  code,
  act: path.join(hallOf(forge, code), 'src', 'activity', code),
  rsc: forge.common.rscOfDone(code)
})

/** 준비 — 원본을 정하고 공용 · 돌려 쓰는 파일을 리소스 폴더로 가져온다(파일을 건드린다). 못 하면 까닭 글 */
export async function prepChat(forge: Forge, code: string): Promise<ChatCtx | string> {
  const pick = originNow(forge, code)
  if (typeof pick === 'string') return pick
  const ctx = ctxOf(forge, code, pick.origin, pick.module)
  if (typeof ctx === 'string') return ctx
  const cloned = forge.api.clone(pick.origin, code)
  if (!cloned.ok) return cloned.error ?? '원본을 불러오지 못했습니다.'

  // 공용 · 돌려 쓰는 파일 — 지금 흐름(`assemble.ts` ②.5)과 같은 차례 · 같은 빗장
  // 원본이 바뀌었으면 옛 원본에서 가져온 것부터 휴지통으로(`carrylog.ts`)
  const rsc = ctx.rsc
  await pruneCarried(forge.paths.REPO_ROOT, code, pick.origin, rsc)
  const fresh = forge.commonfresh.freshPictures(pick.origin, rsc)
  const common = copyCommon(forge, pick.origin, code, pick.module, fresh)
  const carried = carrySame(forge, pick.origin, code, cloned.recipe, fresh)
  const took = [...common.took.map((t) => t.rel), ...carried.took]
  logCarried(forge.paths.REPO_ROOT, code, pick.origin, rsc, took)
  pullCommonPlans(forge, code, pick.module)
  return {
    ...ctx,
    shots: shotsOf(rsc),
    plans: plansOf(rsc),
    table: rscTable(forge, rsc, ctx.origin.rsc, cloned.recipe).text,
    carried: [...carriedRels(forge.paths.REPO_ROOT, code)].sort()
  }
}

/**
 * 경로만 다시 모은다 — **파일을 건드리지 않는다.** 앱을 다시 켠 뒤 답을 이을 때 쓴다.
 * `prepChat` 을 다시 돌리면 그새 바뀐 원본으로 돌려 쓰는 파일을 갈아 끼워, Claude 가 본 것과 다른 파일이 같은 이름으로 남는다.
 * 리소스 표 · 가져온 파일은 첫 지시에만 쓰므로 비운다
 */
export function ctxOf(forge: Forge, code: string, origin: string, module: string): ChatCtx | string {
  const rsc = forge.files.rscDir(code)
  if (!rsc || !fs.existsSync(rsc)) return '리소스 폴더가 아직 없습니다. 리소스를 먼저 넣으세요.'
  const subject = code.slice(0, 2)
  const act = path.join(hallOf(forge, code), 'src', 'activity', code)
  if (!fs.existsSync(act)) return `호 저장소에 이 학습코드 폴더가 없습니다(${act}).`
  let choices: string[] = []
  try {
    choices = forge.layout.originChoices(code).choices.map((c) => c.code)
  } catch {
    choices = []
  }
  const others = choices
    .filter((c) => c !== origin && c !== code)
    .map((c) => doneOf(forge, c))
    .filter((d) => fs.existsSync(path.join(d.act, 'GameData.ts')))
    .slice(0, OTHERS_MAX)
  return {
    code,
    subject,
    module,
    act,
    pub: path.join(hallOf(forge, code), 'public', 'sparklab', code),
    rsc,
    origin: doneOf(forge, origin),
    others,
    moduleDir: forge.survey.moduleDir(subject, module),
    specFile: forge.spec.specPath(subject, forge.spec.resolveModule(subject, module)),
    shots: shotsOf(rsc),
    plans: plansOf(rsc),
    table: '',
    carried: []
  }
}

/**
 * 리소스 폴더의 파일 전부(figma 화면 `_figma` · 기획서 `_plan` 포함)를 `이름|도장`으로 — 대화 중에 사람이 넣은 것을 가리려고 차례마다 떠 둔다.
 * 2026-10-08 첫 시험에서 대화를 시작하고 2분 뒤에 figma 화면을 붙였는데, Claude 는 모른 채 「figma 화면이 없다」고 물었다.
 * 도장(크기 · 수정 시각)까지 두는 것은 같은 이름으로 바꿔 넣은 것도 알리려고다.
 * 사람이 붙인 그림(`_chat`, 맨 위) · 크기를 줄이기 전 원래 것(`_원본`, 어느 깊이든 — figma 화면도 `_figma/_원본` 에 둔다)은 뺀다
 */
export function inputsOf(rsc: string): string[] {
  const out: string[] = []
  const walk = (rel: string): void => {
    let names: fs.Dirent[] = []
    try {
      names = fs.readdirSync(path.join(rsc, rel), { withFileTypes: true })
    } catch {
      return
    }
    for (const e of names) {
      const next = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory() && (e.name === '_원본' || (!rel && e.name === '_chat'))) continue
      if (e.isDirectory()) walk(next)
      else out.push(`${next}|${stamp(path.join(rsc, next))}`)
    }
  }
  walk('')
  return out.sort()
}

/**
 * 지난번에 떠 둔 것과 지금을 견준다. 옛 대화는 이름만 들어 있다 — 그때는 이름으로만 본다(다 바뀐 것으로 알리면 Claude 가 폴더를 통째로 다시 연다).
 * 떠 둔 것이 아예 없는 옛 대화는 figma 화면 · 기획서를 다 새것으로 알린다 — 그때는 그것을 알리지 않았다
 */
export function diffInputs(before: string[] | undefined, now: string[]): { added: string[]; gone: string[]; changed: string[] } {
  const split = (e: string): [string, string] => {
    const i = e.lastIndexOf('|')
    return i < 0 ? [e, ''] : [e.slice(0, i), e.slice(i + 1)]
  }
  const cur = new Map(now.map(split))
  const old = new Map((before ?? [...cur].filter(([r]) => !r.startsWith('_figma/') && !r.startsWith('_plan/')).map(([r, s]) => `${r}|${s}`)).map(split))
  for (const r of [...old.keys()]) if (r.split('/').includes('_원본')) old.delete(r)
  return {
    added: [...cur.keys()].filter((r) => !old.has(r)),
    gone: [...old.keys()].filter((r) => !cur.has(r)),
    changed: [...cur].filter(([r, s]) => Boolean(old.get(r)) && old.get(r) !== s).map(([r]) => r)
  }
}

/** Claude 가 읽기만 할 폴더 — 있는 것만 */
export function readDirsOf(ctx: ChatCtx): string[] {
  const dirs = [ctx.rsc, ctx.origin.act, ctx.origin.rsc, ...ctx.others.flatMap((o) => [o.act, o.rsc]), ctx.moduleDir, path.dirname(ctx.specFile)]
  return [...new Set(dirs)].filter((d) => d && fs.existsSync(d))
}
