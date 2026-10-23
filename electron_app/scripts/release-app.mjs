// 앱 새 버전을 올린다 (2026-10-01) — 빌드한 out/ 을 원격의 app-dist 가지에 커밋 하나로 덮어 올린다.
// 받는 쪽은 src/main/services/forge/appupdate.ts, 여는 쪽은 src/main/boot.ts.
//
//   node scripts/release-app.mjs                 빌드하고 커밋만 만든다(올리지 않음)
//   node scripts/release-app.mjs --push          origin 의 app-dist 에 올린다
//   node scripts/release-app.mjs --push --remote <이름이나 주소>   다른 원격에(시험용)
//   --allow-dirty                                고친 파일이 남아 있어도 빌드한다(시험용 — 올린 판이 어느 커밋인지 흐려진다)
//
// app-dist 는 늘 커밋 하나다(부모 없음, 강제로 덮음) — 받는 사람이 옛 판 기록까지 받지 않게. 판 기록은 main 의 커밋이 대신한다.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { checkBuild } from './check-build.mjs'

const here = join(import.meta.dirname, '..')
// out/ 이 아니라 따로 빌드한다 — 켜 둔 소스 앱(start-app.bat)이 out/ 의 조각을 나중에 읽는데, 지우고 다시 만들면 그 앱이 깨진다
const out = join(here, 'out-release')
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined)
const remote = value('--remote') ?? 'origin'

const git = (args, opts = {}) => execFileSync('git', args, { cwd: here, encoding: 'utf8', ...opts }).trim()
const gitDir = git(['rev-parse', '--absolute-git-dir'])

if (!flag('--allow-dirty') && git(['status', '--porcelain', '--untracked-files=no'])) {
  console.error('고친 파일이 남아 있습니다. 커밋한 뒤 올리세요(시험이면 --allow-dirty).')
  process.exit(1)
}

execFileSync(process.execPath, [join(here, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build', '--outDir', out], {
  cwd: here,
  stdio: 'inherit'
})
const stampFile = join(out, 'main', 'version.json')
if (!existsSync(stampFile) || !existsSync(join(out, 'main', 'boot.js'))) {
  console.error('빌드 결과에 version.json 이나 boot.js 가 없습니다.')
  process.exit(1)
}
const stamp = JSON.parse(readFileSync(stampFile, 'utf8'))

// 깨진 빌드는 올리지 않는다 — 2026-10-01 에 설정을 못 읽는 앱 새 버전이 그대로 나갔다(check-build.mjs)
const verdict = checkBuild(out)
if (verdict.bad.length) {
  console.error('빌드 결과에 문제가 있어 올리지 않습니다.')
  for (const b of verdict.bad) console.error(`  - ${b}`)
  process.exit(1)
}
console.log(`빌드 결과 검사 통과 — 켤 때 값을 정하는 함수 ${verdict.checked}개`)

// 저장소 index 를 건드리지 않게 따로 둔 index 로 out/ 을 나무 하나로 만든다
const index = join(gitDir, 'app-dist.index')
rmSync(index, { force: true })
const env = { ...process.env, GIT_INDEX_FILE: index }
const inOut = (args) => execFileSync('git', [`--git-dir=${gitDir}`, `--work-tree=${out}`, ...args], { cwd: out, encoding: 'utf8', env }).trim()
inOut(['add', '-A', '-f', '.'])
const tree = inOut(['write-tree'])
rmSync(index, { force: true })
const when = new Date(stamp.builtAt).toISOString()
const commit = git(['commit-tree', tree, '-m', `앱 ${stamp.source} (${when})`])
console.log(`app-dist 커밋 ${commit.slice(0, 12)} — 소스 ${stamp.source}, 빌드 ${when}`)

if (!flag('--push')) {
  console.log('올리지 않았습니다(--push 를 붙이면 올립니다).')
  process.exit(0)
}
// **한 번 더 올리고, 그래도 안 되면 칠 명령을 찍는다** (2026-10-14). 이 push 가 `remote: Failed to authenticate user`(보낸 자격 증명을
// 서버가 거부)로 실패했는데 바로 셸에서 친 같은 push 는 됐다. 좁혀 본 것 — 이 스크립트(yarn → node → git)와 셸은 같은 git(mingw64),
// 같은 HOME, 같은 자격 증명 도우미(전역 manager, git.example.com 는 generic)를 쓰고, yarn 은 GIT_* · GCM_* 을 더하지 않는다.
// `lib/git.ts` 처럼 묻기를 막는 값(GIT_TERMINAL_PROMPT=0 · GCM_INTERACTIVE=never)도 여기서는 안 심는다. 남은 짐작은 둘 —
// 저장해 둔 자격 증명이 낡아 거부되고 git 이 그것을 지운 뒤 다음 시도가 새로 받았다, 또는 서버 인증이 잠깐 흔들렸다. 둘 다 한 번 더 하면 된다.
// 실패해도 커밋은 저장소에 만들어져 있어(commit-tree) 해시로 그대로 올릴 수 있다
const pushArgs = ['push', '--force', remote, `${commit}:refs/heads/app-dist`]
const pushed = () => {
  try {
    execFileSync('git', pushArgs, { cwd: here, stdio: 'inherit' })
    return true
  } catch {
    return false
  }
}
if (!pushed()) {
  console.error('올리지 못했습니다. 3초 뒤에 한 번 더 올립니다.')
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000)
  if (!pushed()) {
    console.error('두 번 다 올리지 못했습니다. 커밋은 만들어 두었으니 셸에서 아래 명령을 실행하세요.')
    console.error(`  cd "${here.replace(/\\/g, '/')}"`)
    console.error(`  git ${pushArgs.join(' ')}`)
    process.exit(1)
  }
}
console.log(`${remote} 의 app-dist 에 올렸습니다.`)
