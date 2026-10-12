/**
 * **양산기 폴더가 어디인가 — 앱이 기억하는 자리** (2026-09-18).
 *
 * 앱은 스펙(`_spec`)·배치표(`_layout`)·화면 파일(`src/gen/ui`)을 **디스크의
 * forge repo 에서 읽는다.** 번들에 든 것은 코드뿐이다(`paths.ts` 의 `GEN_DIR`
 * 주석). 그래서 zip 을 받아 압축만 푼 사람은 **repo 를 clone 해서 그 자리를
 * 알려 줘야** 한다. **2026-10-01 부터는 초기 설정(`setup.ts`)이 대신 한다** — 작업 폴더 안
 * `SparkOn-양산기` 에 clone 하고 그 안의 `forge` 를 여기에 적는다. 기억하는 값은 여전히 이것 하나다.
 *
 * **왜 스펙을 앱 안에 넣지 않나** — 넣으면 스펙을 한 장 고칠 때마다 앱을 새로
 * 빌드해 돌려야 한다. 스펙은 사람이 계속 고치는 자료다(`forge/CLAUDE.md`:
 * 「`_spec` 은 커밋하고 `_recipe` 는 안 한다」). clone 을 보게 두면 `git pull`
 * 한 번으로 갱신된다.
 *
 * **왜 `forge/.user.json` 이 아닌가** — 그 파일은 **forge repo 안**에 있다.
 * repo 를 찾으려고 읽어야 하는 값을 repo 안에 두면 닭이 먼저냐가 된다.
 * 그래서 이 값 하나만 앱 쪽(`userData/settings.json`)에 둔다. **나머지 설정의
 * 정본은 그대로 `.user.json` 이다** — 두 벌로 갈라 두지 않는다.
 *
 * Electron 을 import 하지 않는다(services 규칙). `userData` 자리는
 * `configureHome()` 으로 받는다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

/** 앱이 자기 설정을 두는 파일. `configureHome()` 이 정해 준다. */
let settingsFile = ''

/** 앱 시작 때 한 번. Electron 의 `app.getPath('userData')` 를 넘긴다. */
export function configureHome(userDataDir: string): void {
  settingsFile = join(userDataDir, 'settings.json')
}

/**
 * **이 폴더가 양산기 repo 인가.** 폴더 이름을 믿지 않는다 — 앱이 읽어야 하는
 * 것이 실제로 거기 있는지 본다(`_spec` 은 자료, `src/gen` 은 화면 파일과 코드).
 */
export function looksLikeForge(dir: string): boolean {
  if (!dir) return false
  return existsSync(join(dir, '_spec')) && existsSync(join(dir, 'src', 'gen'))
}

/** 사람이 고른 자리를 받을 수 있나. 받을 수 있으면 빈 글, 아니면 왜 안 되는지. */
export function whyNotForge(dir: string): string {
  const clean = dir.trim()
  if (!clean) return '폴더를 고르지 않았습니다.'
  // **절대 경로만 받는다.** 상대 경로는 「지금 서 있는 폴더」에 따라 달라지는데,
  // 앱과 CLI 는 서 있는 자리가 다르다 (`workspace.ts` 와 같은 까닭).
  if (!isAbsolute(clean)) return '절대 경로만 지정할 수 있습니다.'
  if (!existsSync(clean)) return '그런 폴더가 없습니다.'
  if (!looksLikeForge(clean)) {
    return (
      '양산기 폴더가 아닙니다. 폴더 안에 `_spec` 폴더와 `src/gen` 폴더가 있어야 합니다. ' +
      '저장소를 clone 한 위치의 `forge` 폴더를 고르세요.'
    )
  }
  return ''
}

/** 앱이 기억해 둔 자리. 없으면 빈 글이다. */
export function savedForgeRoot(): string {
  const saved = String(read()['forgeRoot'] ?? '').trim()
  // **기억해 둔 자리가 사라졌을 수 있다** — 폴더를 옮기거나 지운 경우다.
  // 그때는 없는 셈 치고 아래 차례(앱 폴더에서 위로 올라가며 찾기)로 넘긴다.
  return saved && looksLikeForge(saved) ? resolve(saved) : ''
}

/** 고른 자리를 적어 둔다. 받을 수 없는 자리면 왜인지 돌려주고 안 적는다. */
export function rememberForgeRoot(dir: string): { ok: boolean; error: string } {
  const why = whyNotForge(dir)
  if (why) return { ok: false, error: why }
  write({ ...read(), forgeRoot: resolve(dir.trim()) })
  return { ok: true, error: '' }
}

function read(): Record<string, unknown> {
  if (!settingsFile || !existsSync(settingsFile)) return {}
  try {
    const got = JSON.parse(readFileSync(settingsFile, 'utf8')) as unknown
    return got && typeof got === 'object' ? (got as Record<string, unknown>) : {}
  } catch {
    // **깨진 설정 때문에 앱이 안 뜨게 두지 않는다.** 없는 셈 치고 넘어간다 —
    // 다음에 폴더를 고르면 성한 글로 덮인다.
    return {}
  }
}

function write(all: Record<string, unknown>): void {
  if (!settingsFile) throw new Error('앱 설정 파일 위치를 아직 정하지 않았습니다.')
  mkdirSync(dirname(settingsFile), { recursive: true })
  writeFileSync(settingsFile, `${JSON.stringify(all, null, 2)}\n`, 'utf8')
}
