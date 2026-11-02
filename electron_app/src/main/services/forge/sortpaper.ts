/**
 * **놓은 것 가운데 figma 화면 · 기획서를 제 자리로** (2026-09-29, M5). 넣는 것은 `sort.ts` 가 부른다.
 *
 * 리소스와 달리 이 둘은 파일 이름에 학습코드가 없이 온다 — 화면은 figma 프레임 이름(`7호_Lv1_1주_Word Play`)을,
 * 기획서는 1쪽 제목을 단서로 삼는다. **못 가리면 안 넣고 까닭과 함께 묻는다**(`sort.ts` 와 같은 약속).
 *
 *   figma 화면  프레임 이름 → 학습코드(`section.ts` frameCode) · 크기는 붙여넣기와 같은 가름(`frame.ts`)
 *   MA 기획서   1쪽의 `(MA-L2-M07-W2-S1)` · `07호` · `모듈넘버: M05` — 호가 서로 어긋나면 안 넣는다. 배치표 모듈과 다르면
 *               넣고 작업대의 「기획서대로 바꾸기」를 가리킨다(2026-10-14 — 전에는 안 넣어서 작업대가 견줄 기획서가 없었다)
 *   EN 기획서   `영어 Level 1_01주_Word Spark` — 호 · S 가 없는 공용 기획서라 **공용 자리에 한 번만** 둔다(여쭐 것 7).
 *               학습코드 폴더로 가져가는 것은 만들 때다(`pullCommonPlans`) — AI 는 리소스 폴더 밖을 못 읽는다
 *   KO 기획서   「개발자 전달」 PDF 1쪽 머리 `Lv3_08호 S3` 와 파일 이름의 `9호(M08)_1주`(`section.ts` koPlanCode) — 둘이 안 맞으면 묻는다
 *   NU 기획서   본 적이 없다(공유 폴더 `99. 누리과정/01. 기획` 이 비었다) — 묻는다
 *
 * Electron 을 import 하지 않는다(services 규칙). 1쪽 글은 poppler `pdftotext`(`poppler.ts`), 줄이기는 `imgsize.ts` 의 도구.
 */

import fs from 'node:fs'
import path from 'node:path'
import { HO_OF, type InboxHold, type PaperPlaced } from '../../../shared/forge'
import { toTrash } from '../../lib/trash'
import { FRAME, frameScale } from './frame'
import { resizePng } from './imgsize'
import { listPaper } from './pasted'
import { fillFromPlan, moduleOnPage } from './layoutfill'
import { layoutModuleOf, planVsLayout } from './planmodule'
import { pageText } from './poppler'
import type { Forge } from './runtime'
import { frameCode, koPlanCode, planCode } from './section'
import { putShot } from './shot'

const PICTURE = /\.(png|jpe?g|webp)$/i
/** 공용 EN 기획서 이름 — 제목에서 뜬 레벨 · 주 · 활동 */
const COMMON = /^EN_L(\d)_W(\d\d)_(.+)\.pdf$/i

export type Routed = { placed: PaperPlaced } | { hold: InboxHold }

const hold = (from: string, why: string): Routed => ({ hold: { name: path.basename(from), from, why } })
const same = (a: string, bytes: Buffer): boolean => fs.existsSync(a) && fs.readFileSync(a).equals(bytes)

/** 넣은 기획서의 모듈이 배치표와 어떤가 한 줄(앞에 띄어쓰기) — 다르면 작업대의 「기획서대로 바꾸기」를 가리킨다(`planmodule.ts` 와 같은 셈) */
function planSay(forge: Forge, code: string, module: string, filled: string): string {
  if (filled) return ` ${filled}`
  if (!module) return ' 기획서에서 모듈넘버를 찾지 못했습니다.'
  const layoutModule = layoutModuleOf(forge, code)
  if (!layoutModule) return ` 기획서 모듈넘버는 ${module}이며 배치표는 아직 모듈을 정하지 못했습니다.`
  const cmp = planVsLayout(forge, code, module, layoutModule)
  if (cmp.differs) return ` 기획서 모듈넘버는 ${module}인데 배치표는 ${layoutModule}입니다. 작업대에서 「기획서대로 ${module} 모듈로 바꾸기」를 누르세요.`
  return ` ${cmp.note || `기획서 모듈넘버가 배치표와 같습니다(${module}).`}`
}

