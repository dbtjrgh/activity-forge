/**
 * **figma 화면과 원본 장면을 견준다 — 원본이 틀렸으면 생성 전에 묻는다** (2026-10-02, 사용자 요청).
 *
 * 9호 KOL1M08W4S2(K36)는 원본이 7호(박사 · 책상)인 채 만들어졌다. figma 화면에는 2호의 탐험가가 있었다.
 * 원본은 AI 보다 먼저 정해지고(배치표 · 사람이 고름) 그 뒤로 아무도 「이 원본이 맞나」를 묻지 않았다 — figma 는 좌표와 짝짓기에만 썼다
 * (사용자 말 — 「figma에 ai까지 붙여줬는데 이걸 구분 못하는거면 문제가 있는거아닌가」).
 *
 * - 셈은 forge `gen/scenefind.ts` 하나다 — 고를 그림 · 재는 법 · 가르는 문턱. 잘 맞나는 forge `tool/scenegate.ts` 로 잰다
 * - **AI 를 안 부른다.** 그림 한 장 0.2~2초, 후보 여덟 곳까지. 그림마다 쉬어 가며(`setImmediate`) 메인 스레드를 오래 안 붙잡는다
 * - 결과는 `_recipe/<코드>.scene.json` 에 남긴다 — figma 화면 · 후보가 같으면 다시 안 잰다. 원본 변경 창은 **남긴 것만** 읽는다(열 때 재면 멈춘다)
 * - 원본을 바꾸는 것은 사람이다 — 카드로 묻고(`sceneAsk`), 고른 답은 `rerun.ts` 가 배치표에 적는다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Ask, RunStep, SceneCheck, SceneScore } from '../../../shared/forge'
import { ORIGIN_PATH } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { leftoverFiles } from './leftover'
import { shotsOf } from './shot'
import { stamp } from './stamp'
import type { Forge } from './runtime'
import type { Emit } from './step'

/** 셈을 고치면 올린다 — 남겨 둔 옛 결과를 버린다 */
const VERSION = 1

type Saved = { key: string; scores: SceneScore[]; shots: number }

const fileOf = (forge: Forge, code: string): string => path.join(forge.paths.REPO_ROOT, '_recipe', `${code}.scene.json`)

/** 잴 것 — 1x figma 화면 자리와 후보. 화면이 없으면 null */
function inputOf(forge: Forge, code: string, origin: string): { dir: string; shots: string[]; cands: string[]; key: string; module: string } | null {
  const dir = forge.files.rscDir(code)
  if (!dir) return null
  const shots = shotsOf(dir)
  if (!shots.length) return null
  const c = forge.layout.originChoices(code)
  const cands = forge.scenefind.sceneCands(c.choices, code, origin)
  if (cands.length < 2) return null
  const key = JSON.stringify([VERSION, c.module, cands, shots.map((s) => `${s}|${stamp(path.join(dir, s))}`)])
  return { dir, shots, cands, key, module: c.module }
}

function readSaved(forge: Forge, code: string): Saved | null {
  try {
    return JSON.parse(fs.readFileSync(fileOf(forge, code), 'utf8')) as Saved
  } catch {
    return null
  }
}

const viewOf = (forge: Forge, s: Saved, origin: string): SceneCheck => ({
  origin,
  shots: s.shots,
  scores: s.scores,
  better: forge.scenefind.sceneVerdict(s.scores, origin)?.code ?? null
})

/** 남겨 둔 결과만 — 지금 figma 화면 · 후보와 같을 때. 원본 변경 창이 부른다(새로 재지 않는다) */
export function savedScene(forge: Forge, code: string, origin: string): SceneCheck | null {
  try {
    const input = inputOf(forge, code, origin)
    const s = readSaved(forge, code)
    return input && s && s.key === input.key ? viewOf(forge, s, origin) : null
  } catch {
    return null
  }
}

const running = new Map<string, Promise<SceneCheck | null>>()
const rest = (): Promise<void> => new Promise((r) => setImmediate(r))

