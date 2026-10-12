/**
 * **붙여넣어 쌓아 두는 것** — figma 화면과 기획서가 이것을 같이 쓴다 (2026-09-21).
 *
 * 둘은 사람이 주는 길(Ctrl+V · 끌어다 놓기)도, 쌓이는 꼴도, 지우는 길도 같다.
 * 다른 것은 **어느 폴더에 두나 · 무엇을 받나 · AI 가 무엇으로 보나** 셋뿐이다.
 * 그래서 폴더를 다루는 셈은 여기 하나로 두고 `shot.ts` 가 갈래를 골라 부른다.
 * 두 벌로 두면 한쪽에서 고친 것이 다른 쪽에 안 간다(저장소 규칙 3).
 *
 * **왜 갈래를 나누나** — 값을 정하는 근거가 다르기 때문이다.
 *
 *   figma 화면  어느 **그림**이 어느 자리에 어느 차례로 오나
 *   기획서      어떤 **낱말·숫자·차례**인가 — 값의 정본
 *
 * 완성본이 그렇게 만들어졌다. `MAL2M07W2S1` 의 `GameData.ts` 주석은
 * 「기획서 10쪽 표와 대조해 그대로다」라고 적고 있고, 그 표의 내용은 리소스
 * 파일 이름에도 화면 캡처 한 장에도 없다. 2026-09-21 에 완성본 셋을 다시
 * 만들어 견줘 보니 **리소스 표는 77% 가 맞는데 값은 32% 였다.**
 *
 * 둘 다 `_` 로 시작하는 폴더에 둔다 — 맞추기가 리소스로 세지 않는다
 * (`swapfolder.ts` 의 `readFolder`).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import { toTrash } from '../../lib/trash'

/** 붙여넣은 것의 갈래. 채널 인자로 그대로 오므로 **글자를 바꾸지 않는다.** */
export type Paper = 'figma' | 'plan'

interface Rule {
  dir: string
  exts: string[]
  /** 사람에게 보일 이름 */
  label: string
}

/**
 * 갈래마다 다른 것 **한 표에 모은다.** 여기 한 줄을 더하면 서비스·채널·화면이
 * 다 따라온다.
 *
 * **기획서는 PDF 도 받는다.** `claude -p` 가 여는 `Read` 가 그림과 PDF 를
 * 읽는다 — PPT·엑셀은 못 연다. 그런 것은 해당 쪽을 캡처해서 붙이면 된다.
 */
const RULES: Record<Paper, Rule> = {
  figma: { dir: '_figma', exts: ['.png', '.jpg', '.jpeg', '.webp'], label: 'figma 화면' },
  plan: { dir: '_plan', exts: ['.png', '.jpg', '.jpeg', '.webp', '.pdf'], label: '기획서' }
}

/**
 * PDF 가 몇 쪽인가. **군더더기를 안 늘리려고 세기만 한다** — `/Type /Page` 를
 * 센다. 쪽 나무가 압축된 파일에서는 0 이 나올 수 있고, 그때는 쪽수를 말하지
 * 않는다(모르는 것을 지어내지 않는다 — 저장소 규칙 6).
 */
