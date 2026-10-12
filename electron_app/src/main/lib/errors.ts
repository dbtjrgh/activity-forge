/**
 * 무엇이 던져졌든 사람이 읽을 한 줄로. **여덟 파일에 같은 세 줄이 있었다**
 * (2026-09-14 에 한 곳으로 모음). 오류를 예외로 던지지 않고 결과의 `error`
 * 칸에 담는 것이 이 앱의 규칙이라 어느 서비스든 마지막에 이것을 한 번 쓴다.
 */
export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 파일시스템 오류 코드를 사용자에게 보여줄 한국어 메시지로 바꾼다. */
export function toErrorMessage(error: unknown, target: string): string {
  const code = (error as NodeJS.ErrnoException)?.code
  switch (code) {
    case 'ENOENT':
    case 'ENXIO':
      return `${target} 경로를 찾을 수 없습니다. 드라이브가 연결되어 있는지 확인하세요.`
    case 'EPERM':
    case 'EACCES':
      return `${target} 경로에 접근할 권한이 없습니다.`
    case 'ENOTDIR':
      return `${target} 경로는 폴더가 아닙니다.`
    default:
      return `${target} 경로를 읽는 중 오류가 발생했습니다: ${
        error instanceof Error ? error.message : String(error)
      }`
  }
}
