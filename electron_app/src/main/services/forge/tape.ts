/**
 * **AI 에게 물은 것과 받은 답을 녹음해 두고 다시 튼다** (2026-09-23).
 *
 * **왜 만드나 — 오늘 이것이 없어서 값을 치렀다.** 도구를 한 줄 고칠 때마다
 * 확인하는 길이 **17분짜리 전체 실행 하나**뿐이다. 게다가 AI 가 회차마다 다르게
 * 답해서(같은 코드가 125 → 227 → 141초, 카드 13 → 19 → 14) **내 변경 탓인지
 * 그냥 흔들린 것인지**를 매번 손으로 파야 한다. 2026-09-23 에 「번호 차례를
 * 믿지 마라」한 줄이 리소스 표를 103 → 85 로 떨어뜨린 것을 찾는 데 반나절을 썼다.
 *
 * 녹음이 있으면 **AI 를 안 부르고** 같은 답으로 파이프라인만 다시 돌릴 수 있다.
 *
 *   17분 · 토큰 나감 · 숫자가 흔들림   →   몇 초 · 토큰 0 · 똑같이 나옴
 *
 * **실제로 재 봤다** (2026-09-23, 완성돼 있는 M07 세 회차를 「아무것도 모르는
 * 채」 다시 만들기) —
 *
 * | | 녹음한 판 | 그 녹음으로 다시 돈 판 |
 * |---|---|---|
 * | MAL2M07W2S1 | 481초 | **1초** |
 * | ENL1M07W1S3 | 170초 | **0초** |
 * | ENL3M07W3S1 | 557초 | **0초** |
 * | 녹음 장수 | 19장 | **19장** (하나도 새로 안 물었다) |
 *
 * 만든 파일 24장이 **글자 하나까지 같았고**, 걸음 · 에러 목록 · 카드 목록도
 * 셋 다 같았다. 20분이 1초가 됐다.
 *
 * **여기서 하나를 더 알게 됐다 — 20분 가운데 도구가 쓰는 시간은 1초다.**
 * 나머지는 전부 AI 를 기다리는 시간이었다. 그러니 도구를 빠르게 만드는 일에
 * 손대지 마라. 빨라질 것이 없다.
 *
 * **무엇을 재는지 분명히 해 둔다 — 도구를 재지 AI 를 재지 않는다.** 답이 고정
 * 되므로 「AI 가 다르게 답하면 어떻게 되나」는 여기서 안 나온다. 그것은 여전히
 * 진짜로 돌려 봐야 안다. 여기서 잡는 것은 **답이 같은데 결과가 달라진 것** —
 * 곧 도구가 망가진 것이다.
 *
 * **열쇠는 보낸 글이다.** 물음이 한 글자라도 다르면 다른 물음이다. 그래서
 * 브리프를 바꾸는 변경은 그 자리에서 **못 맞고(miss)**, 그때는 갈래가 둘이다 —
 *
 *   `warm`   못 맞은 것만 진짜로 부르고 녹음한다. **나머지는 공짜다**
 *   `strict` 못 맞으면 오류로 돌려준다. 「고쳤는데 물음은 그대로인가」를 볼 때
 *
 * 켜는 법 (환경변수) —
 *
 *   FORGE_AI_TAPE=<폴더>       그 폴더에 녹음한다. 없으면 이 파일은 아무 일도 안 한다
 *   FORGE_AI_TAPE_STRICT=1     못 맞은 것을 부르지 않고 오류로 만든다
 *
 * **앱에는 기본으로 꺼져 있다.** 환경변수를 안 심으면 `off` 라 전과 똑같이 돈다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { AiReply } from './ai'

export type TapeMode = 'off' | 'warm' | 'strict'

/** 녹음할 자리. 비면 꺼진 것이다. */
function tapeDir(): string {
  return (process.env['FORGE_AI_TAPE'] ?? '').trim()
}

