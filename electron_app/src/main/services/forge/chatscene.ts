/**
 * **대화로 만들기와 figma 화면의 배경** (2026-10-13, `backdrop.ts` 를 대화에 잇는 자리).
 *
 * 1. 대화를 시작할 때 원본 후보마다 배경을 잰다(`measureBackdrop`, 남긴 것이 있으면 다시 안 잰다)
 * 2. 그 뒤로 `originNow` 가 남긴 것을 읽어 **사람이 안 적은 원본만** 배경이 같은 학습코드로 바꾼다
 * 3. 사람이 적은 원본과 배경이 다르면 바꾸지 않고 알린다 — 앱 글(`sceneSaid`)과 첫 지시(`sceneLines`), 원본 변경 창
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { toMessage } from '../../lib/errors'
import type { SceneScore } from '../../../shared/forge'
import { backdropCheck } from './backdrop'
import { originNow, pinnedHere } from './originpick'
import type { Forge } from './runtime'

/** `kept` 면 사람이 적은 원본 `base` 그대로이고 `better` 의 배경이 화면에 있다. 아니면 배경 때문에 `base` 에서 `better` 로 바꿨다 */
export type ChatScene = { better: string; base: string; kept: boolean }

/** 원본 — `originNow` 그대로(배경 때문에 바꿨으면 `sceneFrom` 이 바꾸기 전) */
export type OriginPick = { origin: string; module: string; sceneFrom: string }

/** 잰다 — 못 재도 대화는 막지 않는다(까닭 글을 돌려준다). 처음 재는 것이면 `onSlow` 를 먼저 부른다(배경 한 장에 1초 안팎) */
export async function measureBackdrop(forge: Forge, code: string, onSlow: () => void): Promise<string> {
  try {
    const now = originNow(forge, code)
    if (typeof now === 'string') return ''
    const choices = forge.layout.originChoices(code)
    // 배경 때문에 바꾼 원본이 아니라 그 앞(배치표 · 크기 맞추기)으로 후보를 세운다 — 바꾼 것으로 세우면 잴 때마다 후보가 달라진다
    await backdropCheck(forge, code, now.sceneFrom || now.origin, choices, onSlow)
    return ''
  } catch (error) {
    return `figma 화면과 원본 배경을 비교하지 못했습니다: ${toMessage(error)}`
  }
}

/** 배경 때문에 원본을 바꿨나, 사람이 적은 원본과 배경이 다른가 — 둘 다 아니면 null */
export function sceneOf(forge: Forge, code: string, pick: OriginPick, scores: SceneScore[] | null): ChatScene | null {
  if (pick.sceneFrom) return { better: pick.origin, base: pick.sceneFrom, kept: false }
  if (!scores || !pinnedHere(forge, code)) return null
  const better = forge.scenebackdrop.backdropVerdict(scores, pick.origin)?.code
  return better ? { better, base: pick.origin, kept: true } : null
}

/** 앱 글 — 사람이 「원본 변경」에서 고른다 */
export function sceneSaid(s: ChatScene | null): string {
  if (!s) return ''
  return s.kept
    ? `**figma 화면의 배경은 원본 ${s.base} 학습코드와 다르고 ${s.better} 학습코드와 같습니다.** 원본은 배치표에 정한 그대로 둡니다. 바꾸려면 「원본 변경」에서 고른 뒤 처음부터 다시 만드세요.`
    : `figma 화면의 배경이 ${s.better} 학습코드와 같아 원본으로 골랐습니다. 배치표의 추천은 ${s.base} 학습코드입니다.`
}

/** 첫 지시 — 앱이 픽셀로 잰 사실만 적는다. 원본을 바꿀지는 사람이 정한다 */
export function sceneLines(s: ChatScene | null): string[] {
  if (!s) return []
  return s.kept
    ? [`- figma 화면의 배경 그림은 원본이 아니라 ${s.better} 의 배경과 같다(앱이 픽셀로 비교). 원본은 사람이 정했다. 배경 · 엔딩 같은 장면 리소스는 ${s.better} 것도 열어 본다.`]
    : [`- 원본은 figma 화면의 배경 그림이 같은 ${s.better} 로 앱이 골랐다(배치표 추천은 ${s.base}).`]
}
