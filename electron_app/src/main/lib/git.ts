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
