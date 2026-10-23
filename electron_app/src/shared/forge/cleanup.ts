/**
 * **정리**의 모양 — 검수 칸 아래 두 가지(2026-10-12)와 리소스 폴더 칸의 학습코드 초기화(2026-10-13). 옮긴 결과는 셋 다 `LeftoverTrash`(`origin.ts`).
 */

/** 호 저장소 `public/sparklab/<코드>` 에 있는데 아무도 안 부르는 파일 (`pubextra.ts`) */
export interface PubExtra {
  /** 그 자리 안 경로와 크기(바이트) */
  files: { rel: string; size: number }[]
  /** 옮기지 않는 까닭(남의 팀 것) — 목록은 보이고 단추만 끈다 */
  locked?: string
  error?: string
}

/**
 * 학습코드 초기화 (`reset.ts`) — 이 학습코드에 넣은 것과 만든 것. 옮긴 결과는 `LeftoverTrash`.
 * 화면이 보인 항목은 `resetKeys` 열쇠로 보낸다 — 메인은 누른 때 다시 재고 그 열쇠와 겹치는 것만 옮긴다
 */
export interface CodeReset {
  /** 리소스 폴더 — 통째로 휴지통. 없거나 호 저장소 안이면(그 자리는 `hall` 이 본다) null */
  rsc: { dir: string; files: number; size: number } | null
  /** 양산기 `_recipe/` 의 `<코드>.*` 파일 이름 — 대화 · 입력 기록 · 가져온 파일 기록 */
  recipe: string[]
  /** 호 저장소 그 학습코드 두 자리의 커밋 안 한 변경 — `restore` 는 지금 것을 휴지통에 두고 마지막 커밋으로, `remove` 는 새 파일이라 휴지통으로 */
  hall: { rel: string; how: 'restore' | 'remove' }[]
  /** 지금 초기화할 수 없는 까닭 한 문장 — 비었으면 할 수 있다 */
  why: string
  error?: string
}

/** 초기화 항목의 열쇠 — 화면과 메인이 같은 셈을 쓴다 */
export const resetKeys = (r: CodeReset): string[] => [
  ...(r.rsc ? ['rsc'] : []),
  ...r.recipe.map((n) => `recipe:${n}`),
  ...r.hall.map((h) => `hall:${h.rel}`)
]

/** 완료 뒤 리소스 폴더 정리 (`rscclean.ts`) — 기획서(`_plan`)를 뺀 나머지 */
export interface RscClean {
  /** 리소스 폴더 */
  dir: string
  /** 개발 완료 표시가 있나 — 지금 화면은 읽지 않는다(작업대 정리 단추를 걷은 뒤 2026-10-14). 막는 까닭은 `why` */
  finished: boolean
  /** 옮길 것 — 리소스 폴더 맨 위 항목(폴더 · 파일)과 그 안 크기(바이트) */
  entries: { name: string; size: number }[]
  /** 지금 옮길 수 없는 까닭 한 문장 — 비었으면 옮길 수 있다 */
  why: string
  error?: string
}
