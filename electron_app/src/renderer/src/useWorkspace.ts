import { useCallback, useEffect, useState } from 'react'
import type { SpecRefresh, Workspace } from '../../shared/forge'

/**
 * 작업 폴더 · 리소스 폴더 · 양산기 폴더 · 스펙 갱신 — `App.tsx` 에서 떼어 냄.
 *
 * 다섯 단추가 **같은 모양**이었다 — 누르는 동안 막고, 메인에 묻고, 필요하면
 * 진행판을 다시 읽는다. 그 껍데기를 `busyWhile` 하나로 두었다.
 *
 * `reload` 는 진행판을 다시 읽는 일이다. **리소스 자리를 바꿀 때는 안 부른다** —
 * 진행판의 숫자는 호 저장소를 세는 것이라 리소스 자리를 옮겨도 그대로다.
 */
export function useWorkspace(reload: () => Promise<void>) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [picking, setPicking] = useState(false)
  const [refreshed, setRefreshed] = useState<SpecRefresh | null>(null)

  useEffect(() => {
    window.api.forgeWorkspace().then(setWorkspace)
  }, [])

  const busyWhile = useCallback(async (body: () => Promise<void>) => {
    setPicking(true)
    try {
      await body()
    } finally {
      setPicking(false)
    }
  }, [])

  /** 폴더를 바꾸고, 진행판이 달라지는 것이면 다시 읽는다. */
  const change = useCallback(
    (ask: () => Promise<Workspace>, andReload: boolean) =>
      busyWhile(async () => {
        setWorkspace(await ask())
        if (andReload) await reload()
      }),
    [busyWhile, reload]
  )

  // 작업 폴더가 바뀌면 진행판의 숫자가 전부 바뀐다.
  const pickWorkspace = useCallback(() => change(() => window.api.forgePickWorkspace(), true), [change])
  const pickRscRoot = useCallback(() => change(() => window.api.forgePickRscRoot(), false), [change])
  const clearRscRoot = useCallback(() => change(() => window.api.forgeSetRscRoot(''), false), [change])
  /**
   * 스펙을 읽을 양산기 폴더. **못 읽고 있을 때 여기서 고쳐야 한다** — zip 으로
   * 받은 앱은 옆에 저장소가 없어 진행판이 통째로 비어 있다. 이 한 번에 살아난다.
   */
  const pickForgeRoot = useCallback(() => change(() => window.api.forgePickForgeRoot(), true), [change])
  /** 만든 사람 · 팀 — 「끝」이 activityInfo.json 에 적는 이름. 진행판 숫자는 안 바뀐다 */
  const setMe = useCallback(
    (developer: string, devTeam: string) => change(() => window.api.forgeSetMe(developer, devTeam), false),
    [change]
  )

  /**
   * 새 스펙 받기. **받은 것이 있으면 진행판부터 다시 읽는다** — 배치표(`_layout`)도
   * 같이 바뀌었을 수 있다. 안 받았으면(고친 것이 있다 등) 화면은 그대로다.
   */
  const refreshSpecs = useCallback(
    () =>
      busyWhile(async () => {
        const got = await window.api.forgeRefreshSpecs()
        setRefreshed(got)
        if (got.ok && got.before !== got.after) await reload()
      }),
    [busyWhile, reload]
  )

  return {
    workspace,
    picking,
    refreshed,
    pickWorkspace,
    pickRscRoot,
    clearRscRoot,
    pickForgeRoot,
    setMe,
    refreshSpecs
  }
}
