/**
 * **figma 화면으로 좌표 찾기를 한 번만 한다** (2026-09-28, M2).
 *
 * 찾기(forge `gen/placefind.ts`)는 그림을 화면 위에 하나씩 대 보는 **동기 계산**이다. MAL2M07W2S1 에서
 * 15초였고, 그동안 메인 스레드가 통째로 멈춰 화면이 부르는 다른 일까지 줄을 섰다 — 학습코드 하나를
 * 여는 데 25~55초가 걸렸다(AI 는 안 불렀는데도).
 *
 * 같은 입력이면 같은 답이다. 그래서 **입력 지문**(화면 · 그림 파일의 크기와 수정 시각 · 값 · 표 규칙)을
 * 열쇠로 `_recipe/<코드>.place.json` 에 남기고, 열쇠가 같으면 다시 계산하지 않는다.
 * 파일을 하나라도 바꾸면 열쇠가 바뀌어 다시 찾는다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { stamp } from './stamp'

/** 화면마다 몇 이닝인가(M6) 까지 남긴다 — 그것이 없는 옛 기록은 다시 찾는다 */
type Found<T> = { hits: T[]; notes: string[]; screens: (number | null)[] }

/** 입력 지문. 그림은 경로 · 크기 · 수정 시각으로 — 내용을 다 읽으면 그것이 또 느려진다 */
export function placeKey(input: { gameData: unknown; tables: unknown; screens: string[]; images: [string, string | null][] }): string {
  const h = crypto.createHash('sha1')
  h.update(JSON.stringify(input.gameData ?? null))
  h.update(JSON.stringify(input.tables ?? null))
  for (const s of input.screens) h.update(`${s}|${stamp(s)}`)
  for (const [alias, file] of input.images) h.update(`${alias}|${file ?? '-'}|${stamp(file)}`)
  return h.digest('hex')
}

export function cachedPlaces<T>(repoRoot: string, code: string, key: string, find: () => Found<T>): Found<T> & { cached: boolean } {
  const at = path.join(repoRoot, '_recipe', `${code}.place.json`)
  try {
    const kept = JSON.parse(fs.readFileSync(at, 'utf8')) as { key?: string } & Found<T>
    if (kept.key === key && Array.isArray(kept.hits) && Array.isArray(kept.screens)) {
      return { hits: kept.hits, notes: kept.notes ?? [], screens: kept.screens, cached: true }
    }
  } catch {
    // 없거나 깨졌으면 새로 찾는다
  }
  const got = find()
  try {
    fs.writeFileSync(at, JSON.stringify({ key, ...got }) + '\n', 'utf8')
  } catch {
    // 못 남겨도 찾은 것은 쓴다 — 다음에 또 찾을 뿐이다
  }
  return { ...got, cached: false }
}
