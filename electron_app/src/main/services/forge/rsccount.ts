/**
 * **리소스가 모자란가 — 세는 곳은 여기 하나** (2026-10-01, 2026-10-14 에 셈을 바꿨다). 작업대 · 진행판 · 관리가 같은 것을 본다.
 *
 * 10-01 부터 원본 하나와 종류별 파일 수를 견줬다. 완성본 835개로 재 보니 **다 넣은 완성본도 같은 모듈 다른 완성본을 원본으로
 * 견주면 짝의 49%에서 「부족」이 떴다**(뜰 때 평균 12.5개) — 같은 모듈도 이닝 · 장면 수가 학습코드마다 다르다(함정 문서).
 * 사람은 매번 「정말 모자란가」를 헷갈렸다. 그래서 **확실한 것만 「없음」으로 센다.**
 * - **소리** — 기획서 녹음 표에 낱개로 적힌 이 학습코드 몫 이름 가운데 리소스 폴더와 호 저장소 어디에도 없는 것(`plansound.ts`)
 * - **그림 · 로티 · 영상** — 미리 알 길이 없다. 같은 모듈 개발 완료 완성본이 쓴 수의 범위만 참고로 싣는다(`rscrange.ts`)
 * - 공용 파일(com · cor · quiz …)은 앱이 대화를 시작할 때 가져온다 — 기획서 몫 이름이 아니라 안 센다
 * 원본은 이제 안 본다 — 원본 이름은 받을 리소스 창(`rscguide.ts`)이 그림마다 보인다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { NeedRow, PlanCheck } from '../../../shared/forge'
import { doneOf } from './chatothers'
import { joinedParts, planSound, stem } from './plansound'
import { kindKey, rangeOf } from './rscrange'
import type { Forge } from './runtime'

export { kindKey }

const AUDIO = /\.(mp3|wav|ogg|m4a)$/i
const KIND_ORDER = ['video', 'image', 'sound', 'lottie', 'font']

/** 폴더 아래 소리 파일 전부 — 하위 폴더 깊이가 학습코드마다 다르다(sounds/nar · sounds/narration …) */
function audioIn(dir: string, out: Set<string>): Set<string> {
  let names: fs.Dirent[]
  try {
    names = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of names) {
    if (e.isDirectory()) audioIn(path.join(dir, e.name), out)
    // 합본(`nar10-11`)이 있으면 기획서의 낱개 둘(`nar10` · `nar11`)도 있는 것이다(`plannames.ts` `joinedParts`)
    else if (AUDIO.test(e.name)) [stem(e.name), ...joinedParts(stem(e.name))].forEach((n) => out.add(n))
  }
  return out
}

/** 기획서 소리 이름 가운데 없는 것 — 리소스 폴더와 호 저장소(만든 뒤 · 폴더 정리 뒤에는 거기에만 있다)를 같이 본다 */
export function planGap(forge: Forge, code: string): { plan: PlanCheck; missing: string[]; unsure: string[] } {
  const rsc = forge.files.rscDir(code)
  const got = rsc ? planSound(forge, code, rsc) : { own: [], unsure: [], note: '리소스 폴더를 정하지 않았습니다.' }
  const plan = { names: got.own.length, note: got.note }
  if (got.note) return { plan, missing: [], unsure: [] }
  const have = audioIn(doneOf(forge, code).rsc, rsc ? audioIn(rsc, new Set()) : new Set())
  const lack = (n: string): boolean => !have.has(n.toLowerCase())
  return { plan, missing: got.own.filter(lack), unsure: got.unsure.filter(lack) }
}

export interface Counted {
  rows: NeedRow[]
  plan: PlanCheck
}

/** 종류마다 지금 수 · 같은 모듈 범위 · 없는 소리. 모듈을 모르면 범위 없이 */
export function countFor(forge: Forge, code: string, module: string): Counted {
  const here = new Map<string, number>()
  for (const f of forge.files.listFiles(code)?.files ?? []) here.set(kindKey(f.name, f.kind), (here.get(kindKey(f.name, f.kind)) ?? 0) + 1)
  const range = module ? rangeOf(forge, code.slice(0, 2), module) : new Map()
  const gap = planGap(forge, code)
  const kinds = new Set([...here.keys(), ...range.keys(), ...(gap.plan.names ? ['sound'] : [])])
  const rank = (k: string): number => (KIND_ORDER.includes(k) ? KIND_ORDER.indexOf(k) : KIND_ORDER.length)
  const rows = [...kinds]
    .sort((a, b) => rank(a) - rank(b))
    .map((kind) => ({
      kind,
      here: here.get(kind) ?? 0,
      range: range.get(kind) ?? null,
      missing: kind === 'sound' ? gap.missing : [],
      unsure: kind === 'sound' ? gap.unsure : []
    }))
  return { rows, plan: gap.plan }
}

/** 진행판 칸의 없는 소리 수 — 기획서로 못 셌으면 null(숫자 0 이 「다 있음」으로 읽히지 않게) */
export function gapFor(forge: Forge, code: string): number | null {
  const gap = planGap(forge, code)
  return gap.plan.note ? null : gap.missing.length
}
