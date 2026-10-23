/**
 * git 을 부른다 — **도메인을 모른다.** 양산·스펙·액티비티 개념이 없다.
 *
 * **셸을 거치지 않는다** (`execFile`). 인자에 띄어쓰기나 따옴표가 있어도 그대로
 * 간다 — `shell: true` 는 인자에 따옴표를 안 씌운다(함정 문서).
 *
 * **묻지 않고 끝난다** (`GIT_TERMINAL_PROMPT=0`). `pull` 에 자격 증명이 필요하면
 * git 은 터미널에서 물어보려 한다 — 앱에는 터미널이 없으니 **상한까지 멈춰 있다가**
 * 끊긴다. 묻는 대신 바로 실패하게 한다.
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** git 한 번. 성공하면 stdout, 실패하면 던진다(부르는 쪽이 까닭을 사람 말로 바꾼다). */
export async function git(cwd: string, args: string[], timeout: number, extraEnv: Record<string, string> = {}): Promise<string> {
  const { stdout } = await run('git', args, {
    cwd,
    timeout,
    windowsHide: true,
    // 자격 증명 관리자의 로그인 창도 막는다 — 1분마다 묻는 업데이트 확인이 창을 띄우면 안 된다
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', ...extraEnv }
  })
  return stdout
}

/**
 * 저장소 내려받기 — **로그인 창은 막지 않는다** (2026-10-01, 처음 설정). 사람이 단추를 눌러 기다리는 자리라,
 * Windows 용 git 의 자격 증명 관리자가 로그인 창을 띄우게 둔다(`GIT_TERMINAL_PROMPT` 를 안 심는다).
 * 자격 증명 관리자가 없으면 터미널이 없어 바로 실패한다 — 멈춰 있지 않는다(2026-10-01 에 재 봄: 0.1초).
 * 실패하면 stderr 를 담아 던진다.
 */
export async function gitClone(url: string, to: string, timeout: number, extra: string[] = []): Promise<void> {
  try {
    await run('git', ['clone', ...extra, url, to], { timeout, windowsHide: true })
  } catch (error) {
    const e = error as { stderr?: string; killed?: boolean; message?: string }
    throw new Error(e.killed ? 'timeout' : String(e.stderr || e.message || ''))
  }
}

/** 줄 목록. 빈 줄은 뺀다. */
export function lines(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => l.trim())
}

/** git 한 번 — 던지지 않는다. 실패해도 stderr 를 돌려준다(합치기가 왜 멈췄는지 읽어야 하는 자리) */
export async function tryGit(cwd: string, args: string[], timeout: number): Promise<{ ok: boolean; out: string; err: string }> {
  try {
    return { ok: true, out: await git(cwd, args, timeout), err: '' }
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string; killed?: boolean }
    return { ok: false, out: String(e.stdout ?? ''), err: e.killed ? 'timeout' : String(e.stderr || e.message || '') }
  }
}

/**
 * 그 폴더가 git 저장소의 맨 위인가 — 다른 저장소 안의 폴더면 거짓(뿌리면 `--show-cdup` 이 빈 글).
 * 정션 너머 폴더(호 저장소의 `src/_common`)를 저장소로 잘못 받지 않게 쓴다(2026-10-21)
 */
export async function isRepoRoot(dir: string, timeout: number): Promise<boolean> {
  if (!dir || !existsSync(dir)) return false
  const top = await tryGit(dir, ['rev-parse', '--show-cdup'], timeout)
  return top.ok && top.out.trim() === ''
}

/** `a` 가 `b` 의 조상인가(같으면 참). 어느 쪽이든 없는 이름이면 거짓 */
export async function isAncestor(cwd: string, a: string, b: string, timeout: number): Promise<boolean> {
  return (await tryGit(cwd, ['merge-base', '--is-ancestor', a, b], timeout)).ok
}

/**
 * 미리 담아 둔(staged) 파일 가운데 `keep` 폴더들 밖의 것 — 있으면 커밋에 같이 딸려 간다.
 * 한글 파일 이름이 따옴표 · 8진수로 오면 「밖」으로 잘못 센다 — 있는 그대로 받는다
 */
export async function stagedOutside(cwd: string, keep: string[], timeout: number): Promise<string[]> {
  const staged = lines(await git(cwd, ['-c', 'core.quotepath=false', 'diff', '--cached', '--name-only'], timeout))
  return staged.filter((f) => !keep.some((k) => f.startsWith(`${k.replace(/\/$/, '')}/`)))
}
