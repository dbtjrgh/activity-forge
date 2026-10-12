/**
 * **AI 에게 보여 줄 것을 받는 자리** — figma 화면과 기획서.
 *
 *   figma 화면  어느 **그림**이 어느 자리에 어느 차례로 오나
 *   기획서      어떤 **낱말·숫자·차례**인가 — **값의 정본**
 *
 * 차례는 파일 이름에 없다(8호의 차례는 알파벳순도 파일순도 아니었다). 화면을
 * 보면 열두 자리가 한 번에 정해지고, 없으면 AI 를 불러도 답이 안 나온다 —
 * 그래서 `shotfirst.ts` 는 화면이 없으면 **부르지 않고 달라고 한다.**
 *
 * **기획서는 그 빗장에 넣지 않는다** (2026-09-21). 없다고 멈추면 여태 되던
 * 것까지 막힌다. 있으면 값이 그쪽을 따르고, 없으면 여태처럼 간다.
 * 왜 기획서가 필요한지는 `pasted.ts` 머리말에 재 놓은 값이 있다 —
 * 완성본 셋을 다시 만들어 보니 **리소스 표는 77%, 값은 32%** 였다.
 *
 * **넣는 길은 붙여넣기다** (2026-09-16 사용자 말). 「폴더를 찾아 들어가 파일을
 * 저장해서 넣어라」는 도구가 사람에게 시킬 일이 아니다 — figma 에서 캡처하고
 * 화면에서 Ctrl+V 하면 그만이다. 기획서는 PDF 를 끌어다 놓아도 된다.
 *
 * **여러 장을 둔다** (2026-09-21 사용자 말 — 「여러개 figma 붙여놓을수도 있으니까」).
 * 전에는 붙일 때마다 앞 장을 지우고 **첫 장만** 봤다. 그런데 한 장에 다 안
 * 보이는 것이 오히려 보통이다. 그래서 **쌓아 두고 브리프가 전부를 이름으로
 * 부른다.** 지우는 것은 사람이 한 장씩 또는 통째로 한다.
 *
 * 폴더를 다루는 셈은 `pasted.ts` 하나다 — 여기는 갈래를 골라 부르고 **양산
 * 흐름이 쓰는 이름**(`shotsOf`·`plansOf`)만 낸다.
 *
 * **Electron 을 import 하지 않는다**(services 규칙). 클립보드를 읽는 것과
 * 미리보기를 줄여 그리는 것은 `ipc/` 가 한다.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ShotResult } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { josa } from '../../lib/josa'
import { poppler } from './poppler'
import { loadForge } from './runtime'
import { mark } from './measure'
import { clearPaper, dropPaper, listPaper, pagesOf, paperNote, ruleOf, savePaper, type Paper } from './pasted'

/** figma 화면을 두는 자리. 리소스 폴더 안의 이 폴더만 본다. */
export const SHOT_DIR = ruleOf('figma').dir
/** 기획서를 두는 자리. */
export const PLAN_DIR = ruleOf('plan').dir

/** 리소스 폴더의 `_figma` 안에 있는 그림 **전부.** 붙인 차례다. */
export function shotsOf(rscDir: string): string[] {
  return listPaper(rscDir, 'figma')
}

/** 리소스 폴더의 `_plan` 안에 있는 기획서 **전부.** */
export function plansOf(rscDir: string): string[] {
  return listPaper(rscDir, 'plan')
}

/**
 * **10쪽 넘는 기획서 PDF 를 이 PC 에서 AI 가 열 수 있나** (2026-09-28). `claude -p` 의 `Read` 는
 * 쪽을 나눠 열 때 poppler 의 `pdftoppm` 을 부른다. 없으면 에러가 아니라 AI 가 「기획서를 못
 * 열었다」며 **기획서 없이 답한다** — MAL2M07W2S1 에서 악기 소리를 번호순으로 짝지었다.
 * 못 열 것 같으면 걸음 글에 붙일 한 줄, 괜찮으면 빈 글.
 */
export function planGap(rscDir: string, plans: string[]): string {
  if (!plans.some((f) => pagesOf(rscDir, f) > 10)) return ''
  // M5 — PATH 에 있나가 아니라 **실제로 돌려 본다** (`poppler.ts`). AI 의 `Read` 가 부르는 것은 `pdftoppm` 하나다 —
  // `pdftotext` 가 mingw 판이어도 AI 는 연다(그것은 기획서 칸의 가르기 몫이라 거기서 따로 말한다)
  const p = poppler()
  return p.tools.some((t) => t.name === 'pdftoppm') ? '' : `10쪽이 넘는 기획서 PDF 는 AI 가 열지 못할 수 있습니다. ${p.why}`
}

/** 사람에게 보여 줄 한 줄. 없으면 빈 글이다. */
export function shotNote(files: string[]): string {
  return paperNote(files)
}

/** 붙여넣은 바이트를 그 갈래 폴더에 쓴다. */
export function saveShot(
  rscDir: string,
  bytes: Buffer,
  kind: Paper = 'figma',
  ext = '.png'
): { file: string; total: number } {
  return savePaper(rscDir, kind, bytes, ext)
}

/**
 * 그 학습코드의 리소스 폴더에 받은 것을 넣는다.
 *
 * **폴더가 없으면 만든다.** 리소스를 아직 안 부은 회차에도 화면부터 붙여넣을
 * 수 있어야 한다.
 */
