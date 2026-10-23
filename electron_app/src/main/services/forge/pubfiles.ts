/**
 * **호 저장소 리소스 자리(`public/sparklab/<코드>`)에 있는 것과 AssetTable 이 부르는 것** — 셈은 여기 하나 (2026-10-12).
 *
 * 대화 뒤 「없는 파일」 검사(`chatfinish.ts`, 부르는데 없는 것)와 「안 쓰는 리소스」(`pubextra.ts`, 있는데 안 부르는 것)가 같이 쓴다.
 * 「받았는데 안 쓴 리소스」(`unusedRsc`, 리소스 폴더에 왔는데 안 부르는 것)도 같은 `wantOf` 를 본다.
 * 둘이 따로 세면 한쪽은 `animation/` 을, 다른 쪽은 `animations/` 를 보게 된다(함정 — 완성본 로티 폴더).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Forge } from './runtime'

/** 그 자리의 파일 전부 — 대소문자 그대로, `/` 로 */
export function listPub(dir: string): string[] {
  try {
    return (fs.readdirSync(dir, { recursive: true, withFileTypes: true }) as fs.Dirent[])
      .filter((e) => e.isFile())
      .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
  } catch {
    return []
  }
}

/** AssetTable 의 로티 경로 상수가 가리키는 폴더 — 주석 줄은 안 본다. 못 찾으면 null */
function aniDir(act: string): string | null {
  let text = ''
  try {
    text = fs.readFileSync(path.join(act, 'AssetTable.ts'), 'utf8')
  } catch {
    return null
  }
  const live = text.split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n')
  return /\/sparklab\/\$\{\w+\}\/(animations?)\b/.exec(live)?.[1] ?? null
}

/** 리소스로 칠 확장자 — 기획서 · figma 화면은 `_plan` · `_figma` 에 따로 있다 */
const RSC_EXT = /\.(png|jpe?g|webp|gif|svg|mp3|wav|ogg|m4a|json|ttf|otf|woff2?|mp4|webm)$/i

/** 보이지 않는 글자(U+200B · U+200C · U+200D · U+2060 · U+FEFF, 함정) — 소스에 그 글자를 그대로 두지 않으려고 코드로 만든다 */
const ZW = new RegExp(`[${String.fromCharCode(0x200b, 0x200c, 0x200d, 0x2060, 0xfeff)}]`, 'g')

/** 이름 견주기 — 확장자 · 대소문자 · 보이지 않는 글자를 뺀다 */
const stem = (p: string): string =>
  p.split('/').pop()!.normalize('NFKC').replace(ZW, '').replace(/\.[^.]+$/, '').toLowerCase()

/** 모듈 Assets.ts 가 등록하는 파일 이름들 — 못 읽으면 빈 목록 */
function moduleFiles(moduleDir: string): string[] {
  try {
    const text = fs.readFileSync(path.join(moduleDir, 'Assets.ts'), 'utf8')
    return [...text.matchAll(/\/([^/`'"]+\.[a-z0-9]{2,5})[`'"]/gi)].map((m) => stem(m[1]))
  } catch {
    return []
  }
}

const md5 = (file: string): string => {
  try {
    return createHash('md5').update(fs.readFileSync(file)).digest('hex')
  } catch {
    return ''
  }
}

/**
 * **받았는데 안 쓴 리소스** (2026-10-14) — 리소스 폴더에 왔는데 AssetTable 이 부르는 어느 파일도 아닌 것.
 * 9호 MAL2M08W1S3 은 기획서의 새 정답 파티클 둘이 리소스 폴더에만 있고 AssetTable 에 안 들어가 성공 이펙트가 빠졌다 — 아무 검사도 안 짚었다.
 * 이름이 같거나(대소문자 무시) · 대화가 그 파일을 가져다 부르는 자리에 놓았거나 · 내용이 같으면(이름을 바꿔 넣은 것 · 「(1)」 사본) 쓴 것으로 본다.
 * `_` 로 시작하는 폴더(`_plan` · `_figma` · `_원본`)와 리소스가 아닌 파일은 안 본다. **막지 않는다** — 일부러 안 쓴 것도 있다.
 * 맨 위 `animatecc/` 도 안 본다 — 인터북 폴더라 AssetTable 이 아니라 그 안 매니페스트(`animatecc/*.js`)가 부른다(`pubextra.ts`).
 * 공유 폴더 가져오기가 인터북 소리를 거기에 넣어(2026-10-23) 그대로면 맨 위에 「안 쓴 소리」로 줄지어 나온다
 */
export function unusedRsc(rsc: string, pub: string, want: string[], took: { from: string; to: string }[], moduleDir = ''): string[] {
  const files = listPub(rsc).filter((f) => !f.split('/').some((p) => p.startsWith('_')) && !/^animatecc\//i.test(f) && RSC_EXT.test(f))
  if (!files.length) return []
  const wanted = new Set(want.map((w) => w.toLowerCase()))
  // 모듈이 스스로 등록하는 파일(정답 · 오답 소리 같은 것)은 디자인이 같이 보내도 쓰는 것이다
  const names = new Set([...want.map(stem), ...moduleFiles(moduleDir)])
  const taken = new Set(took.filter((t) => wanted.has(t.to.toLowerCase())).map((t) => path.resolve(rsc, t.from).toLowerCase()))
  let hashes: Set<string> | null = null
  // 소리 · 로티(이펙트)를 그림보다 앞에 — 그림은 참고 캡처 · 별 그린 판이 많아 빠뜨린 이펙트가 뒤에 묻힌다
  const rank = (f: string): number => (/\.(json|mp3|wav|ogg|m4a)$/i.test(f) ? 0 : 1)
  return files
    .filter((f) => {
      if (names.has(stem(f)) || taken.has(path.resolve(rsc, f).toLowerCase())) return false
      hashes ??= new Set(want.map((w) => md5(path.join(pub, w))).filter(Boolean))
      return !hashes.has(md5(path.join(rsc, f)))
    })
    .sort((a, b) => rank(a) - rank(b))
}

/** AssetTable 이 부르는 파일(그 자리 안 경로). 레시피는 늘 `animations/` 로 읽으므로 AssetTable 의 로티 폴더로 고친다 */
export function wantOf(forge: Forge, recipe: unknown, act: string): string[] {
  const ani = aniDir(act)
  return [...new Set(forge.common.relOf(recipe as Parameters<Forge['common']['relOf']>[0]).values())].map((r) =>
    ani && r.startsWith('animations/') ? `${ani}/${r.slice('animations/'.length)}` : r
  )
}
