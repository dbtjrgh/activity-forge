/**
 * **학습코드 일치 검사** (2026-10-14) — 대화가 쓴 Activity.ts 의 `mStudyCode` 와 AssetTable.ts 의 `ActivityCode` · 리소스 경로가 폴더 학습코드와 같은가.
 *
 * 다르면 늘 틀린 것이라 **막는다**(`chatfinish.ts` `blocked`). `mStudyCode` 는 학습 기록의 study_code 로 올라간다(sparkLib `ActivityBase.ts` · `CMS.ts`) —
 * 틀리면 아이의 기록이 다른 학습코드로 간다. 화면은 멀쩡해서 미리보기로는 못 본다.
 * 재 보니 개발 완료 가운데 5개가 원본에서 옮긴 값 그대로 틀려 있었다(5호 MAL1M05W4S1 의 mStudyCode 가 'MAL3M01W4S1' 등) — 대화가 그런 원본을 고르면 그대로 옮긴다.
 *
 * - `/sparklab/common/` · `/sparklab/font` 는 공용 자리다 — 학습코드 꼴인 마디만 견준다
 * - `mStudyCode` 가 아예 없는 것은 막지 않는다 — K12 를 쓰는 KOL1MxxW1S2 12개가 그렇다(모듈이 정하는 꼴이고 기록은 기본값). 원본에는 있는데 빠졌을 때만 막는다
 * - 주석 줄은 안 본다 — 모듈 K16 처럼 `//this.mStudyCode = '…'` 로 남겨 둔 것이 있다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'

/** 학습코드 꼴 — MAL1M05W4S1 · ENL3M04W4S1 · NUL1M01W1S3 */
const STUDY = /^[A-Z]{2}L\d+M\d{2}W\d+S\d+$/

/** 주석 줄을 뺀 글 — 못 읽으면 null */
function liveText(file: string): string | null {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
  } catch {
    return null
  }
}

/** `mStudyCode: string = '…'` · `this.mStudyCode = '…'` 의 값들 */
const studyCodes = (text: string): string[] => [...text.matchAll(/mStudyCode\s*(?::\s*\w+\s*)?=\s*(['"`])([^'"`]*)\1/g)].map((m) => m[2] ?? '')

export type Ident = { ok: boolean; lines: string[] }

/** `act` 는 쓴 액티비티 폴더, `originAct` 는 원본 폴더(없으면 빈 글 — 그때는 빠진 mStudyCode 를 안 막는다) */
export function identCheck(act: string, code: string, originAct = ''): Ident {
  const lines: string[] = []
  const activity = liveText(path.join(act, 'Activity.ts'))
  if (activity !== null) {
    const found = studyCodes(activity)
    for (const v of new Set(found.filter((v) => v !== code))) {
      lines.push(`Activity.ts 의 mStudyCode 가 ${v || '빈 글'} 입니다. 이 학습코드 ${code} 로 바꿔야 합니다.`)
    }
    const origin = originAct ? liveText(path.join(originAct, 'Activity.ts')) : null
    if (!found.length && origin !== null && studyCodes(origin).length) {
      lines.push(`Activity.ts 에 mStudyCode 가 없습니다. 원본처럼 이 학습코드 ${code} 로 적어야 합니다.`)
    }
  }
  const table = liveText(path.join(act, 'AssetTable.ts'))
  if (table !== null) {
    for (const m of table.matchAll(/const\s+ActivityCode\s*(?::\s*\w+\s*)?=\s*(['"`])([^'"`]*)\1/g)) {
      if (m[2] !== code) lines.push(`AssetTable.ts 의 ActivityCode 가 ${m[2] || '빈 글'} 입니다. 이 학습코드 ${code} 로 바꿔야 합니다.`)
    }
    const dirs = new Set([...table.matchAll(/\/sparklab\/([^/`'"$\s]+)\//g)].map((m) => m[1] ?? '').filter((d) => STUDY.test(d) && d !== code))
    for (const d of dirs) lines.push(`AssetTable.ts 가 /sparklab/${d}/ 를 가리킵니다. 이 학습코드 ${code} 의 리소스 자리여야 합니다.`)
  }
  return { ok: lines.length === 0, lines }
}