/** 재고 남긴다. 같은 입력이면 남긴 것을 쓴다. 1x figma 화면이 없거나 후보가 하나면 null */
export async function sceneCheck(forge: Forge, code: string, origin: string): Promise<SceneCheck | null> {
  const input = inputOf(forge, code, origin)
  if (!input) return null
  const saved = readSaved(forge, code)
  if (saved && saved.key === input.key) return viewOf(forge, saved, origin)
  const busy = running.get(input.key)
  if (busy) return busy
  const job = (async (): Promise<SceneCheck | null> => {
    const sf = forge.scenefind
    const raw = input.shots.map((s) => forge.png.readPng(path.join(input.dir, s))).filter((b) => b !== null)
    const shots = sf.sceneShots(raw)
    if (!shots.length) return null
    const subject = forge.spec.parseStudyCode(code)?.subject ?? ''
    const files = sf.sceneFiles(subject, input.module, input.cands)
    const memo = new Map<string, number>()
    const scores: SceneScore[] = []
    for (const cand of input.cands) {
      const seen: SceneScore['seen'] = []
      for (const f of files.get(cand) ?? []) {
        await rest()
        seen.push({ rel: f.rel, ratio: Math.round(sf.sceneRatio(shots, f, memo) * 100) / 100 })
      }
      scores.push({ code: cand, hits: seen.filter((s) => s.ratio >= sf.HIT).length, tried: seen.length, seen })
    }
    const out: Saved = { key: input.key, scores, shots: shots.length }
    fs.mkdirSync(path.dirname(fileOf(forge, code)), { recursive: true })
    fs.writeFileSync(fileOf(forge, code), JSON.stringify(out, null, 2) + '\n', 'utf8')
    return viewOf(forge, out, origin)
  })().finally(() => running.delete(input.key))
  running.set(input.key, job)
  return job
}

/**
 * 생성 안에서 재고 **배치표 줄에 덧붙인다** — 단계 이름은 늘리지 않는다(M8 에 얼렸다). 처음 잴 때는 몇 초~20초라 그동안 그 줄이 「비교 중」으로 돈다.
 * 못 재도 생성은 막지 않는다(그 줄에 까닭)
 */
export async function sceneStep(forge: Forge, code: string, origin: string, steps: RunStep[], emit: Emit): Promise<SceneCheck | null> {
  const at = steps.findIndex((s) => s.name === '배치표')
  const was = steps[at]
  if (!was) return null
  const say = (s: RunStep): void => {
    steps[at] = s
    emit(s)
  }
  if (!savedScene(forge, code, origin)) emit({ name: '배치표', state: 'run', note: 'figma 화면과 원본 장면을 비교하고 있습니다.' })
  let check: SceneCheck | null = null
  let note = ''
  try {
    check = await sceneCheck(forge, code, origin)
    if (check?.better) note = `figma 화면의 장면이 원본과 다릅니다. ${check.better} 학습코드가 더 맞습니다.`
  } catch (error) {
    note = `figma 화면과 원본 장면을 비교하지 못했습니다: ${toMessage(error)}`
  }
  const left = leftoverFiles(forge, code, origin)
  if (left.length) note += `${note ? ' ' : ''}다른 호 원본의 파일 ${left.length}개가 리소스 폴더에 남아 있습니다. 원본 변경에서 휴지통으로 옮길 수 있습니다.`
  say(note ? { ...was, state: check?.better || left.length ? 'warn' : was.state, note: `${was.note} ${note}` } : was)
  return check
}

const base = (rel: string): string => path.basename(rel).replace(/\.png$/i, '')

/**
 * 장면이 더 맞는 후보가 있으면 카드 한 장. 지금 원본이 맞으면 null.
 * 지금 원본을 고르면 확인한 것으로 닫힌다(`rerun.ts`) — 카드 id 에 원본이 들어 있어 원본을 바꾸면 새로 잰다
 */
export function sceneAsk(forge: Forge, check: SceneCheck | null): Ask | null {
  if (!check?.better) return null
  const best = check.scores.find((s) => s.code === check.better)
  const mine = check.scores.find((s) => s.code === check.origin)
  if (!best || !mine) return null
  const found = best.seen.filter((s) => s.ratio >= forge.scenefind.HIT).map((s) => base(s.rel))
  const missing = mine.seen.filter((s) => s.ratio < forge.scenefind.MISS).map((s) => base(s.rel))
  const others = check.scores
    .filter((s) => s.code !== best.code && s.code !== check.origin && s.hits >= 2)
    .map((s) => ({ value: s.code, why: `figma 화면에 이 학습코드의 그림 ${s.hits}개가 있습니다` }))
  return {
    id: `origin-scene|${check.origin}`,
    want: '원본',
    where: ORIGIN_PATH,
    title: `figma 화면의 장면이 원본 ${check.origin} 학습코드와 다릅니다. 원본을 확인하세요.`,
    desc:
      `figma 화면에 ${best.code} 학습코드의 그림 ${found.length}개(${found.join(', ')})가 있습니다. ` +
      `지금 원본의 그림 ${missing.length}개(${missing.join(', ')})는 화면에 없습니다.`,
    give: '맞는 원본을 고르세요. 원본을 바꾸면 처음부터 다시 생성합니다. 지금 원본이 맞으면 지금 원본을 고르세요.',
    options: [
      { value: best.code, why: `figma 화면에 이 학습코드의 그림 ${best.hits}개가 있습니다` },
      ...others,
      { value: check.origin, why: '지금 원본' }
    ],
    shape: 'pick',
    count: 1,
    items: [],
    carry: false,
    byHand: true
  }
}
