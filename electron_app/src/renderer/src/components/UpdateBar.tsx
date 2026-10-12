import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpecRefresh, UpdateCheck } from '../../../shared/forge'

/** 원격에 묻는 사이 — 커밋만 묻고(`ls-remote`) 바뀌었을 때만 받으니 1분마다 물어도 가볍다 */
const EVERY_MS = 60_000
/** 창으로 돌아왔을 때 다시 묻는 최소 사이 */
const FOCUS_MS = 15_000

const clock = (ms: number): string => new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

/**
 * **업데이트 막대** (2026-09-29 사용자 말 — 「내가 업데이트 할 때마다 업데이트 버튼이 활성화돼서 새로 갱신되도록」).
 * 켤 때 한 번, 그 뒤 1분마다, 창으로 돌아올 때 원격에 묻는다(`checkUpdate` — 받지 않음). **새 판이 있을 때만 단추가 켜진다**
 * (2026-10-01 — 10분마다는 늦었다). 묻다가 실패하면(로그인 · 연결) 창으로 돌아올 때까지 다시 묻지 않는다.
 * 누르면 양산기 자료(`refresh.ts`)와 앱 새 버전(`appupdate.ts`)을 같이 받는다 — 앱을 받았으면 앱이 다시 켜진다.
 * 소스로 띄운 앱(`start-app.bat`)은 감시 모드가 아니라 받은 코드는 앱을 다시 켜야 먹는다. 스펙 · 배치표는 바로 먹는다.
 */
export default function UpdateBar({
  refreshed,
  busy,
  onUpdate
}: {
  refreshed: SpecRefresh | null
  busy: boolean
  onUpdate: () => Promise<void>
}) {
  const [check, setCheck] = useState<UpdateCheck | null>(null)
  const failed = useRef(false)
  const askedAt = useRef(0)
  const ask = useCallback(async () => {
    askedAt.current = Date.now()
    const got = await window.api.forgeUpdateCheck()
    failed.current = Boolean(got.error)
    setCheck(got)
  }, [])

  useEffect(() => {
    void ask()
    const t = setInterval(() => {
      if (!failed.current) void ask()
    }, EVERY_MS)
    const onFocus = (): void => {
      if (Date.now() - askedAt.current > FOCUS_MS) void ask()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [ask])

  const update = useCallback(async () => {
    await onUpdate()
    await ask()
  }, [onUpdate, ask])

  const behind = check?.behind ?? 0
  const appNew = Boolean(check?.app)
  const has = behind > 0 || appNew
  const what = [behind ? `새 커밋 ${behind}개` : '', appNew ? (check?.app?.version ? `앱 새 버전 v${check.app.version}` : '앱 새 버전') : ''].filter(Boolean).join(', ')
  const line = !check
    ? '업데이트 확인 중…'
    : check.error
      ? check.error
      : has
        ? `업데이트가 있습니다: ${what}${behind ? ` (${check.commits[0] ?? ''})` : ''}`
        : `최신 버전입니다 (${clock(check.checkedAt)} 확인)`

  return (
    <div className={`update-bar${has ? ' has-new' : ''}`}>
      <div className="update-head">
        <span className={`sub${check?.error ? ' warn' : ''}`} title={check?.commits.join('\n')}>
          {line}
        </span>
        <button className={has ? 'go' : 'ghost'} onClick={() => void update()} disabled={busy || !has}>
          {busy ? '받는 중…' : '업데이트'}
        </button>
      </div>
      {refreshed && (
        <p className={refreshed.error || !refreshed.ok ? 'state error' : 'sub'}>{refreshed.error || refreshed.note}</p>
      )}
    </div>
  )
}
