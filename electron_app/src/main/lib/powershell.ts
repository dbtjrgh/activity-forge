import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** PATH 에 의존하지 않도록 Windows PowerShell 의 절대 경로를 구한다. */
function powershellPath(): string {
  const root = process.env['SystemRoot']
  return root
    ? join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe'
}

/**
 * PowerShell 스크립트를 실행하고 표준 출력을 JSON 으로 파싱한다.
 *
 * - 스크립트는 -EncodedCommand(base64 UTF-16LE)로 넘긴다. 따옴표 이스케이프 문제가 사라진다.
 * - 조회 대상 같은 값은 스크립트에 문자열로 끼워넣지 않고 env 로만 전달한다.
 *   렌더러가 보낸 값이 스크립트로 해석될 여지를 없애기 위한 것이다.
 * - 스크립트가 출력 인코딩을 UTF-8 로 지정해야 한글 계정명이 깨지지 않는다.
 * - PowerShell 은 진행 상태를 CLIXML 로 표준 오류에 흘리므로 stderr 는 보지 않는다.
 */
export async function runPowerShellJson<T>(
  script: string,
  env: Record<string, string>,
  timeoutMs: number
): Promise<T> {
  const { stdout } = await execFileAsync(
    powershellPath(),
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64')
    ],
    {
      env: { ...process.env, ...env },
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true
    }
  )

  return JSON.parse(stdout) as T
}
