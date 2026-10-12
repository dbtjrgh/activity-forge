/**
 * **정리**의 모양 — 검수 칸 아래 두 가지(2026-10-12). 옮긴 결과는 둘 다 `LeftoverTrash`(`origin.ts`).
 */

/** 호 저장소 `public/sparklab/<코드>` 에 있는데 아무도 안 부르는 파일 (`pubextra.ts`) */
export interface PubExtra {
  /** 그 자리 안 경로와 크기(바이트) */
  files: { rel: string; size: number }[]
  /** 옮기지 않는 까닭(남의 팀 것) — 목록은 보이고 단추만 끈다 */
  locked?: string
  error?: string
}

/** 완료 뒤 리소스 폴더 정리 (`rscclean.ts`) — 기획서(`_plan`)를 뺀 나머지 */
export interface RscClean {
  /** 리소스 폴더 */
  dir: string
  /** 개발 완료 표시가 있나 — 없으면 화면이 단추를 안 보인다 */
  finished: boolean
  /** 옮길 것 — 리소스 폴더 맨 위 항목(폴더 · 파일)과 그 안 크기(바이트) */
  entries: { name: string; size: number }[]
  /** 지금 옮길 수 없는 까닭 한 문장 — 비었으면 옮길 수 있다 */
  why: string
  error?: string
}