async function routePlan(forge: Forge, file: string, overwrite: boolean): Promise<Routed> {
  const read = pageText(file, 1)
  if ('why' in read) return hold(file, read.why)
  const t = read.text
  const bytes = fs.readFileSync(file)

  const ma = planCode(t)
  const code = ma ?? koPlanCode(t, path.basename(file))
  if (code) {
    // 호 이름 세 벌 — 학습코드의 M07 · 제목의 `07호` · `7호`. 하나라도 다르면 어느 호 것인지 모른다.
    // 9호 기획서는 제목이 실제 호(`09호(M08)`)라 M 번호만 보면 9호 MA 기획서가 다 여기서 돌아섰다(2026-10-14) — 둘 다 받는다.
    // 국어는 `koPlanCode` 가 1쪽 머리와 파일 이름의 호를 이미 맞춰 봤다 — 본문에 「기존 2호 재사용」처럼 다른 호가 나온다
    const m = code.slice(5, 7)
    const ho = new Set([Number(m), HO_OF[m]?.order])
    const hos = ma ? [...t.matchAll(/(\d{1,2})\s*호/g)].map((x) => Number(x[1])) : []
    if (hos.some((h) => !ho.has(h))) {
      return hold(file, `제목의 호(${[...new Set(hos)].join(', ')}호)가 ${code} 학습코드와 달라 넣지 않았습니다.`)
    }
    const module = moduleOnPage(t)
    const pick = forge.api.layoutFor(code)
    const dir = forge.files.rscDir(code)
    if (!dir) return hold(file, `${code} 학습코드의 리소스 폴더를 정하지 못했습니다.`)
    const twin = listPaper(dir, 'plan').find((f) => same(path.join(dir, f), bytes))
    if (twin) {
      // 이미 있어도 배치표가 못 정한 칸이면 채운다 — 작업대에 먼저 넣은 기획서는 여기를 안 거친다(`shot.ts` putShot).
      // 안 그러면 진행판에 다시 놓으라는 안내대로 해도 「같은 기획서」에서 돌아서고 영영 「갈림」으로 남는다
      const filled = module && !pick.ok ? await fillFromPlan(forge, code, module, path.join(dir, twin)) : ''
      return { placed: { code, kind: 'plan', file: '', note: `${code} 학습코드에 같은 기획서가 이미 있습니다.${planSay(forge, code, module, filled)}` } }
    }
    // 배치표와 모듈이 달라도 넣는다 — 안 넣으면 작업대가 견줄 기획서가 없어 「기획서대로 바꾸기」를 못 보인다(2026-10-14, 전에는 안 넣었다)
    const got = await putShot(code, bytes, 'plan', '.pdf')
    if (got.error) return hold(file, got.error)
    // 배치표가 못 정한 칸이면 **기획서의 모듈넘버로 채운다** (M7 · `layoutfill.ts`)
    const filled = module && !pick.ok ? await fillFromPlan(forge, code, module, got.file) : ''
    return { placed: { code, kind: 'plan', file: got.file, note: `${code} 기획서를 넣었습니다.${planSay(forge, code, module, filled)}` } }
  }

  const en = /영어\s*Level\s*(\d)\s*_\s*(\d{1,2})\s*주\s*_\s*([^\r\n]+)/i.exec(t)
  if (en) {
    const root = forge.files.rscRoot()
    if (!root) return hold(file, 'EN 기획서를 둘 리소스 폴더가 없습니다. 설정에서 리소스 폴더를 정하세요.')
    const act = en[3].trim().replace(/[\\/:*?"<>|]/g, '')
    const name = `EN_L${en[1]}_W${en[2].padStart(2, '0')}_${act}.pdf`
    const at = path.join(root, '_plan', name)
    // 이미 있으면 `file` 을 비운다 — 학습코드 기획서(위 `twin`)와 같이 「새로 넣은 것은 없음」의 표시다(`sortplan.ts` 가 센다)
    if (same(at, bytes)) return { placed: { code: '', kind: 'plan', file: '', note: `공용 기획서 ${name} 파일이 이미 있습니다.` } }
    if (fs.existsSync(at)) {
      if (!overwrite) return hold(file, `내용이 다른 ${name} 파일이 이미 있습니다. 버전을 확인하고 「덮어쓰기」를 누르세요.`)
      await toTrash(at)
    }
    fs.mkdirSync(path.dirname(at), { recursive: true })
    fs.writeFileSync(at, bytes)
    return { placed: { code: '', kind: 'plan', file: `_plan/${name}`, note: `공용 기획서로 넣었습니다(Level ${en[1]}, ${Number(en[2])}주, ${act}).` } }
  }
  return hold(file, '기획서에서 학습코드를 읽지 못했습니다. 작업대의 기획서 칸에 넣으세요.')
}

async function routeFrame(forge: Forge, file: string, code: string): Promise<Routed> {
  const size = forge.rscsize.imageSize(file)
  if (!size) return hold(file, 'PNG 가 아닙니다. figma 에서 PNG 로 내보내세요.')
  const k = frameScale(size.w, size.h)
  if (typeof k === 'string') return hold(file, k)
  const raw = fs.readFileSync(file)
  const png = k === 1 ? raw : resizePng(file, FRAME.width, FRAME.height)
  if (!png) return hold(file, '1920×1080 으로 줄이지 못했습니다.')
  const got = await putShot(code, png, 'figma', '.png', k === 1 ? null : raw)
  return got.error ? hold(file, got.error) : { placed: { code, kind: 'figma', file: got.file, note: got.note } }
}

/** 화면 · 기획서면 제 자리로 보내고 결과를, 아니면 null(여느 리소스 파일) */
export async function routePaper(forge: Forge, file: string, overwrite: boolean): Promise<Routed | null> {
  if (/\.pdf$/i.test(file)) return routePlan(forge, file, overwrite)
  if (!PICTURE.test(file)) return null
  const got = frameCode(path.parse(file).name)
  if (!got) return null
  return 'why' in got ? hold(file, got.why) : routeFrame(forge, file, got.code)
}

/**
 * **공용 EN 기획서를 그 학습코드 폴더로** — 레벨 · 주가 같고 활동 이름이 모듈 이름 앞머리일 때(`Word Spark` ↔ `WordSparkLv1`).
 * 이미 같은 이름이 있으면 안 가져온다. 가져온 이름들을 돌려준다. 리소스 폴더가 없으면 아무것도 안 한다.
 */
export function pullCommonPlans(forge: Forge, code: string, module: string): string[] {
  const study = forge.spec.parseStudyCode(code)
  const root = forge.files.rscRoot()
  const dir = forge.files.rscDir(code)
  if (!study || study.subject !== 'EN' || !root || !dir || !fs.existsSync(dir)) return []
  const common = path.join(root, '_plan')
  if (!fs.existsSync(common)) return []
  const mod = module.toLowerCase()
  const took: string[] = []
  for (const name of fs.readdirSync(common)) {
    const m = COMMON.exec(name)
    if (!m || Number(m[1]) !== study.level || Number(m[2]) !== study.week) continue
    if (!mod.startsWith(m[3].replace(/\s+/g, '').toLowerCase())) continue
    const to = path.join(dir, '_plan', name)
    if (fs.existsSync(to)) continue
    // 이름만 다르고 내용이 같은 것이 이미 있으면 안 가져온다 — AI 에게 같은 기획서가 두 번 실린다
    const bytes = fs.readFileSync(path.join(common, name))
    if (listPaper(dir, 'plan').some((f) => same(path.join(dir, f), bytes))) continue
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(path.join(common, name), to)
    took.push(name)
  }
  return took
}