export function pagesOf(rscDir: string, file: string): number {
  if (!rscDir || !file.toLowerCase().endsWith('.pdf')) return 0
  try {
    const raw = fs.readFileSync(path.join(rscDir, file), 'latin1')
    return (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length
  } catch {
    return 0
  }
}

/** 받는 그림 한 장의 상한(바이트) */
const IMAGE_MAX = 20 * 1048576

export function ruleOf(kind: Paper): Rule {
  return RULES[kind]
}

/** 아는 갈래인가. 렌더러에서 온 글을 그대로 믿지 않는다. */
export function isPaper(kind: unknown): kind is Paper {
  return kind === 'figma' || kind === 'plan'
}

/**
 * 그 폴더에 쌓인 것 **전부.** 붙인 차례(이름순)다 — 이름에 찍은 때가 들어 있다.
 *
 * **하나만 주는 함수는 두지 않는다.** 있으면 다음에 무심코 그것을 써서 둘째
 * 장부터 조용히 안 보게 된다.
 */
export function listPaper(rscDir: string, kind: Paper): string[] {
  const rule = RULES[kind]
  const dir = path.join(rscDir, rule.dir)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => rule.exts.includes(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => `${rule.dir}/${f}`)
}

/**
 * 바이트를 그 폴더에 쓴다. 쓴 자리와 이제 몇 개인지를 돌려준다.
 *
 * 언제 넣은 것인지가 이름에 남는다 — 「이것이 지금 것 맞나」를 볼 수 있게.
 * **같은 초에 두 번 넣으면 이름이 겹치므로** 뒤에 번호를 붙인다. 안 그러면
 * 두 번째가 첫 번째를 덮어써 **넣었는데 안 늘어난다.**
 */
export function savePaper(
  rscDir: string,
  kind: Paper,
  bytes: Buffer,
  ext = '.png'
): { file: string; total: number } {
  const rule = RULES[kind]
  // **그림은 20MB 까지** (M5) — figma 4x 한 장이 10MB 남짓이다. 넘는 것은 잘못 고른 것이고, 받으면
  // AI 에게 그대로 실려 한 번 부를 때마다 무거워진다. PDF 기획서는 쪽이 많아 여기서 안 막는다
  if (ext !== '.pdf' && bytes.length > IMAGE_MAX) {
    throw new Error(`그림 크기가 ${Math.round(bytes.length / 1048576)}MB 라 받지 않았습니다. ${IMAGE_MAX / 1048576}MB 까지 받을 수 있습니다.`)
  }
  const dir = path.join(rscDir, rule.dir)
  fs.mkdirSync(dir, { recursive: true })

  const at = new Date()
  const two = (n: number): string => String(n).padStart(2, '0')
  const head = kind === 'plan' ? 'plan' : 'screen'
  const stem =
    `${head}-${at.getFullYear()}${two(at.getMonth() + 1)}${two(at.getDate())}` +
    `-${two(at.getHours())}${two(at.getMinutes())}${two(at.getSeconds())}`
  let name = `${stem}${ext}`
  for (let n = 2; fs.existsSync(path.join(dir, name)); n += 1) name = `${stem}-${two(n)}${ext}`

  fs.writeFileSync(path.join(dir, name), bytes)
  return { file: `${rule.dir}/${name}`, total: listPaper(rscDir, kind).length }
}

/**
 * **지우는 것은 휴지통으로** (M5, `lib/trash.ts`). 전에는 `fs.rmSync` 로 영구 삭제였다 —
 * 「모두 지우기」 한 번에 붙인 화면이 되살릴 길 없이 사라졌다.
 * 붙인 것 한 장과, 1x 로 줄이며 남긴 원래 것(`_원본/` 같은 이름, `ipc/shots.ts` oneX)을 같이 휴지통으로 */
async function trashOne(rscDir: string, file: string): Promise<void> {
  const at = path.join(rscDir, file)
  const kept = path.join(path.dirname(at), '_원본', path.basename(at))
  await toTrash(at)
  if (fs.existsSync(kept)) await toTrash(kept)
}

/** 한 개만 지운다. 목록에 있는 이름인지 **여기서 다시 본다.** */
export async function dropPaper(rscDir: string, kind: Paper, file: string): Promise<boolean> {
  if (!listPaper(rscDir, kind).includes(file)) return false
  await trashOne(rscDir, file)
  return true
}

/** 통째로 지운다. 몇 개를 지웠는지 돌려준다. */
export async function clearPaper(rscDir: string, kind: Paper): Promise<number> {
  const all = listPaper(rscDir, kind)
  for (const f of all) await trashOne(rscDir, f)
  return all.length
}

/**
 * **브리프에 넣을 기획서 토막.** 없으면 빈 배열이라 그대로 펼치면 된다.
 *
 * **한 곳에 둔다.** 이 글이 값 고치기·짜임·이름차례 셋에 다 들어가는데,
 * 세 벌로 적으면 한쪽만 고쳐진다(저장소 규칙 3). 특히 **figma 와 기획서 중
 * 어느 쪽이 값의 정본인가**는 셋이 똑같이 알아야 한다.
 */
export function planBlock(plans: string[], rscDir = ''): string[] {
  if (!plans.length) return []
  const many = plans.some((f) => pagesOf(rscDir, f) > 10)
  return [
    `## 이 액티비티의 기획서 ${plans.length}개`,
    ...plans.map((f) => {
      const n = pagesOf(rscDir, f)
      return `- \`${f}\`` + (n ? ` (${n}쪽)` : '')
    }),
    '',
    // **쪽수를 먼저 알려 준다** (2026-09-21). `Read` 는 PDF 를 한 번에 열 쪽까지만
    // 연다. 몇 쪽인지 모르면 한꺼번에 읽으려다 그 벽에 부딪힌 뒤에야 나눠 읽기
    // 시작해서, 묶음마다 헛걸음이 는다. 실제 기획서 셋이 21·26·36쪽이었다.
    ...(many
      ? [
          '**PDF 는 한 번에 열 쪽까지만 열린다.** `pages` 를 `1-10` · `11-20` 처럼',
          '나눠 읽어라. 앞쪽에 차례와 화면 흐름이, 가운데에 **낱말·숫자 표**가 있는 것이',
          '보통이다. 찾는 표가 나올 때까지 넘겨 가며 읽어라.',
          ''
        ]
      : []),
    '**값은 기획서가 정본이다.** 어떤 낱말인지 · 어떤 숫자인지 · 어느 차례인지는',
    '여기 적혀 있다. figma 화면은 **어느 그림이 어느 자리에 오는지**를 보는 것이다.',
    '둘이 어긋나 보이면 **값은 기획서를 따르고** 자리는 화면을 따른다.',
    '쪽이 많으면 한꺼번에 읽지 말고 **필요한 쪽만 나눠 읽어라.**',
    ''
  ]
}

/**
 * 사람이 읽을 한 줄. 브리프가 아니라 **화면에 보여 줄 글**이다.
 * 없으면 빈 글이라, 부르는 쪽이 이 값으로 「있나」를 그대로 가른다.
 */
export function paperNote(files: string[]): string {
  if (!files.length) return ''
  return files.length === 1 ? files[0] : `${files[0]} 외 ${files.length - 1}개`
}
