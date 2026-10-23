/**
 * **figma 「CSS 복사」 글을 모듈 좌표로** (2026-10-13) — 인터북 어포던스 자리를 손으로 옮겨 적지 않게(사용자 요청).
 *
 * figma 에서 레이어 하나를 고르고 CSS 를 복사하면 width · height · left · top 이 온다. 대화 칸에 붙이면 가운데 기준 좌표
 * (화면 가운데가 0,0 — MIB affPos 와 같은 꼴) 한 줄로 바꿔 넣는다.
 *
 * - left · top 은 **그 레이어를 담은 프레임 기준**이다. 1920×1080 프레임 바로 아래 레이어일 때만 화면 좌표라 바꾼 줄에 그렇게 적는다
 * - 가운데 맞춤 제약이면 figma 가 `calc(50% - 120px/2 + 100px)` 로 낸다. 이때 끝의 값이 곧 가운데에서 떨어진 거리다
 * - 모르는 꼴(퍼센트만 · 오른쪽 · 아래 기준)은 바꾸지 않는다 — 짐작해 바꾸면 조용히 틀린다. 「모든 레이어」 CSS 는 부모 기준 퍼센트라 못 쓴다(함정 문서)
 */

const PX = /^(-?\d+(?:\.\d+)?)px$/i
const CALC = /^calc\(\s*50%\s*-\s*\d+(?:\.\d+)?px\s*\/\s*2\s*(?:([+-])\s*(\d+(?:\.\d+)?)px\s*)?\)$/i

/** `key: 값;` 의 값 — `margin-left` 같은 이름은 앞에 `-` 가 붙어 안 걸린다 */
const valueOf = (css: string, key: string): string | null =>
  new RegExp(`(?:^|[;{\\s])${key}\\s*:\\s*([^;\\n]+)`, 'i').exec(css)?.[1]?.trim() ?? null

const pxOf = (v: string | null): number | null => {
  const m = v ? PX.exec(v) : null
  return m ? Number(m[1]) : null
}

/** 한 축의 가운데 — 프레임 왼쪽(위)에서 잰 px 이면 `+ 크기/2 - 절반`, 가운데 맞춤 calc 면 끝의 값 */
function axis(v: string | null, size: number, half: number): number | null {
  const at = pxOf(v)
  if (at !== null) return at + size / 2 - half
  const m = v ? CALC.exec(v) : null
  if (!m) return null
  return m[2] ? (m[1] === '-' ? -1 : 1) * Number(m[2]) : 0
}

/** figma CSS 글 → 가운데 기준 좌표와 크기. 못 읽으면 null */
export function figmaCenter(css: string): { x: number; y: number; w: number; h: number } | null {
  const w = pxOf(valueOf(css, 'width'))
  const h = pxOf(valueOf(css, 'height'))
  if (w === null || h === null) return null
  const x = axis(valueOf(css, 'left'), w, 960)
  const y = axis(valueOf(css, 'top'), h, 540)
  if (x === null || y === null) return null
  return { x: Math.round(x), y: Math.round(y), w, h }
}

/** 대화 칸에 넣을 한 줄 — 못 읽으면 null(붙인 글을 그대로 둔다) */
export function figmaLine(css: string): string | null {
  const c = figmaCenter(css)
  return c ? `figma 레이어 ${c.w}×${c.h}, 가운데 기준 (${c.x}, ${c.y}) — 1920×1080 프레임 바로 아래 레이어일 때의 화면 좌표` : null
}
