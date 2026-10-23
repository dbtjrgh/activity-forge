/**
 * **기획서 글에서 소리 이름을 읽는 규칙** — `plansound.ts` 에서 뗐다(2026-10-23, 200줄을 넘어서. 옮긴 규칙은 동작 변화 없음, 합본 이름 `joined` 는 같은 날 더함).
 * 무엇을 왜 세는지는 `plansound.ts` 머리말이 정본이다. 여기는 이름 꼴(종류 · 줄표 번호 · 합본 · 이어 적은 번호 · 표 칸 끝에서 갈린 이름)과 그 셈만 둔다.
 * 공유 폴더 이름 규칙(`sharerule*`)도 `norm` · `stem` 을 같이 쓴다.
 *
 * 파일을 읽지 않는다. Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import { homeOf, soundReuse, weekNo } from './planreuse'

/** 폭 없는 글자 — 파일 이름에도 기획서 글에도 붙어 온다(함정 문서 U+200B) */
const ZW = /[​-‍⁠﻿]/g
export const norm = (t: string): string => t.normalize('NFKC').replace(ZW, '').replace(/[∼〜～]/g, '~').replace(/\r/g, '')

/** 파일과 기획서 이름을 맞대는 꼴 — 확장자 빼고 소문자(mp3 · wav 가 섞여 온다) */
export const stem = (file: string): string => norm(path.basename(file).replace(/\.[^.]+$/, '')).toLowerCase()

/** 이 학습코드 몫 소리 이름의 앞머리 — MA · KO 만. 영어 · 못 읽는 코드는 null */
export function ownPrefix(code: string): string | null {
  const m = /^(MA|KO)L(\d)M(\d\d)W(\d)S(\d)$/.exec(code)
  if (!m) return null
  return `SL_${m[1].toLowerCase()}_${Number(m[2]) * 100 + weekNo(Number(m[3]), Number(m[4]))}_s${m[5]}_`
}

/** 소리 종류 — 수학 숫자 읽기는 `nb` · `nbc` · `nbcd` · `nbp`(`SL_ma_main_ca_nbcd001`, 2026-10-23) */
const KIND = '(?:nar|sfx|bgm_?|nb(?:cd|c|p)?|guide)'
const FULL = new RegExp(`^SL_[A-Za-z0-9_]*?${KIND}\\d{2,3}`)
/** 번호에 바로 붙은 줄표 한 자리(`nar05-1`)는 이름이다 — 공유 폴더 · 완성본이 그 이름이다(`sharerule.ts` `SL_HEAD`). 두세 자리(`-06`)는 지금처럼 다음 번호 */
const DASH = '(-\\d(?![0-9]))?'

/**
 * 합본 이름(`SL_ma_101_s2_nar10-11`) → 낱개 이름 둘. 합본이 아니면 빈 목록. 기획서는 이 꼴을 낱개 둘로 읽고(위 `DASH`) 합본 이름은 `joined` 로 따로 낸다 —
 * 공유 폴더에는 합본 하나뿐이고(수학 M01 일곱 개, 낱개는 없다) 완성본도 그 이름을 썼다(2026-10-23 검산). 합본이 있으면 낱개 둘은 있는 것으로 센다
 */
const JOINED = new RegExp(`^(SL_[A-Za-z0-9_]*?${KIND})(\\d{2,3})-(\\d{2,3})$`, 'i')
export function joinedParts(name: string): string[] {
  const m = JOINED.exec(name)
  return m ? [m[1] + m[2], m[1] + String(Number(m[3])).padStart(m[2].length, '0')] : []
}

/** `-raw` 에서 표 칸 끝에 갈린 이름(`SL_ma_331_` + 다음 줄 `s3_nar04`)을 잇는다 — 끝이 `_` 이거나 종류 뒤 숫자가 한 자리 이하일 때만 */
function joinWraps(text: string): string {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i].replace(/\s+$/, '')
    const frag = /(?:^|[^A-Za-z0-9_])(SL_[A-Za-z0-9_]*)$/.exec(a)?.[1]
    if (!frag || FULL.test(frag) || !new RegExp(`(?:_|${KIND}\\d?)$`).test(frag)) continue
    let j = i + 1
    while (j < lines.length && lines[j].trim() === '') j++
    const head = j < lines.length ? /^\s*([A-Za-z0-9_]+)/.exec(lines[j])?.[1] : undefined
    if (!head || !FULL.test(frag + head)) continue
    lines[i] = a + head
    lines[j] = lines[j].replace(head, '')
  }
  return lines.join('\n')
}

