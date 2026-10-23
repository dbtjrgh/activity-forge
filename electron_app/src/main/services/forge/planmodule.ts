/**
 * **기획서 1쪽 모듈넘버와 배치표 모듈을 견준다** (2026-10-14 사용자 — 「모듈이 다른 경우 잘 보이도록」).
 *
 * 9호 MAL3M08W2S1 은 배치표(9호 모듈표)가 M30 인데 기획서는 `모듈 변경: M30 → M30_3` 이었다. 앱 어디에도 다르다는 말이 없었고,
 * 대화 속 Claude 가 기획서를 읽고서야 물었다. 그 사이 받을 리소스 창은 M30 원본으로 받을 그림을 보였다.
 *
 * - 읽는 셈은 `layoutfill.ts` 의 `moduleOnPage` 하나 — 진행판에 놓을 때(`sortpaper.ts`) · 배치표 채우기와 같다
 * - **다르다고 하는 것은 기획서 모듈에 모듈 폴더(또는 스펙)가 있을 때만**이다. `M30_1` · `M30_2` 는 M30 의 판이라 알리기만 한다
 * - 기획서 글은 `_recipe/<코드>.planmodule.json` 에 기획서 도장째 남긴다(`plansound.ts` 와 같은 꼴) — pdftotext 가 메인 스레드를 잡는다.
 *   남기는 것은 기획서에서 읽은 것뿐이다. 배치표와 견주는 것은 부를 때마다 한다 — 바꾼 뒤에도 「다름」이 남지 않게
 * - 진행판은 남긴 것만 읽는다(`keptPlanDiff`) — 진행판을 열 때 기획서를 새로 읽지 않는다
 * - 바꾸는 길은 사람 답과 같다(`layoutasks.ts` `pickModule`). 렌더러는 학습코드만 보낸다 — 무엇으로 바꿀지는 여기서 다시 읽는다
 * - 개발 완료 학습코드는 견주지 않는다 — 작업대가 호 저장소의 실제 모듈로 연다(`prepare.ts`)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import { oneModule, type PlanModule } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { doneOf } from './chatothers'
import { chatBusy, chatFile, readChat } from './chatstore'
import { finishedAt } from './hallwalk'
import { pickModule } from './layoutasks'
import { fillFromPlan, moduleKnown, moduleOnPage } from './layoutfill'
import { pageText } from './poppler'
import { loadForge, type Forge } from './runtime'
import { pageOwner } from './section'
import { plansOf } from './shot'
import { stamp } from './stamp'

/** 기획서에서 읽은 것 — 이것만 남긴다. 읽는 꼴(`moduleOnPage`)을 고치면 `KEY` 를 올린다 */
type Read = { module: string; plan: string; note: string }
const KEY = 'v1'

/** 견줄 과목 — 영어 기획서는 여러 호 공용이라 모듈넘버가 없다(9호 EN 기획서 둘 다 없음) */
const SUBJECTS = new Set(['MA', 'KO'])

const cacheOf = (forge: Forge, code: string): string => path.join(forge.paths.REPO_ROOT, '_recipe', `${code}.planmodule.json`)

/** 그 폴더 기획서 PDF 와 도장 — 남긴 것이 지금 것인가를 가르는 열쇠 */
function plansNow(dir: string): { pdfs: string[]; key: string } {
  const pdfs = plansOf(dir)
    .filter((rel) => /\.pdf$/i.test(rel))
    .map((rel) => path.join(dir, rel))
  return { pdfs, key: [KEY, ...pdfs.map((f) => `${path.basename(f)}|${stamp(f)}`)].join('\n') }
}

function kept(forge: Forge, code: string, key: string): Read | null {
  try {
    const k = JSON.parse(fs.readFileSync(cacheOf(forge, code), 'utf8')) as { key: string; got: Read }
    return k.key === key ? k.got : null
  } catch {
    return null
  }
}

