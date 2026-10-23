/**
 * **대화와 모듈** (2026-10-14) — 기획서가 적은 모듈이 배치표 모듈과 다를 때 · 모듈 안 유형을 대화 칸에 알리는 글.
 *
 * 9호 MAL3M08W2S1 은 배치표가 M30 인데 기획서 1쪽에 「※ 모듈 변경: 기존 커리큘럼 M30 → M30_3」이 적혀 있었다.
 * 앱은 그것을 안 보고 M30 으로 불렀고, Claude 는 알아채고 물었지만 M30_3 모듈 폴더 · 완성본을 열 수 없어 두 차례를 더 썼다(「권한 없음」).
 * 이제 대화를 준비할 때 기획서 1쪽의 모듈을 보고(읽는 셈은 `planmodule.ts` 하나 — 작업대 경고 · 진행판과 같다), 다르면
 * - 사람에게 대화 칸 첫 글로 굵게 알리고(`planSaid`)
 * - Claude 에게 만들기 전에 묻게 하고(`planLines`)
 * - 그 모듈 소스 · 스펙 · 개발 완료 완성본을 읽기 폴더로 열어 준다(`planDirs`). 그 완성본 리소스는 files 의 from 으로도 받는다(`chatfinish.ts`)
 * 모듈 폴더가 없는 이름(M30_1 · M30_2 처럼 기획서가 커리큘럼 이름으로 적은 것)은 견주지 않는다 — 그런 모듈은 없다.
 * 배치표를 바꾸는 것은 사람 몫이다(작업대 「기획서대로 바꾸기」) — 여기서는 알리기만 한다. 대화 도중 바꾸면 `chatresume.ts` 가 폴더를 다시 연다.
 *
 * `variantSaid` 는 `chat.ts` 에서 옮겼다(옮길 때 동작 변화 없음).
 * `driftOf` 는 스펙을 맞춰 본 뒤 공용 모듈에 커밋이 더 있나를 대화를 시작할 때 잰다(forge `specdrift.ts`) — 글은 `chatrules.ts` `driftLines`.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import { doneOf, type Done } from './chatothers'
import type { ChatCtx } from './chatprep'
import { cellCode, finishedAt } from './hallwalk'
import { planModuleOf, planVsLayout } from './planmodule'
import type { Forge } from './runtime'

/** 기획서 모듈의 개발 완료 완성본을 몇 개 열어 주나 */
const DONES_MAX = 3

export type PlanOpen = { plan: string; module: string; moduleDir: string; specFile: string; dones: Done[] }

/** 기획서 1쪽이 적은 모듈이 `module` 과 다르면 그 모듈 — 같거나 못 읽거나 그런 모듈 폴더가 없으면 null */
export function planOpenOf(forge: Forge, code: string, module: string): PlanOpen | null {
  const subject = code.slice(0, 2)
  const level = code.slice(2, 4)
  const read = planModuleOf(forge, code)
  const m = read.planModule
  if (!m || !planVsLayout(forge, code, m, module).differs) return null
  const moduleDir = forge.survey.moduleDir(subject, m)
  // 스펙만 있고 모듈 폴더가 없는 이름은 열어 줄 것이 없다
  if (!fs.existsSync(moduleDir)) return null
  // 같은 레벨 먼저, 그 안에서는 늦은 호 먼저
  const dones = forge.layout
    .scanCells(subject)
    .filter((c) => c.module === m)
    .map((c) => cellCode(subject, c))
    .filter((c) => c !== code && finishedAt(doneOf(forge, c).act) === true)
    .sort((a, b) => Number(b.slice(2, 4) === level) - Number(a.slice(2, 4) === level) || b.slice(5, 7).localeCompare(a.slice(5, 7)))
    .slice(0, DONES_MAX)
    .map((c) => doneOf(forge, c))
  return { plan: read.plan, module: m, moduleDir, specFile: forge.spec.specPath(subject, forge.spec.resolveModule(subject, m)), dones }
}

/** 스펙을 맞춰 본 뒤 공용 모듈이 바뀌었으면 그 까닭과 커밋 — 못 쟀거나 안 바뀌었으면 null(막지 않는다) */
export async function driftOf(forge: Forge, ctx: ChatCtx): Promise<ChatCtx['drift']> {
  try {
    const d = await forge.specdrift.specDrift(ctx.subject, ctx.module)
    return d.drift ? { note: d.note, commits: d.commits } : null
  } catch {
    return null
  }
}

/** Claude 가 읽을 폴더에 더할 것 — 그 모듈 소스 · 스펙 폴더 · 완성본 */
export const planDirs = (p: PlanOpen | null): string[] =>
  p ? [p.moduleDir, path.dirname(p.specFile), ...p.dones.flatMap((d) => [d.act, d.rsc])] : []

/** 대화 칸 첫 글 — 사람이 봐야 한다 */
export function planSaid(c: ChatCtx): string {
  const p = c.planModule
  if (!p) return ''
  return `**기획서 1쪽은 ${p.module} 모듈이고 배치표는 ${c.module} 모듈입니다.** Claude 가 만들기 전에 어느 모듈로 만들지 묻습니다. ${p.module} 모듈 폴더와 완성본도 함께 열어 줍니다.`
}

/** 첫 지시 — 맨 앞에 둔다 */
export function planLines(c: ChatCtx): string[] {
  const p = c.planModule
  if (!p) return []
  const rel = (x: string): string => x.split(path.sep).join('/')
  return [
    '',
    '## 기획서와 배치표의 모듈이 다르다',
    `**기획서 1쪽(${p.plan})은 모듈을 ${p.module} 로 적었다. 앱이 받은 배치표 모듈은 ${c.module} 이다.**`,
    '만들기 전에 어느 모듈로 만들지 ask 로 먼저 묻는다. 두 모듈을 고를 답으로 두고, 기획서에 적힌 그 줄을 질문에 옮겨 적는다.',
    `${p.module} 로 정해지면 아래 폴더에서 출발한다. 원본은 아래 ${p.module} 완성본 가운데 고르고, 어느 것을 골랐는지 끝 보고에 적는다.`,
    `- ${p.module} 모듈 소스(읽기): ${rel(p.moduleDir)}`,
    fs.existsSync(p.specFile) ? `- ${p.module} 모듈 스펙(읽기): ${rel(p.specFile)}` : `- ${p.module} 모듈 스펙은 아직 없다. 모듈 소스와 완성본을 읽고 따른다.`,
    ...(p.dones.length
      ? p.dones.map((d) => `- ${p.module} 완성본(읽기): ${d.code} — 코드 ${rel(d.act)} · 리소스 ${rel(d.rsc)}`)
      : [`- ${p.module} 모듈을 쓴 개발 완료 완성본이 없다.`])
  ]
}

/** 모듈 안 유형(스펙 variantKey)을 덮었나 — 자리가 모자라 못 연 유형은 숨기지 않는다 */
export function variantSaid(ctx: ChatCtx): string {
  const v = ctx.variants
  if (!v || v.rows.length < 2) return ''
  return v.missing.length
    ? `모듈 안 유형 ${v.rows.length}가지 가운데 ${v.missing.join(', ')} 유형을 쓴 완성본은 열어 주지 못했습니다.`
    : `모듈 안 유형 ${v.rows.length}가지마다 그 유형을 쓴 완성본을 하나 이상 열어 줍니다.`
}
