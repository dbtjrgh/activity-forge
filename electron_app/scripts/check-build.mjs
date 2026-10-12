// 빌드한 메인 코드가 멀쩡한가 (2026-10-01) — 앱 새 버전 올리기(release-app.mjs)와 실행 파일 만들기(dist:portable)가 올리기 전에 부른다.
//
//   node scripts/check-build.mjs [빌드 폴더]      기본 out
//
// 2026-10-01 에 경로 대소문자 때문에 메인 코드가 두 벌 묶인 채 올라갔다(_document/함정.md). 그때 `configureHome` 의 대입이 빠져
// 앱이 설정을 못 읽고 못 썼다. 그래서 src/main 의 `export function configure…`(켤 때 한 번 값을 정해 두는 함수)마다 본다 —
//   ① 빌드 결과에 **하나만** 있나(두 벌이면 $1 이 붙은 것이 하나 더 있다)
//   ② 몸통에 **대입이 남아 있나**(rollup 이 안 읽힌다고 보고 지우면 `path.join(…)` 만 남는다)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const here = join(import.meta.dirname, '..')

function walk(dir, pick) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p, pick))
    else if (pick(name)) out.push(p)
  }
  return out
}

export function checkBuild(outDir) {
  const names = new Set()
  for (const f of walk(join(here, 'src', 'main'), (n) => n.endsWith('.ts'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/export function (configure\w+)\(/g)) names.add(m[1])
  }
  const bundle = walk(join(outDir, 'main'), (n) => n.endsWith('.js'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
  const bad = []
  for (const name of names) {
    const defs = [...bundle.matchAll(new RegExp(`function ${name}(\\$\\d+)?\\(([^)]*)\\) \\{([\\s\\S]*?)\\n\\}`, 'g'))]
    // 어디서도 안 부르면 rollup 이 빼는 것이 맞다 — 그때는 볼 것이 없다
    if (defs.length === 0) continue
    if (defs.length > 1) bad.push(`${name} 이 ${defs.length}벌 있습니다 — 메인 코드가 두 벌 묶였습니다(빌드 경로 대소문자를 보세요).`)
    for (const d of defs) {
      if (!/[\w$]+(\.[\w$]+)* = /.test(d[3])) bad.push(`${name}${d[1] ?? ''} 의 대입이 빠졌습니다 — 켤 때 정한 값이 안 남습니다.`)
    }
  }
  return { checked: names.size, bad }
}

// 직접 불렸을 때만 — 경로 대소문자가 다를 수 있어(D:\Work · D:\work) 낮춰서 견준다
if (process.argv[1] && import.meta.filename.toLowerCase() === process.argv[1].toLowerCase()) {
  const outDir = join(here, process.argv[2] ?? 'out')
  const { checked, bad } = checkBuild(outDir)
  if (bad.length) {
    console.error(`빌드 결과(${outDir})에 문제가 있어 멈춥니다.`)
    for (const b of bad) console.error(`  - ${b}`)
    process.exit(1)
  }
  console.log(`빌드 결과 검사 통과 — 켤 때 값을 정하는 함수 ${checked}개`)
}
