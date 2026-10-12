// 저장소 CLAUDE.md 의 파일 목록(src/main · renderer/src 두 덩이)이 디스크와 맞나 본다 — 안 맞으면 실패한다 (2026-09-30).
//
// 구조도를 두 곳에 두면 한쪽이 몇 달씩 낡는다(함정). 목록에서 화면 쪽 파일 39개가 빠져 있었다 — 눈으로는 못 잡는다.
// 규칙: 디스크의 .ts · .tsx 는 목록 줄의 첫 낱말(파일 자리)로 있거나, `/` 로 끝나는 폴더 줄 아래에 있으면 된다.
// 목록에만 있고 디스크에 없는 줄도 알린다. 기댈 것 없이 node 만으로 돈다.
//
//   yarn check:docs
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const docPath = join(app, '..', 'CLAUDE.md')
// 공개본에는 사내 작업 규칙 문서(CLAUDE.md)가 없다 — 그때는 건너뛴다
if (!existsSync(docPath)) {
  console.log('CLAUDE.md 가 없어 파일 목록 검사를 건너뜁니다(공개본).')
  process.exit(0)
}
const doc = readFileSync(docPath, 'utf8').replace(/\r\n/g, '\n')

/** 코드 덩이 가운데 첫 줄이 `head` 인 것의 첫 낱말들 */
function listed(head) {
  const block = doc.split('```').find((b) => b.replace(/^\n/, '').startsWith(head))
  if (!block) throw new Error(`CLAUDE.md 에 「${head}」 로 시작하는 목록이 없습니다.`)
  return block
    .split('\n')
    .slice(2)
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((w) => w && /[./]/.test(w) && !w.startsWith('**'))
}

function walk(dir, base = dir) {
  return readdirSync(dir).flatMap((n) => {
    const at = join(dir, n)
    if (statSync(at).isDirectory()) return walk(at, base)
    return /\.(ts|tsx)$/.test(n) ? [relative(base, at).replace(/\\/g, '/')] : []
  })
}

let bad = 0
for (const [head, root] of [
  ['src/main/', join(app, 'src', 'main')],
  ['renderer/src/', join(app, 'src', 'renderer', 'src')]
]) {
  const words = listed(head)
  const files = new Set(words.filter((w) => !w.endsWith('/')))
  const dirs = words.filter((w) => w.endsWith('/'))
  const missing = walk(root).filter((f) => !files.has(f) && !dirs.some((d) => f.startsWith(d)))
  const stale = words.filter((w) => !existsSync(join(root, w)))
  for (const f of missing) console.log(`목록에 없음  ${head}${f}`)
  for (const w of stale) console.log(`디스크에 없음 ${head}${w}`)
  bad += missing.length + stale.length
}
if (bad) {
  console.log(`\nCLAUDE.md 파일 목록이 디스크와 ${bad}곳 어긋납니다 — 한 줄씩 고쳐 주세요.`)
  process.exitCode = 1
} else console.log('CLAUDE.md 파일 목록이 디스크와 맞습니다.')
