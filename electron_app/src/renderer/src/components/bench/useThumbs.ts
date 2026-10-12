import { useEffect, useState } from 'react'
import type { ThumbsResult } from '../../../../shared/forge'

/** 어디 그림인가 — 기본은 이 학습코드의 리소스 폴더. 받을 리소스 창은 **앞 학습코드 폴더**를 그린다(`guide`) */
export type ThumbSource = { key: string; get: (code: string, files: string[]) => Promise<ThumbsResult> }
const RSC: ThumbSource = { key: 'rsc', get: (code, files) => window.api.forgeThumbs(code, files) }

/** 한 번 그린 것은 다시 안 부른다 — 카드를 접었다 펴거나 다시 그릴 때마다 IPC 가 오가지 않게 */
const seen = new Map<string, string>()
const tried = new Set<string>()
const BATCH = 60
const PICTURE = /\.(png|jpe?g|webp|gif)$/i

/**
 * 리소스 폴더 안 그림들의 작은 썸네일 (M4) — 고르기 후보 · 리소스 목록.
 * 이름만으로는 `character_3_arm_correct.png` 가 무엇인지 모른다. **그림이 아닌 것은 안 묻는다.**
 * 못 그린 것 · 상한을 넘은 것은 비어 있고, 그 줄은 이름만 보인다(메인 `ipc/paper.ts` 가 상한을 둔다).
 */
export function useThumbs(code: string, files: string[], from: ThumbSource = RSC): Record<string, string> {
  const key = (f: string): string => `${from.key}|${code}|${f}`
  const want = files.filter((f) => PICTURE.test(f))
  const sig = want.join('\n')
  const [n, bump] = useState(0)
  useEffect(() => {
    // 물어본 것은 못 그렸어도 다시 안 묻는다 — 그래야 판이 끝난다
    const missing = sig ? sig.split('\n').filter((f) => !tried.has(key(f))) : []
    if (!missing.length) return
    let live = true
    // 한 번에 BATCH 장씩 — 메인의 상한(`THUMBS_MAX`)과 같거나 작게. 다 물을 때까지 판을 넘긴다
    const batch = missing.slice(0, BATCH)
    void from.get(code, batch).then((r) => {
      for (const f of batch) tried.add(key(f))
      for (const [f, url] of Object.entries(r.thumbs)) seen.set(key(f), url)
      if (live) bump((k) => k + 1)
    })
    return () => {
      live = false
    }
  }, [code, sig, n, from.key])
  const out: Record<string, string> = {}
  for (const f of want) {
    const url = seen.get(key(f))
    if (url) out[f] = url
  }
  return out
}
