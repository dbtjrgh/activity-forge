/**
 * **기획서 PDF 를 읽을 poppler 가 이 PC 에서 실제로 도나** (2026-09-29, M5).
 *
 * `claude -p` 의 `Read` 는 10쪽 넘는 PDF 를 쪽 나눠 열 때 `pdftoppm` 을 부르고, 앱이 PDF 첫 쪽 글을
 * 읽을 때는 `pdftotext` 를 부른다. 없거나 못 돌면 **에러가 아니라 기획서 없이** 답한다(함정 문서).
 * 전에는 PATH 에 파일이 있나만 봤다 — 있어도 못 도는 판(DLL 이 빠진 것)은 못 가렸다. 그래서 **`-v` 를 돌려 본다.**
 *
 * **Git 에 딸린 mingw 판은 거부한다.** Git Bash 에서 띄우면 `/mingw64/bin/pdftotext` 가 PATH 앞에 먼저 잡히는데,
 * 그 판은 `pdftoppm` 없이 `pdftotext` 만 있어 둘이 서로 다른 판이 된다. 사람 PC(탐색기로 띄운 앱)에는
 * 그 자리가 PATH 에 없어, 시험할 때만 다른 것을 보게 된다.
 * **거부만 하고 끝내지 않는다**(2026-10-08) — 그 뒤 PATH 에 진짜 poppler 가 있으면 그것을 맨 앞으로 올려 쓴다. 개발 모드도 저장소의
 * `vendor/poppler/bin` 을 맨 앞에 둔다(`main/index.ts`). Git Bash 에서 앱을 다시 켰더니 작업대가 「기획서를 읽을 수 없습니다」였다
 *
 * 한 번 재고 들고 있는다 — 동기로 돌리므로(10초 상한) 앱이 켜진 뒤 한 번만, 못 돈다는 결과만 1분 뒤 다시 잰다. Electron 을 import 하지 않는다.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export type PopplerTool = { name: string; path: string; version: string }
export type Poppler = { ok: boolean; why: string; tools: PopplerTool[] }

const TOOLS = ['pdftoppm', 'pdftotext']
const MINGW = /[\\/](mingw32|mingw64|usr)[\\/]bin[\\/]/i
/**
 * 재 보기 상한 — 보통 20ms 안에 끝나지만, 막혔다가 허용된 직후 첫 실행은 보안 검사로 3초를 넘긴다(2026-10-06, 3.2초).
 * 3초로 두었을 때 그 첫 실행이 ETIMEDOUT 으로 「실행되지 않습니다」가 됐다. 실제로 쓸 때의 상한(15 · 20초)보다는 짧게 둔다
 */
const TIMEOUT_MS = 10000
/** 못 돈다는 결과는 이만큼만 들고 다시 잰다 — 사람이 허용한 뒤에도 앱을 다시 켜기 전까지 「읽을 수 없습니다」로 남았다 */
const RETRY_MS = 60000

let measured: Poppler | null = null
let measuredAt = 0

/** PATH 에서 그 프로그램을 **처음 잡히는 것** — 자식 프로세스(claude)가 집는 것과 같다. `skipMingw` 면 mingw 판은 넘긴다. 없으면 빈 글 */
export function onPath(name: string, skipMingw = false): string {
  const file = process.platform === 'win32' ? `${name}.exe` : name
  for (const d of (process.env['PATH'] ?? '').split(path.delimiter).filter(Boolean)) {
    const at = path.join(d, file)
    if (fs.existsSync(at) && !(skipMingw && MINGW.test(at))) return at
  }
  return ''
}

/**
 * mingw 판이 PATH 맨 앞에 있어도 그 뒤에 진짜 poppler 가 있으면 그것을 PATH 맨 앞으로 올린다 —
 * 앱만이 아니라 자식인 `claude -p` 도 PATH 로 `pdftoppm` 을 찾으므로 앞으로 올려야 둘이 같은 것을 본다
 */
function skipMingw(name: string): void {
  const first = onPath(name)
  if (!first || !MINGW.test(first)) return
  const real = onPath(name, true)
  if (real) process.env['PATH'] = [path.dirname(real), process.env['PATH'] ?? ''].join(path.delimiter)
}

