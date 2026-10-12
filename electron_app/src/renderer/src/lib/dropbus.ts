import { useEffect } from 'react'

/**
 * **화면 어디에 놓아도 받는다** — 끌어다 놓은 파일을 갈래대로 나눠 각 칸에 넘기는 통로
 * (2026-09-23 사용자 말 — 「구역 구별하지 말고 양산 페이지에 놓으면 전체 구역에 놓을 수
 * 있게, 확장자로 구별하면 되니까」).
 *
 * 받는 자리(`DropAll.tsx`)는 하나이고, 받은 것을 쓰는 칸은 둘이다 — 리소스(`RscDrop.tsx`,
 * `Resource.tsx` 가 만든다)와 기획서(`PlanDrop.tsx`, `RunPanel.tsx` 가 만든다). 둘이
 * 서로를 모르므로 창의 사건으로 잇는다.
 *
 * **그림은 늘 리소스다.** png 는 리소스인지 figma 캡처인지 확장자로 못 가른다 — figma
 * 화면은 여태처럼 **Ctrl+V** 로 받는다(`ShotPaste.tsx`). PDF 만 기획서로 간다.
 */

export type DropKind = 'rsc' | 'plan'

const EVENT = 'forge-drop'

/** 놓인 자리들을 갈래로 나눈다. 폴더(확장자 없음)는 리소스다. */
export function sortDrops(paths: string[]): Record<DropKind, string[]> {
  const out: Record<DropKind, string[]> = { rsc: [], plan: [] }
  for (const p of paths) (p.toLowerCase().endsWith('.pdf') ? out.plan : out.rsc).push(p)
  return out
}

export function sendDrop(kind: DropKind, paths: string[]): void {
  if (paths.length) window.dispatchEvent(new CustomEvent(EVENT, { detail: { kind, paths } }))
}

/** 이 갈래로 온 것을 받는다. */
export function useDropped(kind: DropKind, take: (paths: string[]) => void): void {
  useEffect(() => {
    const on = (e: Event): void => {
      const d = (e as CustomEvent<{ kind: DropKind; paths: string[] }>).detail
      if (d?.kind === kind) take(d.paths)
    }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [kind, take])
}
