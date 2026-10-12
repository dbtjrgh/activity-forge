// 실행 파일에 넣을 poppler 를 vendor/poppler/bin 에 모은다 (2026-10-01).
// 이 PC 에 풀어 둔 poppler(%LOCALAPPDATA%\poppler\*\Library\bin)에서 pdftoppm · pdftotext 와
// 그 둘이 실제로 부르는 DLL 만 고른다 — 통째로는 91MB 다. DLL 은 PE 가져오기 표를 따라가며 모은다(시스템 DLL 은 폴더에 없으니 빠진다).
// 내려받지 않는다. 없으면 실패한다. electron-builder.yml 의 extraResources 가 이 폴더를 resources/poppler 로 넣는다.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const TOOLS = ['pdftoppm.exe', 'pdftotext.exe']
const OUT = join(import.meta.dirname, '..', 'vendor', 'poppler', 'bin')

function sourceBin() {
  const root = join(process.env.LOCALAPPDATA ?? '', 'poppler')
  if (!existsSync(root)) return null
  const dirs = readdirSync(root).filter((d) => existsSync(join(root, d, 'Library', 'bin', TOOLS[0]))).sort()
  return dirs.length ? join(root, dirs[dirs.length - 1], 'Library', 'bin') : null
}

/** PE 파일이 가져오는 DLL 이름(보통 가져오기 + 늦은 가져오기) */
function imports(file) {
  const b = readFileSync(file)
  const pe = b.readUInt32LE(0x3c)
  const sections = b.readUInt16LE(pe + 6)
  const optSize = b.readUInt16LE(pe + 20)
  const opt = pe + 24
  const dirs = opt + (b.readUInt16LE(opt) === 0x20b ? 112 : 96)
  const table = opt + optSize
  const at = (rva) => {
    for (let i = 0; i < sections; i++) {
      const s = table + i * 40
      const va = b.readUInt32LE(s + 12)
      const size = Math.max(b.readUInt32LE(s + 8), b.readUInt32LE(s + 16))
      if (rva >= va && rva < va + size) return rva - va + b.readUInt32LE(s + 20)
    }
    return -1
  }
  const name = (rva) => {
    const o = at(rva)
    return o < 0 ? '' : b.toString('latin1', o, b.indexOf(0, o))
  }
  const out = []
  const walk = (dirIndex, step, nameAt) => {
    const rva = b.readUInt32LE(dirs + dirIndex * 8)
    let o = rva ? at(rva) : -1
    for (; o >= 0 && b.readUInt32LE(o + nameAt); o += step) out.push(name(b.readUInt32LE(o + nameAt)))
  }
  walk(1, 20, 12)
  walk(13, 32, 4)
  return out.filter(Boolean)
}

const src = sourceBin()
if (!src) {
  console.error('poppler 를 찾지 못했습니다. %LOCALAPPDATA%\\poppler 아래에 풀어 두세요(electron_app/README.md).')
  process.exit(1)
}
const here = new Map(readdirSync(src).map((f) => [f.toLowerCase(), f]))
const take = new Set()
const todo = [...TOOLS]
while (todo.length) {
  const f = here.get(todo.pop().toLowerCase())
  if (!f || take.has(f)) continue
  take.add(f)
  todo.push(...imports(join(src, f)))
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
let bytes = 0
for (const f of take) {
  copyFileSync(join(src, f), join(OUT, f))
  bytes += statSync(join(OUT, f)).size
}

// 모은 것만으로 도나 — PATH 에서 다른 poppler 를 빼고 돌린다
const env = { ...process.env, PATH: [OUT, process.env.SystemRoot + '\\System32'].join(';') }
for (const t of TOOLS) {
  const r = spawnSync(join(OUT, t), ['-v'], { env, encoding: 'utf8' })
  if (r.status !== 0 && !/version/i.test(`${r.stdout}${r.stderr}`)) {
    console.error(`${t} 가 모은 파일만으로 실행되지 않습니다: ${r.error?.message ?? r.stderr}`)
    process.exit(1)
  }
}
console.log(`poppler ${take.size}개 파일, ${(bytes / 1048576).toFixed(1)}MB → ${OUT}`)