function probe(name: string): { tool: PopplerTool | null; why: string } {
  skipMingw(name)
  const at = onPath(name)
  if (!at) return { tool: null, why: `${name} 프로그램이 없습니다.` }
  if (MINGW.test(at)) return { tool: null, why: `${name} 프로그램이 Git 에 포함된 mingw 버전입니다(${at}). poppler 를 PATH 앞쪽에 두세요.` }
  const run = spawnSync(at, ['-v'], { timeout: TIMEOUT_MS, encoding: 'utf8', windowsHide: true })
  const said = `${run.stdout ?? ''}${run.stderr ?? ''}`
  const version = /version\s+([\d.]+)/i.exec(said)?.[1] ?? ''
  if (run.error || !version) return { tool: null, why: `${name} 프로그램이 실행되지 않습니다(${run.error?.message ?? said.trim().slice(0, 80)}).` }
  return { tool: { name, path: at, version }, why: '' }
}

/**
 * 실행 파일에 넣어 둔 poppler 를 PATH 맨 앞에 (2026-10-01). 앱이 켜질 때 한 번, 처음 재기 전에 부른다.
 * PATH 에 얹는 까닭 — 앱만이 아니라 `claude -p` 도 `pdftoppm` 을 PATH 로 찾는다(자식은 이 환경을 물려받는다)
 */
export function preferBundledPoppler(dir: string): void {
  if (!fs.existsSync(path.join(dir, process.platform === 'win32' ? 'pdftoppm.exe' : 'pdftoppm'))) return
  process.env['PATH'] = [dir, process.env['PATH'] ?? ''].join(path.delimiter)
  measured = null
}

/** poppler 형편 — 처음 부를 때 한 번 잰다. 못 돈다고 잰 것은 1분 뒤 다시 잰다 */
export function poppler(): Poppler {
  if (measured && (measured.ok || Date.now() - measuredAt < RETRY_MS)) return measured
  measuredAt = Date.now()
  const got = TOOLS.map(probe)
  const bad = got.filter((g) => !g.tool).map((g) => g.why)
  measured = {
    ok: bad.length === 0,
    why: bad.length ? `기획서를 읽을 수 없습니다. ${bad.join(' ')} 설치 방법은 electron_app/README.md 를 참고하세요.` : '',
    tools: got.flatMap((g) => (g.tool ? [g.tool] : []))
  }
  return measured
}

/**
 * 기획서 한 쪽의 글 — `pdftotext -f n -l n`. 못 읽으면 까닭.
 * **stderr 를 보지 않는다** — 한글 사용자 경로에서 poppler 가 `nameToUnicode` I/O 오류를 뱉어도 글은 나온다(종료 코드 0).
 */
export function pageText(file: string, page: number): { text: string } | { why: string } {
  const tool = poppler().tools.find((t) => t.name === 'pdftotext')
  if (!tool) return { why: poppler().why || '기획서를 읽을 수 없습니다. pdftotext 프로그램이 없습니다.' }
  const run = spawnSync(tool.path, ['-f', String(page), '-l', String(page), '-enc', 'UTF-8', '-layout', file, '-'], {
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true
  })
  if (run.error || run.status !== 0) return { why: `기획서 ${page}쪽을 읽지 못했습니다: ${run.error?.message ?? run.stderr.trim().slice(0, 80)}` }
  // 제목에 눈에 안 보이는 글자(U+200B)가 붙어 온다 — MAL2M07W2S1 기획서가 그랬다
  return { text: run.stdout.replace(/[​-‍﻿]/g, '') }
}

/** 기획서 한 쪽을 PNG 로 — `pdftoppm -r 60`. 만든 파일 경로, 못 뜨면 null. 판정은 종료 코드와 파일로만 한다 */
export function pagePng(file: string, page: number, outBase: string): string | null {
  const tool = poppler().tools.find((t) => t.name === 'pdftoppm')
  if (!tool) return null
  const run = spawnSync(tool.path, ['-f', String(page), '-l', String(page), '-png', '-r', '60', '-singlefile', file, outBase], {
    timeout: 20000,
    windowsHide: true
  })
  const out = `${outBase}.png`
  return !run.error && run.status === 0 && fs.existsSync(out) ? out : null
}
