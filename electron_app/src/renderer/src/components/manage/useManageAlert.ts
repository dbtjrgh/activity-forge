import { useEffect, useState } from 'react'
import { repoTrouble } from './RepoSection'

/** 다시 볼 틈 — 업데이트 막대와 같다 */
const EVERY = 10 * 60_000

export type ManageAlert = { count: number; title: string }

/**
 * 옆줄 「관리」 단추의 점 — **손볼 호 저장소 수**만 센다(커밋 안 한 파일 · 뒤처짐 · 안 올림 · 못 읽음).
 * 완성본 점검에 걸린 것은 수에 넣지 않고 설명에만 적는다 — 걸린 9개는 다른 팀 저장소의 오래된 흠이라, 세면 점이 늘 켜져 뜻이 없어진다.
 * 무거운 셈(받을 리소스 · 점검 다시 재기)은 안 부른다 — git status 11번과 저장해 둔 점검 결과 읽기뿐이다.
 * `stamp` 가 바뀔 때(화면을 오갈 때) · 10분마다 다시 본다.
 */
export function useManageAlert(stamp: unknown): ManageAlert {
  const [alert, setAlert] = useState<ManageAlert>({ count: 0, title: '' })
  useEffect(() => {
    let off = false
    const look = (): void => {
      void Promise.all([window.api.manageRepos(), window.api.manageGate()]).then(([repos, gate]) => {
        if (off) return
        const bad = repos.repos.filter(repoTrouble)
        const lines = bad.map((r) => `${r.name}: ${r.error ?? [r.dirty ? `커밋하지 않은 파일 ${r.dirty}개` : '', r.behind ? `${r.behind}개 뒤처짐` : '', r.ahead ? `푸시 안 한 커밋 ${r.ahead}개` : ''].filter(Boolean).join(', ')}`)
        if (gate.at && gate.failed.length) lines.push(`완성본 점검 실패 ${gate.failed.length}개`)
        setAlert({ count: bad.length, title: lines.join('\n') })
      })
    }
    look()
    const timer = setInterval(look, EVERY)
    return () => {
      off = true
      clearInterval(timer)
    }
  }, [stamp])
  return alert
}
