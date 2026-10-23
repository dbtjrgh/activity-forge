/**
 * **기획서에 적힌 이 학습코드 소리 이름** (2026-10-14) — 리소스가 모자란지를 개수가 아니라 이름으로 말하는 근거.
 *
 * 전에는 원본 하나와 종류별 파일 수만 견줬다. 완성본 835개로 재 보니 다 넣은 완성본도 같은 모듈 다른 완성본과 견주면
 * 짝의 49%에서 「부족」이 떴다(뜰 때 평균 12.5개) — 같은 모듈도 이닝 · 장면 수가 학습코드마다 다르다(함정 문서).
 * 기획서 녹음 표에는 이 학습코드 몫 소리 이름이 적혀 있다. MA · KO 21개 학습코드에서 낱개로 적힌 이름 312개 중 308개가
 * 완성본 파일과 맞았고, 안 맞은 넷 중 둘(MAL1M08W4S1 nar02, MAL1M08W3S3 nar01)은 AssetTable 주석이 「받지 못함」이라 적은 진짜 빠진 소리였다.
 *
 * - **이 학습코드 몫만** 센다 — `SL_<ma|ko>_<L×100+(M−1)×4+W>_s<S>_`. 공용(com · cor · quiz …)은 앱이 가져오고,
 *   다른 학습코드 기획서가 섞여 와도 이름 앞머리가 안 맞아 저절로 빠진다(그래서 1쪽 제목으로 주인을 가리지 않는다)
 * - **범위로만 나온 이름은 세지 않는다**(`unsure`) — KOL3M08W1S3 머리 칸이 `nar01~16` 인데 표와 완성본은 10개였다
 * - 영어는 자기 소리가 번호 없는 `SL_en_word_<낱말>` 이고 기획서가 여러 호 공용이라 가르지 못한다 — 안 센다고 말한다
 * - 기획서 글은 쪽 수에 따라 1초쯤 걸린다(메인 스레드). `_recipe/<코드>.plansound.json` 에 기획서 도장째 남긴다
 * 글에서 이름을 읽는 규칙(이름 꼴 · 이어 적은 번호 · 합본)은 `plannames.ts` 다(2026-10-23, 200줄을 넘어 뗐다). 부르는 쪽은 여기서 같이 받는다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import { norm, ownPrefix, planNames } from './plannames'
import { planLotties } from './planreuse'
import { docText } from './poppler'
import type { Forge } from './runtime'
import { pageOwner } from './section'
import { plansOf } from './shot'
import { stamp } from './stamp'

export { joinedParts, norm, ownPrefix, planNames, stem } from './plannames'

export interface PlanSound {
  own: string[]
  unsure: string[]
  /** 다시 쓰는 다른 학습코드 소리 이름(`planreuse.ts`) */
  others: string[]
  /** 그 규칙이 안 받은 다른 학습코드 소리 이름 · 수학 숫자 읽기 이름 — 이 학습코드 공유 폴더에 있을 때만 가져온다(`shareown.ts`) */
  near: string[]
  shared: string[]
  /** 낱개 둘을 줄표로 이은 합본 이름(`nar10-11`) — 있을 때만 가져오고, 가져오면 낱개 둘은 「없음」이 아니다 */
  joined: string[]
  /** 다시 쓰는 다른 학습코드 로티 후보 — 그림 이름과 꼴이 같아 로티 자리에 있는 것만 고른다(`sharepick.ts`) */
  lotties: string[]
  /** 이름으로 못 셌으면 까닭 — 비면 `own` 이 믿을 만하다 */
  note: string
}

/** 리소스 폴더 `_plan` 의 PDF 전부에서 — 기획서 도장이 같으면 남긴 것을 읽는다 */
export function planSound(forge: Forge, code: string, rscDir: string): PlanSound {
  const none = (note: string): PlanSound => ({ own: [], unsure: [], others: [], near: [], shared: [], joined: [], lotties: [], note })
  if (!ownPrefix(code)) return none(code.startsWith('EN') ? '영어는 기획서로 소리 이름을 확인하지 않습니다.' : '')
  const pdfs = plansOf(rscDir)
    .filter((rel) => /\.pdf$/i.test(rel))
    .map((rel) => path.join(rscDir, rel))
  if (!pdfs.length) return none('기획서가 없어 소리를 이름으로 확인하지 못합니다.')
  // v5 — `near` · `shared` · `joined`, 줄표 번호 이름, 넓힌 로티 이름 꼴(2026-10-23). 앞 판으로 남긴 것은 그것이 없어 다시 읽는다
  const key = ['v5', ...pdfs.map((f) => `${path.basename(f)}|${stamp(f)}`)].join('\n')
  const cache = path.join(forge.paths.REPO_ROOT, '_recipe', `${code}.plansound.json`)
  try {
    const kept = JSON.parse(fs.readFileSync(cache, 'utf8')) as { key: string; got: PlanSound }
    if (kept.key === key) return kept.got
  } catch {
    // 처음이거나 못 읽음 — 다시 읽는다
  }
  const own = new Set<string>()
  const unsure = new Set<string>()
  const [others, near, shared, joined, lotties] = [new Set<string>(), new Set<string>(), new Set<string>(), new Set<string>(), new Set<string>()]
  const prefix = (ownPrefix(code) as string).toLowerCase()
  const mine = (n: string): boolean => n.toLowerCase().startsWith(prefix)
  for (const f of pdfs) {
    const read = docText(f)
    // 못 읽은 것은 남기지 않는다 — poppler 를 고친 뒤 다시 읽게
    if ('why' in read) return none(read.why)
    const got = planNames(read.text, code)
    got.own.forEach((n) => own.add(n))
    got.unsure.forEach((n) => unsure.add(n))
    // 합본 이름은 낱개 이름을 따라간다 — 이 학습코드 몫은 남의 기획서에서도, 다른 학습코드 것은 아래 거르기 뒤에
    got.joined.filter(mine).forEach((n) => joined.add(n))
    // 다른 학습코드 이름은 **남의 기획서에서는** 안 받는다 — MAL1M08W2S3 폴더에 W3S3 기획서가 같이 들어 있어 그 새 소리 52개를
    // 「앞 호 소리」로 가져올 뻔했다. 1쪽 주인이 다른 학습코드로 확실할 때만 거른다 — 주인을 못 읽는 국어 기획서에 다시 쓰는 이름만
    // 적힌 것(KOL2M08W2S3, 완성본이 쓴 `229_s2` 6개)까지 버렸다(2026-10-15 검토). 거르는 나머지는 `planreuse.ts` 규칙이 한다
    const text = norm(read.text)
    const owner = pageOwner(text.split('\f')[0] ?? '')
    if (owner && owner !== code) continue
    got.others.forEach((n) => others.add(n))
    got.near.forEach((n) => near.add(n))
    got.shared.forEach((n) => shared.add(n))
    got.joined.forEach((n) => joined.add(n))
    planLotties(text, code).forEach((n) => lotties.add(n))
  }
  const got: PlanSound = {
    own: [...own].sort(),
    unsure: [...unsure].filter((n) => !own.has(n)).sort(),
    others: [...others].sort(),
    near: [...near].sort(),
    shared: [...shared].sort(),
    joined: [...joined].sort(),
    lotties: [...lotties].sort(),
    note: own.size ? '' : '기획서에서 이 학습코드 소리 이름을 찾지 못했습니다.'
  }
  try {
    fs.mkdirSync(path.dirname(cache), { recursive: true })
    fs.writeFileSync(cache, JSON.stringify({ key, got }))
  } catch {
    // 남기지 못해도 이번 결과는 쓴다
  }
  return got
}
