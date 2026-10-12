/**
 * 값 고치기 브리프에 실을 **스펙의 모습** (2026-09-23). `revisebrief.ts` 에서 옮겼다 (2026-09-28).
 *
 * 전에는 스펙을 `JSON.stringify` 로 통째로 실었다. 그러면 규칙을 `rules` 에서
 * `relations` 로 옮길 때마다(글은 같고 꼴만 다르다) **물음이 바뀌어** 녹음이
 * 빗나가고, AI 가 새로 답하며 결과가 흔들렸다 — 규칙을 옮긴 것이 값을 바꾼 것처럼
 * 보였다. 그래서 둘을 **같은 문장 목록**으로 싣는다. 규칙은 `check`, 관계는 `note`
 * (`tool/specrel.ts settle` 이 규칙 글을 그대로 옮긴다) — 옮겨도 글이 안 바뀐다.
 *
 * `codegen`(훅 코드)은 뺀다. 값을 고치는 데 쓰이지 않는다.
 *
 * **좌표만 가진 필드는 한 줄로 줄인다** (2026-09-28). M05 스펙 136KB 가운데 102KB 가
 * `button_0_basic: {x, y, width, height}` 같은 좌표 표였고, 묶음 다섯이 그것을 다섯 번
 * 실었다 — 묶음 하나가 143KB 였고 한 묶음은 판마다 300초 한도에 끊겼다. 그런데 좌표는
 * **받지 않는다**(`revisecheck.ts` 의 `HANDS_OFF`). 받지 않을 자리를 설명할 까닭이 없다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { HANDS_OFF } from './revisecheck'

type Field = { key?: string; type?: string; fields?: Field[]; of?: Field } & Record<string, unknown>

/** 좌표 칸만 가진 객체인가 — `{x, y}` · `{x, y, width, height}` */
function coordsOnly(f: Field): boolean {
  return f.type === 'object' && !!f.fields?.length && f.fields.every((c) => HANDS_OFF.has(String(c.key)))
}

/** 좌표만 가진 필드를 `{key, type: "좌표"}` 로. 나머지는 그대로 내려간다. */
function squeeze(f: Field): Field {
  if (coordsOnly(f)) return { key: f.key, type: '좌표 — 고치지 않는다' }
  const out: Field = { ...f }
  if (f.fields) out.fields = f.fields.map(squeeze)
  if (f.of) out.of = squeeze(f.of)
  return out
}

export function specForBrief(spec: Record<string, unknown> | null): string {
  if (!spec) return ''
  const { rules, relations, codegen: _codegen, ...rest } = spec as {
    rules?: { check?: string }[]
    relations?: { note?: string }[]
    codegen?: unknown
  } & Record<string, unknown>
  const says = new Set<string>()
  for (const r of rules ?? []) if (r.check) says.add(r.check.trim())
  for (const r of relations ?? []) if (r.note) says.add(r.note.trim())
  const gd = rest['gameData'] as Field | undefined
  const shown = gd ? { ...rest, gameData: squeeze(gd) } : rest
  const out = [JSON.stringify(shown, null, 1)]
  if (says.size) {
    out.push('', '지켜야 할 것 —', ...[...says].sort().map((s) => `- ${s}`))
  }
  return out.join('\n')
}