/** 기획서마다 1쪽을 읽는다 — 다른 학습코드 기획서는 빼고, 남은 것끼리 모듈이 갈리면 모른다고 한다 */
function readPlans(forge: Forge, code: string, dir: string): Read | { why: string } {
  const { pdfs, key } = plansNow(dir)
  if (!pdfs.length) return { module: '', plan: '', note: '' }
  const was = kept(forge, code, key)
  if (was) return was
  const found: { module: string; plan: string }[] = []
  const others: string[] = []
  for (const f of pdfs) {
    const read = pageText(f, 1)
    // 못 읽은 것은 남기지 않는다 — poppler 를 고친 뒤 다시 읽게
    if ('why' in read) return { why: read.why }
    const owner = pageOwner(read.text)
    if (owner && owner !== code) {
      others.push(`기획서 ${path.basename(f)} 파일은 ${owner} 학습코드의 기획서입니다.`)
      continue
    }
    const module = moduleOnPage(read.text)
    if (module) found.push({ module, plan: path.basename(f) })
  }
  const kinds = [...new Set(found.map((x) => x.module))]
  const got: Read =
    kinds.length === 1
      ? { module: kinds[0] as string, plan: (found[0] as { plan: string }).plan, note: others.join(' ') }
      : { module: '', plan: '', note: [kinds.length > 1 ? `기획서마다 모듈넘버가 다릅니다(${kinds.join(', ')}).` : '', ...others].filter(Boolean).join(' ') }
  try {
    fs.mkdirSync(path.dirname(cacheOf(forge, code)), { recursive: true })
    fs.writeFileSync(cacheOf(forge, code), JSON.stringify({ key, got }))
  } catch {
    // 남기지 못해도 이번 결과는 쓴다
  }
  return got
}

/** 배치표가 정한 모듈 — 갈림이면 빈 글. 원본이 없는 새 모듈의 첫 학습코드도 모듈은 있다(`layoutFor` 는 못 연다) */
export function layoutModuleOf(forge: Forge, code: string): string {
  const at = forge.layout.placementFor(code)
  return at && at.verdict !== '갈림' ? oneModule(at.module) : ''
}

/** 기획서 모듈과 배치표 모듈 — 다른가 · 알릴 한 줄. 진행판(`keptPlanDiff`)과 작업대가 같은 셈을 쓴다 */
export function planVsLayout(forge: Forge, code: string, planModule: string, layoutModule: string): { differs: boolean; note: string } {
  if (!planModule || !layoutModule || planModule === layoutModule) return { differs: false, note: '' }
  if (!moduleKnown(forge, code.slice(0, 2), planModule)) {
    return { differs: false, note: `기획서 모듈넘버 ${planModule}에 맞는 모듈 폴더가 없어 배치표의 ${layoutModule} 모듈을 그대로 씁니다.` }
  }
  return { differs: true, note: '' }
}

/** 호 저장소에서 개발 완료인가 — 폴더 셈은 `chatothers.ts` `doneOf` 하나(대화 · 원본 고르기와 같다) */
const finished = (forge: Forge, code: string): boolean => finishedAt(doneOf(forge, code).act) === true

/**
 * 그 학습코드의 기획서 모듈과 배치표 모듈 — 작업대 · 받을 리소스 창이 부르고, 대화 시작 경고 · 첫 지시도 이것을 부르면 된다.
 * 기획서는 처음 한 번만 읽는다(도장이 같으면 남긴 것). 던지지 않는다
 */
export function planModuleOf(forge: Forge, code: string): PlanModule {
  const out: PlanModule = { code, planModule: '', plan: '', layoutModule: '', differs: false, note: '' }
  try {
    if (!SUBJECTS.has(code.slice(0, 2)) || finished(forge, code)) return out
    const dir = forge.files.rscDir(code)
    if (!dir || !fs.existsSync(dir)) return out
    const read = readPlans(forge, code, dir)
    if ('why' in read) return { ...out, error: read.why }
    const layoutModule = layoutModuleOf(forge, code)
    const cmp = planVsLayout(forge, code, read.module, layoutModule)
    return { ...out, planModule: read.module, plan: read.plan, layoutModule, differs: cmp.differs, note: [cmp.note, read.note].filter(Boolean).join(' ') }
  } catch (error) {
    return { ...out, error: toMessage(error) }
  }
}