const NAME = new RegExp(`(?<![A-Za-z0-9_])(SL_[A-Za-z0-9_]*?${KIND})(\\d{2,3})${DASH}(?![0-9])`, 'g')
/** 이름 뒤에 이어 적은 번호 — `·` `,` `/` 는 낱개, `~` 는 범위, `/ _sfx01` 은 종류만 바꿈 */
const CONT = new RegExp(`^\\s*(~|·|,|\\/|및|-)\\s*(_?${KIND})?(\\d{2,3})${DASH}(?![0-9])(?!\\s*(?:초|개|회|번|%|px))`)
/** 학습코드 번호 없는 수학 숫자 읽기 · 공통 효과음 이름 — 이 학습코드 폴더 · 숫자 읽기 공통 폴더에서 이름으로 찾는다(`shareown.ts`) */
const SHARED = /^SL_ma_(?:main|inc|sel)_/i

/** 이름 뒤에 다시 쓴다고 적었나 — 국어 녹음 표 줄 끝 「기존」, 수학 「(기존 재사용)」 */
const REUSE = /기존|재사용/

type Names = { own: string[]; unsure: string[]; others: string[]; near: string[]; shared: string[]; joined: string[] }

/**
 * 기획서 글에서 이 학습코드 몫 이름 — 낱개로 적힌 것(`own`)과 범위로만 나온 것(`unsure`).
 * `others` 는 낱개로 적힌 다른 학습코드 이름 가운데 다시 쓰는 것으로 보이는 것이다(규칙은 `planreuse.ts`, 공유 폴더 가져오기가 쓴다).
 * `near` 는 그 규칙이 안 받은 다른 학습코드 이름, `shared` 는 학습코드 번호 없는 수학 숫자 읽기 이름 — 이 학습코드 공유 폴더에 있을 때만 가져온다(`shareown.ts`).
 * `joined` 는 `own` · `others` 의 낱개 둘을 줄표로 바로 이은 합본 이름(`joinedParts`) — 있을 때만 가져온다(`shareown.ts`)
 */
export function planNames(text: string, code: string): Names {
  const prefix = ownPrefix(code)?.toLowerCase()
  if (!prefix) return { own: [], unsure: [], others: [], near: [], shared: [], joined: [] }
  const body = joinWraps(norm(text))
  const single = new Set<string>()
  const ranged = new Set<string>()
  const tagged = new Set<string>()
  const joined = new Set<string>()
  NAME.lastIndex = 0
  for (let m = NAME.exec(body); m; m = NAME.exec(body)) {
    let base = m[1]
    let num = m[2]
    const chain = [base + num + (m[3] ?? '')]
    let pos = m.index + m[0].length
    for (let c = CONT.exec(body.slice(pos, pos + 30)); c; c = CONT.exec(body.slice(pos, pos + 30))) {
      if (c[2]) base = base.replace(new RegExp(`${KIND}$`), c[2].replace(/^_/, ''))
      if (c[1] === '~' && !c[2]) {
        const [from, to] = [Number(num), Number(c[3])]
        if (to <= from || to - from > 40) break
        for (let k = from + 1; k <= to; k++) ranged.add(base + String(k).padStart(num.length, '0'))
      } else {
        chain.push(base + String(Number(c[3])).padStart(num.length, '0') + (c[4] ?? ''))
        if (/^-\d/.test(c[0]) && !c[2] && !c[4]) joined.add(`${base}${num}-${c[3]}`)
      }
      num = c[3]
      pos += c[0].length
    }
    chain.forEach((n) => single.add(n))
    // 이어 적은 번호 뒤 60자 — 그 줄의 「신규 · 기존」 칸이다
    if (REUSE.test(body.slice(pos, pos + 60))) chain.forEach((n) => tagged.add(n))
    NAME.lastIndex = pos
  }
  const mine = (n: string): boolean => n.toLowerCase().startsWith(prefix)
  const own = [...single].filter(mine).sort()
  const ownSet = new Set(own.map((n) => n.toLowerCase()))
  const home = (n: string): string | null => (mine(n) ? null : homeOf(n))
  const reuse = (n: string): boolean => soundReuse(home(n) ?? '', code, tagged.has(n))
  const of = (keep: (n: string) => boolean): string[] => [...single].filter(keep).sort()
  const others = of((n) => Boolean(home(n)) && reuse(n))
  const asked = new Set([...ownSet, ...others.map((n) => n.toLowerCase())])
  return {
    own,
    unsure: [...ranged].filter((n) => mine(n) && !ownSet.has(n.toLowerCase())).sort(),
    others,
    near: of((n) => Boolean(home(n)) && home(n) !== code && !reuse(n)),
    shared: of((n) => SHARED.test(n)),
    joined: [...joined].filter((j) => joinedParts(j).every((n) => asked.has(n.toLowerCase()))).sort()
  }
}
