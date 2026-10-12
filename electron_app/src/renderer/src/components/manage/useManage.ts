import { useCallback, useEffect, useState } from 'react'
import type { GateResult, HallStatus, RscWait, TeamTally } from '../../../../shared/forge'

/**
 * 완성본 점검이 이보다 오래됐으면 화면을 열 때 저절로 다시 잰다 — 6초쯤이고 AI 를 안 부른다.
 * 호 저장소는 하루에도 몇 번 바뀌므로 「어제 잰 것」을 오늘 것처럼 보이지 않게 한다.
 */
const GATE_STALE = 24 * 60 * 60_000

/**
 * 「관리」 화면 네 칸을 **한꺼번에** 읽는다 — 머리의 요약 네 장이 넷을 다 봐야 한다.
 * 칸마다 따로 온다(느린 받을 리소스가 저장소 칸을 붙잡지 않게). 완성본 점검은 지난 결과를 먼저 보이고,
 * 안 쟀거나 하루가 지났으면 뒤에서 다시 잰다. 그 밖에는 「다시 재기」 단추로.
 */
export type ManageData = {
  repos: HallStatus | null
  rsc: RscWait | null
  gate: GateResult | null
  teams: TeamTally | null
}

export function useManage(): {
  data: ManageData
  reload: () => void
  measuring: boolean
  measure: () => void
  pickMonth: (month: string) => void
} {
  const [data, setData] = useState<ManageData>({ repos: null, rsc: null, gate: null, teams: null })
  const [measuring, setMeasuring] = useState(false)

  const measure = useCallback(() => {
    setMeasuring(true)
    void window.api
      .manageGateRun()
      .then((gate) => setData((d) => ({ ...d, gate })))
      .finally(() => setMeasuring(false))
  }, [])

  const reload = useCallback(() => {
    setData({ repos: null, rsc: null, gate: null, teams: null })
    void window.api.manageRepos().then((repos) => setData((d) => ({ ...d, repos })))
    void window.api.manageTeams().then((teams) => setData((d) => ({ ...d, teams })))
    void window.api.manageGate().then((gate) => {
      setData((d) => ({ ...d, gate }))
      if (!gate.error && (!gate.at || Date.now() - gate.at > GATE_STALE)) measure()
    })
    void window.api.manageRsc().then((rsc) => setData((d) => ({ ...d, rsc })))
  }, [measure])

  /** 받을 리소스를 다른 호로 — 그 칸만 다시 읽는다 */
  const pickMonth = useCallback((month: string) => {
    setData((d) => ({ ...d, rsc: null }))
    void window.api.manageRsc(month).then((rsc) => setData((d) => ({ ...d, rsc })))
  }, [])

  useEffect(reload, [reload])
  return { data, reload, measuring, measure, pickMonth }
}