/**
 * 그 학습코드 `_plan` 에 이미 놓인 기획서로 배치표를 채운다 — 배치표를 못 정해 작업대를 열었는데 기획서가 먼저 와 있을 때(`prepare.ts`).
 * 2026-10-14 에 `layoutfill.ts` 에서 옮겼다 — 기획서를 한 장씩 따로 읽어 첫 장이 이겼다. 이제 위 `readPlans` 하나로 읽고, 기획서끼리 모듈이 갈리면 안 채운다.
 * 채웠으면 한 줄, 아니면 빈 글
 */
export async function fillFromPlans(forge: Forge, code: string): Promise<string> {
  const dir = forge.files.rscDir(code)
  if (!dir || !code.startsWith('MA') || !fs.existsSync(dir)) return ''
  const read = readPlans(forge, code, dir)
  if ('why' in read || !read.module) return ''
  return fillFromPlan(forge, code, read.module, read.plan)
}

export async function planModuleFor(code: string): Promise<PlanModule> {
  try {
    return planModuleOf(await loadForge(), code)
  } catch (error) {
    return { code, planModule: '', plan: '', layoutModule: '', differs: false, note: '', error: toMessage(error) }
  }
}

/**
 * 진행판 칸 — **남긴 결과만** 읽는다. 기획서가 바뀌었거나 아직 안 읽었으면 빈 글(모른다). 다르면 기획서 모듈.
 * `layoutModule` 은 진행판이 이미 센 배치표 모듈(갈림이면 빈 글)
 */
export function keptPlanDiff(forge: Forge, code: string, layoutModule: string): string {
  if (!layoutModule || !fs.existsSync(cacheOf(forge, code))) return ''
  const dir = forge.files.rscDir(code)
  if (!dir) return ''
  const read = kept(forge, code, plansNow(dir).key)
  return read && planVsLayout(forge, code, read.module, oneModule(layoutModule)).differs ? read.module : ''
}

/**
 * 「기획서대로 바꾸기」 — 배치표 그 칸의 모듈을 기획서 모듈로(사람 답과 같은 길). 적어 둔 원본은 같이 지워진다(그 모듈 완성본에서 다시 고른다).
 * 대화가 도는 중이면 안 바꾼다 — 원본이 바뀌어 이어 쓰던 것이 엉킨다
 */
export async function usePlanModule(code: string): Promise<PlanModule> {
  let forge: Forge
  try {
    forge = await loadForge()
  } catch (error) {
    return { code, planModule: '', plan: '', layoutModule: '', differs: false, note: '', error: toMessage(error) }
  }
  const now = planModuleOf(forge, code)
  if (now.error) return now
  if (chatBusy(code)) return { ...now, said: '대화가 진행 중이라 모듈을 바꿀 수 없습니다. 대화가 끝난 뒤 다시 누르세요.' }
  if (!now.differs) return { ...now, said: '기획서와 배치표의 모듈이 다르지 않아 바꾸지 않았습니다.' }
  const why = `기획서 1쪽 모듈넘버 ${now.planModule} (${now.plan}). 배치표의 ${now.layoutModule} 대신 기획서대로 정했습니다.`
  const done = await pickModule(code, now.planModule, why)
  if (!done.ok) return { ...now, said: `배치표에 저장하지 못했습니다. ${done.note}` }
  const chat = fs.existsSync(chatFile(forge.paths.REPO_ROOT, code)) && readChat(forge.paths.REPO_ROOT, code).sessionId
  const said = [
    done.note,
    `원본은 ${now.planModule} 모듈 완성본에서 다시 고릅니다.`,
    // 이어 가는 대화는 다음 답부터 새 모듈 원본 · 완성본 폴더를 연다(`chatresume.ts`) — 옛 모듈로 이미 쓴 파일이 있을 때만 다시 만든다
    chat ? `이미 시작한 대화는 다음 답부터 ${now.planModule} 모듈 폴더로 이어 갑니다. ${now.layoutModule} 모듈로 이미 만든 파일이 있으면 「처음부터 다시 만들기」를 누르세요.` : ''
  ]
  return { ...planModuleOf(forge, code), said: said.filter(Boolean).join(' ') }
}
