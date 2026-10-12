/**
 * **앱 입구** (2026-10-01) — `package.json` 의 main. 실행 파일을 다시 받지 않아도 앱이 바뀌게 하려고 둔다(사용자 요청 — 「다 바뀌도록」).
 *
 * 「업데이트」가 앱 새 버전을 `userData/app/<커밋>/` 에 받아 두면(`services/forge/appupdate.ts`), 여기서
 * 실행 파일에 들어 있는 것(`./index.js`)과 견주어 **더 늦게 빌드한 쪽**을 연다.
 * - 소스로 띄운 앱(dev)은 늘 들어 있는 것 — 받아 둔 것을 보지 않는다
 * - 받아 둔 것이 읽다가 깨지면 들어 있는 것으로 돌아간다
 * - 실행 파일을 더 새것으로 다시 받았으면 그것이 이긴다(빌드 시각으로 견준다)
 * Electron 이 바꾸지 못하는 것(Electron 자체 · 앱에 넣은 poppler)은 새 실행 파일로만 바뀐다.
 */

import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

type Stamp = { source: string; builtAt: number }

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

/** 받아 둔 앱이 더 새것이면 그 입구 파일 — 아니면 null */
function downloaded(): string | null {
  if (!app.isPackaged) return null
  const current = readJson<{ dir: string }>(join(app.getPath('userData'), 'app', 'current.json'))
  if (!current?.dir) return null
  const entry = join(current.dir, 'main', 'index.js')
  const theirs = readJson<Stamp>(join(current.dir, 'main', 'version.json'))
  const mine = readJson<Stamp>(join(__dirname, 'version.json'))
  if (!theirs || !existsSync(entry)) return null
  return theirs.builtAt > (mine?.builtAt ?? 0) ? entry : null
}

// 번들러가 이 require 를 따라 들어가 boot 에 index 를 통째로 묶지 않게 createRequire 로 부른다
const load = createRequire(__filename)
const entry = downloaded()
if (entry) {
  try {
    load(entry)
  } catch (error) {
    console.error('받아 둔 앱을 열지 못해 실행 파일에 들어 있는 버전으로 엽니다.', error)
    load('./index.js')
  }
} else {
  load('./index.js')
}
