/**
 * 재귀 용량 계산 상한.
 * 거대한 트리에서 IPC 응답이 돌아오지 않아 앱이 멈춘 것처럼 보이는 것을 막는다.
 */
export const SIZE_SCAN_TIMEOUT_MS = 15_000
export const SIZE_SCAN_MAX_ENTRIES = 500_000

/** ACL 조회(PowerShell 실행) 상한 */
export const ACL_TIMEOUT_MS = 10_000
