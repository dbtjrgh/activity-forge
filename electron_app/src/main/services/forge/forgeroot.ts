/**
 * **양산기(forge) 폴더를 찾는 셈** — `runtime.ts` 가 242줄이 되어 갈랐다 (2026-09-30, 동작 변화 없음).
 * 부르는 쪽은 여전히 `runtime.ts` 에서 받는다(다시 내보냄). Electron 을 import 하지 않는다(services 규칙).
 */

import { dirname, join, resolve } from 'node:path'
import { looksLikeForge, savedForgeRoot } from './home'

let searchBase: string | null = null
let cachedRoot: string | null = null

/** 앱 시작 때 한 번 부른다. Electron 의 `app.getAppPath()` 를 넘긴다. */
export function configureForge(appPath: string): void {
  searchBase = appPath
  cachedRoot = null
}

/**
 * forge repo 의 뿌리를 찾는다. forge 자신의 `pickRoot()` 와 같은 결의 순서다.
 *
 *   ① `FORGE_REPO_ROOT` 환경변수 — 개발·시험에서 바로 지정할 때
 *   ② **앱이 기억해 둔 자리**(`home.ts`) — zip 을 받아 clone 을 따로 둔 경우
 *   ③ 앱 폴더에서 **위로 올라가며** 만나는 `forge` — 이 저장소를 clone 한 보통의 경우
 *
 * **②가 ③보다 앞이다.** 사람이 골라 둔 것이 저절로 찾은 것보다 세다 — 뒤에
 * 두면 「바꿨는데 옛 폴더를 본다」가 된다.
 *
 * **찾지 못하면 null 이다.** 빈 값을 돌려주고 넘어가지 않는다.
 */
export function findForgeRoot(): string | null {
  if (cachedRoot) return cachedRoot

  const candidates: string[] = []
  const fromEnv = process.env['FORGE_REPO_ROOT']?.trim()
  if (fromEnv) candidates.push(resolve(fromEnv))

  const remembered = savedForgeRoot()
  if (remembered) candidates.push(remembered)

  // 개발 중에는 appPath 가 `electron_app`(1단계 위에 forge), 패키징하면
  // `…/dist/win-unpacked/resources/app.asar`(5단계 위)다. **단계 수를 박아 두면
  // exe 에서만 조용히 못 찾는다** — 2026-09-11 에 3단계까지만 봐서 그랬다.
  // 그래서 위로 올라가며 찾는다. 저장소 구조가 바뀌어도 버틴다.
  if (searchBase) {
    let dir = resolve(searchBase)
    for (let up = 0; up < 8; up++) {
      candidates.push(join(dir, 'forge'))
      const parent = dirname(dir)
      if (parent === dir) break // 드라이브 뿌리에 닿았다
      dir = parent
    }
  }

  for (const dir of candidates) {
    // `_spec` 과 `src/gen` 이 둘 다 있어야 양산기 repo 다. 폴더 이름만 믿지 않는다.
    // **그 판별은 `home.ts` 하나다** — 사람이 고른 자리를 받을지 여기서 다시
    // 정하면 「고를 때는 됐는데 켤 때는 안 되는」 자리가 생긴다.
    if (looksLikeForge(dir)) {
      cachedRoot = dir
      return dir
    }
  }
  return null
}

/**
 * **찾아 둔 것을 버린다.** 사람이 양산기 폴더를 바꾼 뒤에 부른다.
 *
 * `loadForge()` 는 한 번 불러 온 모듈을 그대로 돌려주므로, 이것을 안 부르면
 * 폴더를 바꿔도 **옛 repo 를 계속 본다.** 이미 불러 놓은 forge 모듈 자체는
 * `FORGE_REPO_ROOT` 를 읽어 굳힌 뒤라 갈아 끼울 수 없다 — 그래서 **앱을 다시
 * 켜야 한다**고 화면이 말한다(`workspace.ts`).
 */
export function forgetForgeRoot(): void {
  cachedRoot = null
}

/**
 * 못 찾았을 때 화면에 그대로 띄울 문장.
 *
 * **고칠 길을 같이 적는다.** 「못 찾았습니다」만 띄우면 zip 을 받은 사람은
 * 무엇을 해야 하는지 알 수 없다 (함정 문서: 화면이 「못 한다」고 칸을 닫아
 * 걸면 고칠 길까지 닫힌다).
 */
export function forgeMissingMessage(): string {
  return (
    '양산기(forge) 폴더를 찾지 못했습니다. ' +
    '이 앱은 스펙과 배치표를 저장소의 forge 폴더에서 읽습니다. ' +
    '저장소를 clone 한 뒤 위 「양산기 폴더」에서 그 안의 forge 폴더를 고르세요.'
  )
}
