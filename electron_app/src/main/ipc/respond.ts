/**
 * **렌더러에 돌려보내는 것** — 서비스까지 못 간 결과의 모양.
 *
 * `ipc/resource.ts` 가 383줄이 되어 갈랐다 (2026-09-18, 동작 변화 없음).
 * 리소스 화면과 띄워 보기 채널(`ipc/finish.ts`) · 붙이는 것(`ipc/paper.ts`)이 같이 쓴다.
 * 이전 방식의 걸음 · 쓰기 결과 · 로그 보내기는 2026-10-08 에 그 채널과 같이 걷었다.
 *
 * **못 간 결과도 모양은 온전히 채운다.** 렌더러는 그 타입 그대로 그리므로
 * 빈 칸이 `undefined` 면 화면이 넘어진다 — 까닭 한 줄만 담고 나머지는 비운다.
 */

import type { InboxResult, Prepare, SortedInbox } from '../../shared/forge'

/** 학습코드가 아닌 것은 서비스까지 보내지 않는다. 검증은 이 층에서 한 번만. */
export function badCode(raw: unknown): Prepare {
  const shown = String(raw ?? '').trim()
  const why = shown
    ? `학습코드가 아닙니다: ${shown}. ENL1M06W3S1 처럼 적으세요.`
    : '학습코드를 적으세요. 예) ENL1M06W3S1'
  return {
    code: shown,
    layout: { ok: false, module: '', origin: '', slot: '', verdict: '', why, sameSlot: false, alt: [] },
    rsc: { dir: '', exists: false, files: [], error: why },
    need: [],
    write: { dir: '', writable: null, why },
    hasSpec: false,
    planReader: '',
    shots: 0,
    needsShot: false,
    written: false,
    finished: null,
    error: why
  }
}

/** 통째로 놓은 것을 받지도 못했을 때. */
export function badSort(why: string): SortedInbox {
  return { found: 0, truncated: false, lessons: [], papers: [], ask: [], failed: [], note: '', error: why }
}

/** 놓은 것을 받지도 못했을 때. 막힌 까닭만 담는다. */
export function badInbox(why: string): InboxResult {
  return {
    dir: '',
    found: 0,
    took: [],
    same: [],
    clash: [],
    ask: [],
    failed: [],
    bytes: 0,
    truncated: false,
    note: '',
    error: why
  }
}
