import { useCallback, useEffect, useRef, useState } from 'react'
import type { RegressChanged, RegressProgress, RegressResult } from '../../../../shared/forge'

/**
 * 「관리」 화면의 빠른 모듈 회귀 검사 칸 (2026-10-15) — 고친 모듈 · 지난 결과 · 도는 판의 진행.
 * 돌리는 일은 메인이 뒤에서 한다 — 화면을 떠났다 와도 진행 줄을 다시 받고(`manageRegress`), 끝나면 결과를 다시 읽는다.
 */
export function useRegress(): {
  changed: RegressChanged | null
  last: RegressResult | null
  progress: RegressProgress
  run: (names: string[]) => void
  /** 돌리지 못한 까닭(모듈을 못 찾음 · 완성본이 없음) — 지난 결과는 그대로 둔다 */
  runError: string
  reload: () => void
} {
  const [changed, setChanged] = useState<RegressChanged | null>(null)
  const [last, setLast] = useState<RegressResult | null>(null)
  const [progress, setProgress] = useState<RegressProgress>({ running: false, done: 0, total: 0, now: [] })
  const [runError, setRunError] = useState('')
  const wasRunning = useRef(false)

  const readLast = useCallback(() => {
    void window.api.manageRegress().then((s) => {
      setLast(s.last)
      setProgress(s.progress)
      wasRunning.current = s.progress.running
    })
  }, [])

  const reload = useCallback(() => {
    setChanged(null)
    void window.api.manageRegressChanged().then(setChanged)
    readLast()
  }, [readLast])

  useEffect(() => {
    reload()
    return window.api.onManageRegress((p) => {
      setProgress(p)
      // 끝난 판의 결과는 파일에서 다시 읽는다 — 다른 화면에서 시작한 판이어도 같다
      if (wasRunning.current && !p.running) readLast()
      wasRunning.current = p.running
    })
  }, [reload, readLast])

  const run = useCallback((names: string[]) => {
    if (!names.length) return
    setRunError('')
    setProgress((p) => ({ ...p, running: true, done: 0, total: 0, now: [] }))
    wasRunning.current = true
    void window.api.manageRegressRun(names).then((r) => {
      if (r.at) setLast(r)
      else setRunError(r.error ?? '실행하지 못했습니다.')
      // 진행 형편은 메인에 다시 묻는다 — 「다른 모듈을 확인하는 중」으로 거절된 응답이 도는 판의 진행 줄을 풀면 단추가 열렸다
      readLast()
    })
  }, [readLast])

  return { changed, last, progress, run, runError, reload }
}
