/**
 * **figma 화면의 배경으로 원본 판을 고른다 — 대화로 만들기** (2026-10-13, 사용자 불만).
 *
 * 9호 MAL1M08W4S3(M01) figma 는 바다 배경과 배 조종석, 엔딩은 배 낚시다. 같은 판은 MAL1M02W4S3 과 그 파일을 다시 쓴 MAL1M05W4S3 인데
 * 원본은 우주 판 MAL1M07W4S3 으로 정해져(배치표 추천도, 사람이 고른 것도) 대화가 그 판에서 출발했다.
 *
 * - 셈은 forge 다 — 그림 고르기 · 재기 `gen/scenefind.ts`, 배경만 보고 가르기 `gen/scenebackdrop.ts`(왜 배경만인지 거기 머리말)
 * - **대화를 시작할 때 한 번 잰다**(`chatprep.ts`) — AI 를 안 부른다. 배경 한 장에 1초 안팎(3840x2160 풀기)이고 그림마다 쉬어 간다.
 *   결과는 `_recipe/<코드>.backdrop.json` — figma 화면 · 후보가 같으면 다시 안 잰다
 * - `originNow`(`originpick.ts`)는 **남긴 결과만** 읽는다 — 가볍다(폴더 목록 · 도장). 그래서 대화 · 받을 리소스 창 · 원본 변경이 같은 원본을 본다.
 *   대화를 이을 때(`chatresume.ts` `ctxFor`)도 같은 원본이 나와 「원본이 바뀌었습니다」로 막히지 않는다
 * - **사람이 배치표에 적은 원본은 안 바꾼다** — 대화의 앱 글과 원본 변경 창에 알리고 사람이 고른다
 * - 이전 방식의 장면 비교(`scene.ts`)는 그대로 둔다 — 국어 K36 처럼 인물 · 테두리로 가르는 판은 거기서 잡았다(그 화면은 지금 다시 잴 수 없다)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { SceneCheck, SceneScore } from '../../../shared/forge'
import { scoreScenes, shotStamps } from './scene'
import { shotsOf } from './shot'
import type { Forge } from './runtime'

/** 셈을 고치면 올린다 — 남겨 둔 옛 결과를 버린다 */
const VERSION = 1

/** `stamps` — 잰 figma 화면의 이름과 도장 */
type Saved = { key: string; stamps: string[]; scores: SceneScore[]; shots: number }

const fileOf = (forge: Forge, code: string): string => path.join(forge.paths.REPO_ROOT, '_recipe', `${code}.backdrop.json`)

/** 지금 figma 화면과 그 도장. 화면이 없으면 null */
function shotsNow(forge: Forge, code: string): { dir: string; shots: string[]; stamps: string[] } | null {
  const dir = forge.files.rscDir(code)
  if (!dir) return null
  const shots = shotsOf(dir)
  return shots.length ? { dir, shots, stamps: shotStamps(dir, shots) } : null
}

function readSaved(forge: Forge, code: string): Saved | null {
  try {
    return JSON.parse(fs.readFileSync(fileOf(forge, code), 'utf8')) as Saved
  } catch {
    return null
  }
}

/**
 * 남긴 점수 — **잰 figma 화면이 그대로 다 있을 때만.** 그 뒤에 더 붙인 화면은 따지지 않는다 — 대화 중에 화면을 더 붙이는 일이 흔한데,
 * 그때마다 버리면 `originNow` 가 배경으로 바꾼 원본을 되돌려 이어 가던 대화가 「원본이 바뀌었습니다」로 막힌다. 새로 붙인 화면은 다음 시작 때 잰다.
 * 후보 목록도 안 맞대 본다(그것을 세려면 호 저장소를 다 훑어 2초가 넘는다) — 그새 완성본이 늘었으면 새 후보가 빠진 점수지만,
 * 거기 적힌 「이 배경이 화면에 있다」는 그대로 맞다
 */
export function backdropScores(forge: Forge, code: string): SceneScore[] | null {
  try {
    const now = shotsNow(forge, code)
    const s = readSaved(forge, code)
    if (!now || !s || !Array.isArray(s.stamps)) return null
    const have = new Set(now.stamps)
    return s.stamps.every((x) => have.has(x)) ? s.scores : null
  } catch {
    return null
  }
}

/** 배경이 더 맞는 후보 — 남긴 점수로. 지금 원본이 맞거나 잰 것이 없으면 null */
export function backdropBetter(forge: Forge, code: string, now: string): string | null {
  const scores = backdropScores(forge, code)
  return scores ? (forge.scenebackdrop.backdropVerdict(scores, now)?.code ?? null) : null
}

/** 원본 변경 창에 보일 꼴(`SceneCheck`) — 남긴 것만 */
export function savedBackdrop(forge: Forge, code: string, origin: string): SceneCheck | null {
  const scores = backdropScores(forge, code)
  const s = scores ? readSaved(forge, code) : null
  if (!scores || !s) return null
  return { origin, shots: s.shots, scores, better: forge.scenebackdrop.backdropVerdict(scores, origin)?.code ?? null }
}

const running = new Map<string, Promise<SceneScore[] | null>>()

/**
 * 재고 남긴다. figma 화면 · 후보가 같으면 남긴 것. 1x figma 화면이 없거나 후보가 하나면 null.
 * `base` 는 배치표 판정(크기 맞추기까지)의 원본 — 후보 여덟 곳에 늘 넣는다. `choices` 는 forge `originChoices` 그대로(부르는 쪽이 이미 셌다).
 * 새로 잴 때만 `onMeasure` 를 먼저 부른다(배경 한 장에 1초 안팎이라 진행 줄에 알린다)
 */
export async function backdropCheck(
  forge: Forge,
  code: string,
  base: string,
  choices: { module: string; choices: { code: string; sameSlot: boolean }[] },
  onMeasure: () => void = () => {}
): Promise<SceneScore[] | null> {
  const now = shotsNow(forge, code)
  if (!now) return null
  const cands = forge.scenefind.sceneCands(choices.choices, code, base)
  if (cands.length < 2) return null
  const key = JSON.stringify([VERSION, choices.module, cands, now.stamps])
  const saved = readSaved(forge, code)
  if (saved && saved.key === key) return saved.scores
  const busy = running.get(key)
  if (busy) return busy
  onMeasure()
  const job = (async (): Promise<SceneScore[] | null> => {
    const got = await scoreScenes(forge, { dir: now.dir, shots: now.shots, cands, module: choices.module }, code, forge.scenebackdrop.isBackdrop)
    if (!got) return null
    const out: Saved = { key, stamps: now.stamps, scores: got.scores, shots: got.shots }
    fs.mkdirSync(path.dirname(fileOf(forge, code)), { recursive: true })
    fs.writeFileSync(fileOf(forge, code), JSON.stringify(out, null, 2) + '\n', 'utf8')
    return got.scores
  })().finally(() => running.delete(key))
  running.set(key, job)
  return job
}
