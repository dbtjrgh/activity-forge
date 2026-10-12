/**
 * **원본은 받은 리소스의 크기로 고른다** (2026-09-29).
 *
 * 기계는 「같은 칸 · 제일 가까운 호」를 원본으로 뜬다(forge `layoutorigin.ts` `originFor`). 그런데 같은 모듈도 판이 갈린다 —
 * K30 은 홀수 M(3 · 5 · 8호)이 편지 판, 짝수 M(2 · 4 · 7호)이 폴라로이드 판이다. 9호 KOL1M08W1S3 은 가까운 8호(편지)를
 * 떠 와 AI 가 없는 자리(밑줄 · 도장) 여덟을 찾다 18분 · 질문 6개로 막혔다. 받은 그림 크기는 7호와 1:1 이었다
 * (필름 450x234 · 스티커 60x190 · 160x160 · 폴라로이드는 1008x708 의 절반 504x354).
 *
 * 그래서 같은 칸 후보마다 **그림 크기 모음**을 견준다. 같은 크기 · 절반 크기를 짝으로 센다.
 * - **사람이 배치표에 적은 원본(`origin`)은 안 건드린다**
 * - 바꾸는 것은 크게 나을 때만 — 맞은 수가 `BETTER` 이상 많고, 받은 그림의 절반 이상이 맞을 때. 아니면 기계 판정 그대로
 * - 받은 그림이 `MIN_IMAGES` 개보다 적으면 견주지 않는다(리소스가 아직 안 왔다)
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Forge } from './runtime'

const MIN_IMAGES = 5
const BETTER = 3
const PICTURE = /\.png$/i

/** 폴더 안 그림 크기 모음 — 하위 폴더까지. 못 읽는 것은 뺀다 */
function sizes(forge: Forge, dir: string): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    let list: fs.Dirent[] = []
    try {
      list = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of list) {
      const p = path.join(d, e.name)
      // `_figma` · `_원본` 처럼 밑줄로 시작하는 폴더는 리소스가 아니다 — 화면 캡처가 끼면 엉뚱한 후보 점수가 는다
      if (e.isDirectory()) {
        if (!e.name.startsWith('_')) walk(p)
      }
      else if (PICTURE.test(e.name)) {
        const s = forge.png.pngSize(p)
        if (s) out.push(`${s.w}x${s.h}`)
      }
    }
  }
  walk(dir)
  return out
}

/** 받은 크기마다 후보에서 같은 크기 · 두 배 크기(받은 것이 절반)를 하나씩 짝짓는다 */
function score(got: string[], theirs: string[]): number {
  const pool = new Map<string, number>()
  for (const s of theirs) pool.set(s, (pool.get(s) ?? 0) + 1)
  let n = 0
  for (const s of got) {
    const [w, h] = s.split('x').map(Number) as [number, number]
    for (const key of [s, `${w * 2}x${h * 2}`]) {
      const left = pool.get(key) ?? 0
      if (left > 0) {
        pool.set(key, left - 1)
        n += 1
        break
      }
    }
  }
  return n
}

export type OriginFit = { origin: string; note: string }

/**
 * 원본을 바꿀지. 바꾸면 새 원본과 까닭 한 줄, 아니면 null.
 * `origin` · `alt` 는 forge 의 판정 그대로 받는다 — 후보를 여기서 새로 찾지 않는다(두 벌이 된다)
 */
export function fitOrigin(forge: Forge, code: string, origin: string, alt: string[]): OriginFit | null {
  const study = forge.spec.parseStudyCode(code)
  if (!study) return null
  const slot = `L${study.level}W${study.week}S${study.session}`
  const month = String(study.month).padStart(2, '0')
  // 사람이 적은 원본이면 손대지 않는다
  try {
    const file = path.join(forge.paths.REPO_ROOT, '_layout', `${study.subject}${month}.json`)
    const pinned = JSON.parse(fs.readFileSync(file, 'utf8'))?.slots?.[slot]?.origin
    if (pinned) return null
  } catch {
    // 배치표가 없으면 사람이 적은 것도 없다
  }
  const mine = forge.files.rscDir(code)
  if (!mine) return null
  const got = sizes(forge, mine)
  if (got.length < MIN_IMAGES) return null

  const sameSlot = (c: string): boolean => {
    const s = forge.spec.parseStudyCode(c)
    return !!s && s.level === study.level && s.week === study.week && s.session === study.session
  }
  const cands = [...new Set([origin, ...alt])].filter(sameSlot)
  const scored = cands.map((c) => {
    const s = forge.spec.parseStudyCode(c)
    const repo = forge.paths.workPath(`sparkon_m${String(s?.month ?? 0).padStart(2, '0')}`)
    return { code: c, n: score(got, sizes(forge, path.join(repo, 'public', 'sparklab', c))) }
  })
  const now = scored.find((x) => x.code === origin)?.n ?? 0
  const best = scored.reduce((a, b) => (b.n > a.n ? b : a), { code: origin, n: now })
  if (best.code === origin || best.n < now + BETTER || best.n * 2 < got.length) return null
  return {
    origin: best.code,
    note: `받은 그림 크기에 맞춰 원본을 변경했습니다: ${origin} → ${best.code} (그림 ${got.length}개 중 ${best.n}개 일치, 기존 ${now}개)`
  }
}