export async function putShot(
  code: string,
  bytes: Buffer,
  kind: Paper = 'figma',
  ext = '.png',
  /** 1x 로 줄이기 전의 것 (M4, `ipc/shots.ts` oneX) — 같은 이름으로 `_원본/` 에 둔다. `imgsize.ts` 와 같은 자리 이름 */
  original: Buffer | null = null
): Promise<ShotResult> {
  try {
    const forge = await loadForge()
    const dir = forge.files.rscDir(code)
    if (!dir) return { file: '', note: '', error: '리소스 폴더 위치를 정하지 못했습니다.' }
    // **똑같은 것은 다시 안 받는다** (2026-10-02) — KOL1M08W2S3 에서 「캔」 화면이 바이트까지 같게 두 번 붙고
    // 다섯째 낱말 화면이 빠졌다. AI 는 장 수만 보고 다섯 판을 다 받은 줄 알아 낱말 하나를 영영 못 찾는다
    const twin = listPaper(dir, kind).find((f) => {
      const at = path.join(dir, ruleOf(kind).dir, path.basename(f))
      try {
        return fs.statSync(at).size === bytes.length && fs.readFileSync(at).equals(bytes)
      } catch {
        return false
      }
    })
    if (twin) return { file: '', note: '', error: `같은 파일이 이미 있습니다(${path.basename(twin)}). 다른 ${ruleOf(kind).label}${josa(ruleOf(kind).label, '을', '를')} 넣으세요.` }
    // 붙여넣는 것도 사람이 시킨 일이다 (1단계 시험대).
    mark(forge.paths.REPO_ROOT, code, '화면')
    const got = saveShot(dir, bytes, kind, ext)
    if (original) {
      const keep = path.join(dir, ruleOf(kind).dir, '_원본')
      fs.mkdirSync(keep, { recursive: true })
      fs.writeFileSync(path.join(keep, path.basename(got.file)), original)
    }
    const what = ruleOf(kind).label
    return {
      file: got.file,
      note:
        `${what}${josa(what, '을', '를')} 받았습니다: ${got.file}` +
        (original ? ' (1920×1080 으로 줄이고 원래 파일은 _원본/ 폴더에 두었습니다)' : '') +
        (got.total > 1 ? ` (모두 ${got.total}개)` : '')
    }
  } catch (error) {
    return { file: '', note: '', error: toMessage(error) }
  }
}

/**
 * **끌어다 놓은 파일을 그대로 넣는다** (기획서 PDF 가 이 길로 온다).
 *
 * 받은 것은 `ipc/` 가 검사한 절대 경로다. 갈래가 받는 확장자인지는 **여기서
 * 다시 본다** — 파일을 쓰는 자리라 한 겹 더 둔다.
 */
export async function addShotFile(code: string, from: string, kind: Paper): Promise<ShotResult> {
  try {
    const ext = path.extname(from).toLowerCase()
    const rule = ruleOf(kind)
    if (!rule.exts.includes(ext)) {
      return {
        file: '',
        note: '',
        error: `${rule.label}${josa(rule.label, '으로', '로')} 받을 수 있는 파일은 ${rule.exts.join(', ')} 형식입니다. PPT나 엑셀은 해당 쪽을 캡처해 붙여넣으세요.`
      }
    }
    if (!fs.existsSync(from)) return { file: '', note: '', error: '파일이 없습니다.' }
    return await putShot(code, fs.readFileSync(from), kind, ext)
  } catch (error) {
    return { file: '', note: '', error: toMessage(error) }
  }
}

/** 붙여넣은 것을 **모두** 지운다 (화면의 「모두 지우기」). */
export async function dropShot(code: string, kind: Paper = 'figma'): Promise<ShotResult> {
  try {
    const dir = await rscOf(code)
    if (!dir) return { file: '', note: '', error: '리소스 폴더 위치를 정하지 못했습니다.' }
    const n = await clearPaper(dir, kind)
    const what = ruleOf(kind).label
    return { file: '', note: n ? `${n}개를 지웠습니다.` : `지울 ${what}${josa(what, '이', '가')} 없습니다.` }
  } catch (error) {
    return { file: '', note: '', error: toMessage(error) }
  }
}

/**
 * **한 개만** 지운다 (화면의 ✕).
 *
 * `file` 은 렌더러에서 온 글이다. 신뢰 경계 검사는 `ipc.ts` 가 먼저 하지만
 * (저장소 규칙), 파일을 지우는 자리라 `pasted.ts` 가 한 겹 더 본다.
 */
export async function dropOneShot(
  code: string,
  file: string,
  kind: Paper = 'figma'
): Promise<ShotResult> {
  try {
    const dir = await rscOf(code)
    if (!dir) return { file: '', note: '', error: '리소스 폴더 위치를 정하지 못했습니다.' }
    if (!(await dropPaper(dir, kind, file))) {
      return { file: '', note: '', error: '파일이 없습니다. 목록을 다시 불러오세요.' }
    }
    const left = listPaper(dir, kind).length
    return { file: '', note: `${file} 파일을 지웠습니다.` + (left ? ` (남은 ${left}개)` : '') }
  } catch (error) {
    return { file: '', note: '', error: toMessage(error) }
  }
}

/** 그 학습코드의 리소스 폴더 자리. 못 정하면 빈 글. */
export async function rscOf(code: string): Promise<string> {
  const forge = await loadForge()
  return forge.files.rscDir(code) ?? ''
}