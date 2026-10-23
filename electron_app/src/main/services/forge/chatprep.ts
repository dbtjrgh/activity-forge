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
import { backdropScores } from './backdrop'
import { carriedRels } from './carrylog'
import { carryFiles } from './chatcarry'
import { loreOf, type ChatLore } from './chatlore'
import { driftOf, planDirs, planOpenOf, type PlanOpen } from './chatmodule'
import { doneOf, hallOf, pickOthers, type Done, type VariantView } from './chatothers'
import { pageLines, pagesOf } from './chatpages'
import { measureBackdrop, sceneOf, type ChatScene, type OriginPick } from './chatscene'
import { originNow } from './originpick'
import type { Forge } from './runtime'
import { plansOf, shotsOf, wrongPlan } from './shot'
import { stamp } from './stamp'
import { rscTable } from './wholebrief'

export type { Done } from './chatothers'

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
  /** 같은 배경 그림의 짝과 다른 자리를 적은 글(`chatpages.ts`) — 첫 지시에만 싣고, 그림이 바뀌면 답에 다시 잰다 */
  pages: string[]
  /** 모듈 안 유형(스펙 `variantKey`)과 그것을 쓴 완성본 — 없는 모듈이면 null (`chatothers.ts`) */
  variants: VariantView | null
  /** figma 화면의 배경과 원본(`chatscene.ts`) — 배경 때문에 바꿨거나 사람이 정한 원본과 다를 때 */
  scene: ChatScene | null
  /** 기획서 1쪽이 적은 모듈이 배치표와 다를 때 그 모듈(`chatmodule.ts`) — 이을 때도 그 폴더를 열어 주려고 여기서 잰다 */
  planModule: PlanOpen | null
  /** 원본이 모듈 기본값을 덮는 별칭 · 대화로 만든 완성본의 어림 값 · figma 가 필요한 모듈인가(`chatlore.ts`) — 첫 지시에만 쓴다 */
  lore: ChatLore | null
  /** 스펙을 맞춰 본 뒤 공용 모듈에 더 새 커밋이 있나(forge `specdrift.ts`) — 대화를 시작할 때만 잰다(git 이라 비동기), 첫 지시에만 쓴다 */
  drift?: { note: string; commits: string[] } | null
}

/**
 * 준비 — 원본을 정하고 공용 · 돌려 쓰는 파일을 리소스 폴더로 가져온다(파일을 건드린다). 못 하면 까닭 글.
 * `say` 는 오래 걸리는 단계를 진행 줄에 알린다
 */
export async function prepChat(forge: Forge, code: string, say: (line: string) => void = () => {}): Promise<ChatCtx | string> {
  const failed = await measureBackdrop(forge, code, () => say('figma 화면과 원본 후보의 배경을 비교하고 있습니다.'))
  if (failed) say(failed)
  const pick = originNow(forge, code)
  if (typeof pick === 'string') return pick
  const ctx = ctxOf(forge, code, pick)
  if (typeof ctx === 'string') return ctx
  // 다른 학습코드 기획서면 AI 를 부르지 않는다 — Claude 가 $0.82 를 쓰고서야 「L2 기획서」라고 알아챘다(2026-10-13)
  const wrong = wrongPlan(code, ctx.rsc)
  if (wrong) return wrong
  // 공용 · 돌려 쓰는 파일 — 원본이 바뀌었으면 옛 원본에서 가져온 것부터 휴지통으로(`chatcarry.ts`)
  const rsc = ctx.rsc
  const files = await carryFiles(forge, code, pick, rsc)
  if (typeof files === 'string') return files
  return {
    ...ctx,
    shots: shotsOf(rsc),
    plans: plansOf(rsc),
    table: rscTable(forge, rsc, ctx.origin.rsc, files.recipe).text,
    carried: [...carriedRels(forge.paths.REPO_ROOT, code)].sort(),
    pages: pageLines(pagesOf(forge, code, rsc, () => say('같은 배경 그림을 비교하고 있습니다.'))),
    lore: loreOf(forge, ctx),
    drift: await driftOf(forge, ctx)
  }
}


/**
 * 경로만 다시 모은다 — **파일을 건드리지 않는다.** 앱을 다시 켠 뒤 답을 이을 때 쓴다.
 * `prepChat` 을 다시 돌리면 그새 바뀐 원본으로 돌려 쓰는 파일을 갈아 끼워, Claude 가 본 것과 다른 파일이 같은 이름으로 남는다.
 * 리소스 표 · 가져온 파일은 첫 지시에만 쓰므로 비운다. 열어 줄 완성본은 같은 셈으로 다시 고른다(`chatothers.ts`)
 */
export function ctxOf(forge: Forge, code: string, pick: OriginPick): ChatCtx | string {
  const { origin, module } = pick
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
  const scores = backdropScores(forge, code)
  const { others, variants } = pickOthers(forge, code, module, origin, choices, scores)
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
    carried: [],
    pages: [],
    variants,
    scene: sceneOf(forge, code, pick, scores),
    planModule: planOpenOf(forge, code, module),
    lore: null
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
  const dirs = [ctx.rsc, ctx.origin.act, ctx.origin.rsc, ...ctx.others.flatMap((o) => [o.act, o.rsc]), ctx.moduleDir, path.dirname(ctx.specFile), ...planDirs(ctx.planModule)]
  return [...new Set(dirs)].filter((d) => d && fs.existsSync(d))
}
