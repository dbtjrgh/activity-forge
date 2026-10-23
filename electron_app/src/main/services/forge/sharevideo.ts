/**
 * 사내 공유 폴더 영상의 **이름 규칙** — 안내 영상 가르기 · 액티비티 영상 판 · 완성본이 두는 이름.
 * 폴더 자리 규칙은 `sharerule.ts` 하나다. 이 파일은 자리를 모르고 파일 이름만 본다(2026-10-19, 200줄을 넘어 거기서 뗐다 — 동작 변화 없음).
 * 경로와 파일 이름만 셈한다 — 파일을 읽지 않는다. Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'

/** 앱이 띄우는 안내 영상인가 — 액티비티는 안 쓴다. `rel` 은 세션 폴더에서부터의 자리 */
export const isGuideVideo = (rel: string, code: string): boolean =>
  /(^|[\\/])가이드\s*영상[\\/]/.test(rel) || path.basename(rel).toLowerCase() === `${code.toLowerCase()}.mp4`

/** 액티비티 영상의 판 — `<학습코드>_ani.mp4` 는 0, `_ani_v1.5` 는 [1, 5]. 그 꼴이 아니면 null. 판 표기가 `v2` · `v2.0` 처럼 섞여 숫자로 견준다 */
export function aniVersion(file: string, code: string): number[] | null {
  const m = new RegExp(`^${code}_ani(?:_v(\\d+(?:\\.\\d+)*))?\\.mp4$`, 'i').exec(path.basename(file))
  if (!m) return null
  return m[1] ? m[1].split('.').map(Number) : [0]
}

/** 판 둘 견주기 — 앞이 높으면 양수 */
export function versionCmp(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d) return d
  }
  return 0
}

/** 완성본이 액티비티 영상을 두는 이름 — AssetTable `{ alias: 'video', src: `${RscPath}/video.mp4` }` */
export const VIDEO_NAME = 'video.mp4'
