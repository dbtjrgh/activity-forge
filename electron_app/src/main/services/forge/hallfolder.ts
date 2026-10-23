/**
 * **작업대 머리줄의 「폴더 열기」가 여는 호 저장소 두 자리** (2026-10-20 사용자 말 — 「실제 리소스폴더랑 액티비티폴더 여는 버튼」).
 * 액티비티 폴더 `src/activity/<코드>` 와 화면이 실제로 부르는 리소스 폴더 `public/sparklab/<코드>` —
 * 양산 완료 커밋이 담는 두 자리와 같은 셈(`hallcommit.ts` 의 `codeDirs`, 호 자리는 `writecheck.ts` 의 `repoOf`)을 쓴다.
 * 리소스 폴더(작업 리소스 자리)는 여기 몫이 아니다 — 작업대가 원래 쓰던 `forgeResourceDir` 그대로다.
 *
 * **폴더를 만들지 않는다.** 호 저장소는 이미 만든 회차가 든 남의 자리라, 없으면 없다고만 알린다.
 * 탐색기로 여는 것(shell)은 IPC 가 한다 — Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { FolderOpen, HallFolder } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { codeDirs } from './hallcommit'
import { loadForge } from './runtime'
import { repoOf } from './writecheck'

/** 그 학습코드의 호 저장소 폴더 — 있을 때만 경로를, 없으면 까닭을 */
export async function hallFolder(code: string, kind: HallFolder): Promise<FolderOpen> {
  try {
    const repo = repoOf((await loadForge()).paths, code)
    if (!repo) return { ok: false, error: '학습코드에서 호를 읽지 못했습니다.' }
    if (!existsSync(repo)) return { ok: false, error: `호 저장소가 없습니다: ${repo}` }
    const [activity, pub] = codeDirs(code)
    const dir = join(repo, kind === 'activity' ? activity : pub)
    if (!existsSync(dir)) return { ok: false, error: '호 저장소에 이 학습코드 폴더가 아직 없습니다.' }
    return { ok: true, dir }
  } catch (error) {
    return { ok: false, error: toMessage(error) }
  }
}
