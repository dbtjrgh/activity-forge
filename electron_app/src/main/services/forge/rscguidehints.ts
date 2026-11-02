/**
 * 받을 리소스 창의 **실마리** — 이름이 다르게 온 파일을 크기(그림) · 수(소리 · 영상 · 로티)로 원본 항목에 대 본다.
 * `rscguide.ts` 가 200줄을 넘어 그대로 옮겼다(2026-10-28, 동작 변화 없음).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { GuideItem } from '../../../shared/forge'

/** 아직인 그림을 크기로 묶어, 이름이 다르게 온 그림 가운데 크기가 맞는 수를 적는다 — 같은 크기 · 절반 · 두 배(`sizematch.ts` 와 같은 세 꼴) */
export function sizeHints(items: GuideItem[], spare: Map<string, number>): void {
  const bySize = new Map<string, GuideItem[]>()
  for (const i of items) {
    if (i.state !== 'wait' || !i.w || !i.h) continue
    const k = `${i.w}x${i.h}`
    bySize.set(k, [...(bySize.get(k) ?? []), i])
  }
  for (const [size, group] of bySize) {
    const { w, h } = group[0] as { w: number; h: number }
    const keys = [size, w % 2 === 0 && h % 2 === 0 ? `${w / 2}x${h / 2}` : '', `${w * 2}x${h * 2}`].filter(Boolean)
    let got = 0
    for (const k of keys) {
      const take = Math.min(spare.get(k) ?? 0, group.length - got)
      got += take
      if (take) spare.set(k, (spare.get(k) ?? 0) - take)
    }
    if (!got) continue
    for (const i of group) {
      if (group.length > 1) i.group = { size: `${w}×${h}`, of: group.length, got }
      if (got === group.length) i.state = 'hint'
    }
  }
}

/**
 * 크기로 못 재는 것(소리 · 영상 · 로티) — 이름이 다른 파일이 **아직인 수만큼** 왔으면 실마리, 모자라면 몇 개 왔나만.
 * 9호 KOL1M08W1S3 은 소리가 새 이름으로 다 왔는데 원본 이름 다섯이 「남음」으로 떠 있었다.
 * **그림도 크기로 못 맞춘 나머지는 수로 센다** — 9호 KOL1M08W4S2 는 사진(1040×640)과 글자 그림이 원본(936×576 · 330×135)과
 * 다른 크기로 열 장 다 왔는데 「남은 항목 17」이었다. 크기 묶음(`group`)이 이미 붙은 그림은 그 말을 그대로 둔다
 */
export function countHints(items: GuideItem[], spare: Map<string, number>): void {
  for (const [kind, all] of spare) {
    let got = all
    const waiting = items.filter((i) => i.kind === kind && i.state === 'wait' && !(kind === 'image' && i.group))
    // **이닝 낱말이 먼저** (2026-10-02) — 새로 온 소리는 대개 이닝 낱말이다. 대사는 앞 호 것을 돌려 쓰는 일이 많아(9호 K36 은 5개만 왔다)
    // 한데 세면 「7개 중 5개」로 어느 것이 빠졌는지 안 보였다. 대사는 받을 리소스 창의 「대사 성우」 칸에서 고른다
    for (const part of [waiting.filter((i) => !i.talk), waiting.filter((i) => i.talk)]) {
      if (!part.length || got <= 0) continue
      for (const i of part) {
        if (got >= part.length) i.state = 'hint'
        else if (part.length > 1) i.group = { size: '', of: part.length, got }
        if (kind === 'image') i.byCount = true
      }
      got -= part.length
    }
  }
}
