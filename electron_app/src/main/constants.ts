/**
 * 재귀 용량 계산 상한.
 * 거대한 트리에서 IPC 응답이 돌아오지 않아 앱이 멈춘 것처럼 보이는 것을 막는다.
 */
export const SIZE_SCAN_TIMEOUT_MS = 15_000
export const SIZE_SCAN_MAX_ENTRIES = 500_000

/** ACL 조회(PowerShell 실행) 상한 */
export const ACL_TIMEOUT_MS = 10_000

/** 팀 일정표 갱신 — 엑셀 웹의 「스파크온 완료 칠하기」 스크립트가 이 포트에서 완료 목록을 받는다(스크립트에도 같은 수가 박혀 있다) · 열어 두는 시간 */
export const TEAM_SHEET_PORT = 47219
export const TEAM_SHEET_TTL_MS = 10 * 60_000
