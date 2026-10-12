/**
 * **git · Claude Code 를 PATH 밖에서도 찾는다** (2026-10-01 사용자 요청 — 「PC 에 깔려만 있어도 찾고 있는 거지?」).
 *
 * 앱은 켜질 때 받은 PATH 만 본다. 그래서 둘 다 놓쳤다 —
 *   ① 앱을 켜 둔 채 설치하면, 설치 프로그램이 레지스트리의 PATH 는 고쳐도 이 프로세스의 PATH 는 그대로다
 *   ② 설치할 때 PATH 넣기를 끄면 어디에도 안 잡힌다
 * ①은 레지스트리의 사용자 · 시스템 PATH 를 다시 읽어, ②는 흔히 깔리는 자리를 봐서 **이 프로세스 PATH 뒤에 붙인다.**
 * 뒤에 붙이는 까닭 — 이미 잡히는 것의 차례를 바꾸지 않는다(poppler 는 앞에 둔다, `poppler.ts`).
 * 자식(git · claude)도 이 PATH 를 물려받는다. Windows 가 아니면 아무것도 안 한다. Electron 을 import 하지 않는다.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'

const env = (name: string): string => process.env[name] ?? ''

/** 설치 프로그램의 기본 자리 — Git for Windows(모든 사용자 · 이 사용자), Claude Code(설치 스크립트 · npm) */
function knownDirs(): string[] {
  return [
    join(env('ProgramFiles'), 'Git', 'cmd'),
    join(env('LOCALAPPDATA'), 'Programs', 'Git', 'cmd'),
    join(env('USERPROFILE'), '.local', 'bin'),
    join(env('APPDATA'), 'npm')
  ]
}

/** 레지스트리에 적힌 PATH 한 벌 — `%USERPROFILE%` 같은 것은 풀어서 */
function registryPath(key: string): string[] {
  const run = spawnSync('reg', ['query', key, '/v', 'Path'], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
  const line = (run.stdout ?? '').split(/\r?\n/).find((l) => /\sPath\s+REG_/i.test(l))
  const value = line?.replace(/^\s*Path\s+REG_\w+\s+/i, '') ?? ''
  return value
    .split(';')
    .map((d) => d.replace(/%([^%]+)%/g, (_, v: string) => env(v)).trim())
    .filter(Boolean)
}

/** 빠진 자리를 PATH 뒤에 붙인다 — 붙인 자리 목록을 돌려준다. 여러 번 불러도 같은 것을 두 번 붙이지 않는다 */
export function refreshToolPath(): string[] {
  if (process.platform !== 'win32') return []
  const have = new Set(env('PATH').split(delimiter).map((d) => d.toLowerCase().replace(/[\\/]+$/, '')))
  const want = [
    ...registryPath('HKCU\\Environment'),
    ...registryPath('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'),
    ...knownDirs()
  ]
  const added: string[] = []
  for (const d of want) {
    const key = d.toLowerCase().replace(/[\\/]+$/, '')
    if (have.has(key) || !existsSync(d)) continue
    have.add(key)
    added.push(d)
  }
  if (added.length) process.env['PATH'] = [env('PATH'), ...added].filter(Boolean).join(delimiter)
  return added
}
