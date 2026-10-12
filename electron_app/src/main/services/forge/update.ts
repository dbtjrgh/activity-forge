/**
 * **「업데이트」 단추 하나** (2026-10-01) — 양산기 자료(`refresh.ts` · git pull)와 앱 새 버전(`appupdate.ts` · app-dist)을 한 번에.
 * 자료를 못 받아도(고친 파일이 있다 · 갈라졌다) 앱은 따로 받는다 — 둘은 서로 막지 않는다.
 * 앱을 받았으면 `appChanged` 를 켜서 돌려준다. 다시 켜는 것은 IPC 층이 한다(Electron 을 import 하지 않는다).
 */

import type { SpecRefresh } from '../../../shared/forge'
import { appCheck, appUpdates, installApp, remoteHeads } from './appupdate'
import { refreshSpecs, repoOf } from './refresh'

export async function runUpdate(): Promise<SpecRefresh> {
  const out = await refreshSpecs()
  if (!appUpdates()) return out
  const at = await repoOf()
  if ('error' in at) return out
  try {
    const remote = await remoteHeads(at.repo, 'main')
    if (!(await appCheck(at.repo, remote.app))) return out
  } catch {
    return out
  }
  const got = await installApp(at.repo)
  const said = out.error || out.note
  if (!got.ok) return { ...out, note: [said, got.error].filter(Boolean).join(' ') }
  return { ...out, error: undefined, appChanged: true, note: [said, '앱 새 버전을 받았습니다. 앱을 다시 시작합니다.'].filter(Boolean).join(' ') }
}
