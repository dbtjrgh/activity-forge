/**
 * 놓은 리소스 파일이 **어디로 가나** — 못 정하면 그 까닭 (`inbox.ts` 에서 떼어 냄).
 *
 * 짐작하지 않는다. 갈래를 못 가리거나 다른 학습코드 이름이 붙은 것은 자리 대신
 * 까닭을 돌려주고, 부르는 쪽이 안 넣고 묻는다 (저장소 CLAUDE.md 6번).
 */

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { Forge } from './runtime'
import type { Found } from './rsccopy'

/** 파일 이름에 붙은 차시 — `enl1m07w1s1_crayon1.png`. */
const CODE_AT = /^([a-z]{2}l\dm\d\dw\ds\d)[_-]/i

/**
 * 리소스 폴더 아래의 갈래 폴더 이름.
 *
 * **놓은 것 안에서 이 이름을 만나면 거기부터가 자리다** — `images/tool/x.png`
 * 처럼 한 겹 더 들어가는 것이 있어서(M30 의 도구 그림), 파일 이름만 보고
 * `images/x.png` 로 눕히면 원본과 자리가 달라진다.
 *
 * **앱 쪽 목록은 이것 하나다** (2026-09-18). `answer.ts`·`slots.ts` 에 사본이
 * 있었고 한쪽엔 `animation` 이 빠져 있었다. 정본은 forge `files.ts` 의
 * `DIR_KIND` 인데, 그것은 `runtime.ts` 를 거쳐야 닿아서 동기 셈에서는 못 쓴다.
 * 그 표에 폴더가 늘면 여기도 같이 늘린다.
 */
const BASES = ['images', 'sounds', 'animations', 'animation', 'font']

/**
 * 화면이 보여 주는 이름(`sounds/nar01.mp3`)에서 **갈래 폴더를 뗀** 이름.
 * 레시피의 `file` 은 그 폴더 안에서의 이름이다.
 *
 * **아는 폴더 이름일 때만** 뗀다 — `tool/pattern1.png` 처럼 한 겹 더 들어간
 * 것은 그 겹이 이름의 일부라 떼면 안 된다.
 */
export function nameInBase(rel: string): string {
  const at = rel.indexOf('/')
  return at > 0 && BASES.includes(rel.slice(0, at)) ? rel.slice(at + 1) : rel
}

/**
 * 이 파일이 리소스 폴더 안 **어디로** 가나. 못 정하면 그 까닭.
 *
 * 순서가 있다 — **놓은 것 안의 폴더 이름이 확장자보다 세다.** `animations/`
 * 아래의 `.json` 은 로티가 확실하지만, 맨 파일로 놓인 `.json` 은 값일 수도
 * 있다.
 */
export function destOf(code: string, one: Found, forge: Forge): { to: string } | { why: string } {
  const name = basename(one.rel)

  // ─ 다른 차시의 것인가 ─
  // 이 화면은 차시 하나를 보고 있으므로 **이름에 차시가 안 붙은 것은 이
  // 차시의 것**이다 (사람이 이 화면에 놓았다). 다른 차시 이름이 붙은 것만
  // 붙들어 둔다 — 그것을 넣으면 남의 자리에 남의 파일이 들어간다.
  const at = CODE_AT.exec(name)
  if (at && at[1].toUpperCase() !== code.toUpperCase()) {
    return { why: `${code} 학습코드가 아닌 ${at[1].toUpperCase()} 학습코드의 파일입니다.` }
  }

  // ─ 영상은 폴더 맨 위 ─ (2026-09-23, 사용자 결정)
  // AssetTable 은 영상을 그림 목록에 올리지만(AssetManager 로 읽는다) 파일은 **액티비티
  // 폴더 바로 아래**에 둔다 — 완성본 mp4 126자리 가운데 80이 그렇고, 영상 모듈 스펙도
  // 「images/ 가 아니라 바로 아래(base: root) — 여기가 제일 자주 틀립니다」라고 적어 두었다.
  // 그림 폴더로 넣었더니 짝은 지어도 파일 검사가 「없다」고 했다.
  if (name.toLowerCase().endsWith('.mp4')) return { to: name }

  // ─ 갈래 폴더 아래에 있었나 ─
  const under = relUnder(one.rel)
  if (under) {
    const kind = forge.files.kindOfRel(under)
    if (!kind) return { why: '파일 종류를 알 수 없습니다.' }
    return { to: under }
  }

  // ─ 맨 파일 — 확장자로 본다 ─
  const kind = forge.files.kindOfRel(name)
  if (!kind) return { why: '확장자로 파일 종류를 알 수 없습니다.' }
  // **`.json` 은 애니일 수도 값일 수도 있다.** 폴더 이름이 없으면 확장자가
  // 못 가리는 자리라, 안을 들여다보고 로티 표식이 있을 때만 애니로 본다.
  if (kind === 'lottie' && name.toLowerCase().endsWith('.json') && !looksLottie(one.from)) {
    return { why: '애니메이션 .json 파일이면 animations 폴더를 통째로 넣으세요.' }
  }
  const dir = forge.files.dirForKind(kind)
  if (!dir) return { why: '넣을 폴더를 정하지 못했습니다.' }
  return { to: `${dir}/${name}` }
}

/**
 * 놓은 것 안의 자리에서 **갈래 폴더부터**를 떼어 낸다.
 *
 * `ENL1M07W1S3/images/tool/x.png` → `images/tool/x.png`.
 * 로티 폴더는 이름이 둘(`animation`·`animations`)인데 **새로 넣는 것은
 * `animations`** 로 맞춘다 — 생성기가 그렇게 쓴다.
 */
function relUnder(rel: string): string | null {
  const parts = rel.split('/')
  const at = parts.findIndex((p) => BASES.includes(p.toLowerCase()))
  if (at < 0) return null
  const rest = parts.slice(at)
  if (rest[0].toLowerCase() === 'animation') rest[0] = 'animations'
  return rest.join('/')
}

/** 로티 JSON 인가. 앞머리만 읽어 표식을 본다 — 통째로 파싱하지 않는다. */
function looksLottie(file: string): boolean {
  try {
    const head = readFileSync(file).subarray(0, 4096).toString('utf8')
    return /"layers"\s*:/.test(head) || (/"fr"\s*:/.test(head) && /"v"\s*:/.test(head))
  } catch {
    return false
  }
}