export function tapeMode(): TapeMode {
  if (!tapeDir()) return 'off'
  return (process.env['FORGE_AI_TAPE_STRICT'] ?? '').trim() ? 'strict' : 'warm'
}

/**
 * 한 물음의 열쇠. **`lookIn` 도 넣는다** — 같은 글이라도 그림을 볼 수 있느냐에
 * 따라 답이 달라진다(두 판으로 나눈 까닭이 그것이다).
 */
function keyOf(brief: string, lookIn?: string): string {
  return crypto
    .createHash('sha1')
    .update(`${lookIn ? 'look' : 'blind'}\n${brief}`)
    .digest('hex')
    .slice(0, 16)
}

/** 이번 실행에서 몇 개를 틀었고 몇 개를 진짜로 불렀나. */
let played = 0
let called = 0
let missed = 0

export function tapeStat(): { played: number; called: number; missed: number } {
  return { played, called, missed }
}

/** 화면·걸음에 적을 한 줄. 꺼져 있으면 빈 글이라 그대로 이어 붙이면 된다. */
export function tapeNote(): string {
  if (tapeMode() === 'off' || played + called + missed === 0) return ''
  return (
    ` · 녹음 ${played}개를 그대로 틀었습니다` +
    (called ? ` · ${called}개는 새로 물어 녹음했습니다` : '') +
    (missed ? ` · ${missed}개는 녹음에 없습니다` : '')
  )
}

/**
 * 녹음된 답. 없으면 `null`.
 *
 * **`took` 은 0 으로 바꾸지 않는다.** 그때 실제로 얼마나 걸렸는지가 남아 있어야
 * 「녹음으로 돌린 판」과 「진짜로 돈 판」의 시간을 견줄 수 있다.
 */
export function tapeGet(brief: string, lookIn?: string): AiReply | null {
  const dir = tapeDir()
  if (!dir) return null
  try {
    const raw = fs.readFileSync(path.join(dir, `${keyOf(brief, lookIn)}.json`), 'utf8')
    const got = JSON.parse(raw) as { reply?: AiReply }
    if (!got.reply) return null
    played += 1
    return got.reply
  } catch {
    return null
  }
}

/**
 * 답을 녹음한다. **보낸 글도 같이 남긴다** — 나중에 「무엇을 물었길래 저 답이
 * 나왔나」를 봐야 하고, 열쇠가 해시라 글이 없으면 무엇이었는지 영영 모른다
 * (`reply.ts` 와 같은 까닭).
 *
 * **못 부른 답은 녹음하지 않는다.** 시간 초과·`claude` 없음 같은 것을 녹음하면
 * 그 뒤로 영영 그 오류만 재생된다.
 */
export function tapePut(brief: string, lookIn: string | undefined, reply: AiReply): void {
  const dir = tapeDir()
  if (!dir || !reply.ok) return
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, `${keyOf(brief, lookIn)}.json`),
      JSON.stringify({ at: new Date().toISOString(), lookIn: lookIn ?? '', brief, reply }, null, 1),
      'utf8'
    )
    called += 1
  } catch {
    // 녹음을 못 해도 하던 일은 계속한다.
  }
}

/**
 * `strict` 에서 못 맞았을 때 돌려줄 것. **조용히 넘어가지 않는다**(저장소 규칙 6) —
 * 물음이 바뀌었다는 사실 자체가 봐야 할 것이고, 열쇠와 글머리를 같이 알려 줘야
 * 무엇이 바뀐 물음인지 찾을 수 있다.
 */
export function tapeMiss(brief: string, lookIn?: string): AiReply {
  missed += 1
  const head = brief.split('\n').find((l) => l.trim()) ?? ''
  return {
    ok: false,
    text: '',
    error:
      `녹음에 없는 물음입니다 (${keyOf(brief, lookIn)}) — 「${head.slice(0, 40)}」. ` +
      '브리프가 바뀌었다는 뜻입니다. FORGE_AI_TAPE_STRICT 를 빼고 한 번 돌려 녹음하세요.',
    missing: false,
    took: 0
  }
}
