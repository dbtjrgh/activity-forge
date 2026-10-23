/**
 * **「업데이트」 단추 하나** (2026-10-01) — 양산기 자료(`refresh.ts` · git pull)와 앱 새 버전(`appupdate.ts` · app-dist)을 한 번에.
 * 자료를 못 받아도(고친 파일이 있다 · 갈라졌다) 앱은 따로 받는다 — 둘은 서로 막지 않는다.
 * 앱을 받았으면 `appChanged` 를 켜서 돌려준다. 다시 켜는 것은 IPC 층이 한다(Electron 을 import 하지 않는다).
 * **대화가 도는 중이면 다시 켜지 않는다** (2026-10-14) — 다시 켜면 도는 claude 를 내려 그 차례가 버려진다. 받아 둔 새 버전은
 * 다음에 켤 때 입구(`boot.ts`)가 연다. 그래서 받기는 하고 `appChanged` 만 끈다
 * **공용 저장소도 같이 받는다** (2026-10-21, `commonpull.ts`) — 자료 · 앱을 받은 뒤에 한다. 결과는 `common` 에 따로 담아
 * 공용이 멈추거나 건너뛰어도 자료 · 앱 결과(`note` · `error` · `appChanged`)는 전과 똑같다. 다시 켜기는 이 함수가 돌아온 뒤라 공용 받기와 안 겹친다
 */

import type { SpecRefresh } from '../../../shared/forge'
import { appCheck, appUpdates, installApp, remoteHeads } from './appupdate'
import { busyWork } from './busy'
import { pullCommon } from './commonpull'
import { refreshSpecs, repoOf } from './refresh'

export async function runUpdate(): Promise<SpecRefresh> {
  const out = await dataAndApp()
  return { ...out, common: await pullCommon(busyWork) }
}

/** 양산기 자료와 앱 새 버전 — 2026-10-21 전의 「업데이트」 그대로(동작 변화 없음) */
async function dataAndApp(): Promise<SpecRefresh> {
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
  if (busyWork().length) return { ...out, error: undefined, note: [said, '앱 새 버전을 받았습니다. 하던 일이 끝나면 다시 켜세요.'].filter(Boolean).join(' ') }
  return { ...out, error: undefined, appChanged: true, note: [said, '앱 새 버전을 받았습니다. 앱을 다시 시작합니다.'].filter(Boolean).join(' ') }
}
