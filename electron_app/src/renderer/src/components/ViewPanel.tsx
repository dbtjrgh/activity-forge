import { useCallback, useEffect, useState } from 'react'
import type { ReproResult, Server, ViewCheck } from '../../../shared/forge'
import { hoLabel } from '../../../shared/forge'
import PreviewIssues from './PreviewIssues'

/**
 * 띄워 보기 — 리소스 화면의 마지막 칸 (4단계).
 *
 * `tsc` 와 `check:repro` 를 둘 다 통과하고도 8호 결함 둘이 살아 있었습니다.
 * **띄워 보지 않으면 양산이 끝난 것이 아닙니다.** 지금은 사람이
 * `sparkon link M07` 을 치고 주소를 손으로 적습니다.
 *
 * **정션은 사람이 누를 때만 건다** (2026-09-29 — 전에는 칠 명령만 보였다). `sparkon_common/node_modules` 는
 * **호 하나만 가리키는 전역 상태**라 저절로 걸지 않는다. 거는 셈은 `services/forge/link.ts`.
 */

/** `sparkon link M07` → `07` */
const monthOf = (command: string): string => /M(\d\d)$/.exec(command)?.[1] ?? ''

function ViewPanel({ code, moduleName }: { code: string; moduleName: string }) {
  const [check, setCheck] = useState<ViewCheck | null>(null)
  const [server, setServer] = useState<Server | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [again, setAgain] = useState<ReproResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [linking, setLinking] = useState(false)
  const [linkNote, setLinkNote] = useState('')

  useEffect(() => {
    const off = window.api.onForgeViewLog((line) => setLog((prev) => [...prev.slice(-120), line]))
    return off
  }, [])

  const look = useCallback(async () => {
    setCheck(await window.api.forgeViewCheck(code))
  }, [code])

  useEffect(() => {
    setCheck(null)
    setServer(null)
    setLog([])
    setAgain(null)
    look()
  }, [look])

  // 재현 검사 — 그 모듈 하나만. 전 모듈은 9초쯤 걸린다.
  const runRepro = useCallback(async () => {
    setChecking(true)
    try {
      setAgain(await window.api.forgeRepro(code.slice(0, 2), moduleName))
    } finally {
      setChecking(false)
    }
  }, [code, moduleName])

  const start = useCallback(async () => {
    setBusy(true)
    setLog([])
    try {
      const got = await window.api.forgeViewStart(code)
      setServer(got)
      // 뜨자마자 연다. 주소를 손으로 옮겨 적지 않게 하는 것이 이 단추의 뜻이다. **앱 안 창으로** (M6)
      if (got.url && !got.error) await window.api.forgePreviewOpen(got.url, code)
    } finally {
      setBusy(false)
    }
  }, [code])

  const link = useCallback(async () => {
    setLinking(true)
    setLinkNote('')
    try {
      const got = await window.api.forgeLink(code)
      setCheck(got.check)
      // 안 됐을 때만 글을 남긴다 — 그때는 아래에 손으로 칠 명령이 같이 보인다
      if (!got.ok) setLinkNote(`${got.error ?? '연결하지 못했습니다.'} 아래 명령을 PowerShell 에서 실행하세요.`)
    } finally {
      setLinking(false)
    }
  }, [code])

  const stop = useCallback(async () => {
    setServer(await window.api.forgeViewStop())
  }, [])

  if (!check) {
    return (
      <section className="card">
        <h3>미리보기</h3>
        <p className="state">확인 중…</p>
      </section>
    )
  }

  const up = server?.running && server.port
  const broken = check.links.filter((l) => !l.ok)
  // 폴더로 가는 것까지 한 줄로 — 붙여넣으면 바로 돈다 (M7)
  const linkLine = `Set-Location '${check.repo.replace(/[\\/][^\\/]+$/, '')}'; ${check.command}`

  return (
    <section className="card run">
      <h3>미리보기</h3>

      {check.blocked ? (
        <>
          <p className="state warn">{check.blocked}</p>
          {/* 한 번 눌러 건다 (2026-09-29 사용자 말 — 「딸깍으로」). 명령은 안 될 때만 보인다 */}
          {(broken.length > 0 || !check.sameMonth) && (
            <>
              <p className="row-actions">
                <button className="go" onClick={() => void link()} disabled={linking} title="연결하면 다른 호의 미리보기 연결은 해제됩니다.">
                  {linking ? '연결 중…' : `${hoLabel(monthOf(check.command))}로 연결`}
                </button>
                {linkNote && <span className="sub">{linkNote}</span>}
              </p>
              {linkNote && <p className="path mono">{linkLine}</p>}
            </>
          )}
          <p className="row-actions">
            <button className="ghost" onClick={look}>
              다시 확인
            </button>
          </p>
        </>
      ) : (
        <p className="row-actions">
          <button className="go" onClick={start} disabled={busy || Boolean(up)} title={up ? undefined : `${hoLabel(check.linkedMonth)}에 연결되어 있습니다. 처음 실행할 때는 몇 초 걸립니다.`}>
            {busy ? '여는 중…' : up ? '실행 중' : '미리보기'}
          </button>
          {up && (
            <>
              <button className="ghost" onClick={() => window.api.forgePreviewOpen(server.url, code)}>
                미리보기 창
              </button>
              <button className="ghost" onClick={() => window.api.openUrl(server.url)}>
                브라우저로 열기
              </button>
              <button className="ghost" onClick={stop}>
                서버 끄기
              </button>
            </>
          )}
        </p>
      )}

      {server?.error && <p className="state error">{server.error}</p>}
      {up && <p className="path mono">{server.url}</p>}
      <PreviewIssues code={code} />

      {/* 정션 넷을 그대로 보여 준다 — 무엇이 안 걸렸는지 짚을 수 있게 */}
      <details className="files">
        <summary>
          미리보기 연결 {check.links.filter((l) => l.ok).length}/{check.links.length}
          {check.linkedMonth && ` (연결된 호: ${hoLabel(check.linkedMonth)})`}
        </summary>
        <ul>
          {check.links.map((l) => (
            <li key={l.at}>
              <span className={`tag ${l.ok ? 'done' : 'error'}`}>{l.ok ? '연결됨' : '없음'}</span>
              <span className="mono">{l.name}</span>
              <span className="sub">{l.target || l.at}</span>
            </li>
          ))}
        </ul>
      </details>

      {/* ─ 재현 검사 ─ 띄워 보기와 짝이다. 눈으로 보는 것과 기계가 보는 것 */}
      <p className="row-actions repro-go">
        <button className="ghost" onClick={runRepro} disabled={checking || !moduleName} title="원본 값으로 다시 생성해 원본과 같은지 확인합니다. 10초 이상 걸릴 수 있습니다.">
          {checking ? '재현 검사 중…' : `재현 검사 (${moduleName || '모듈 알 수 없음'})`}
        </button>
      </p>
      {again && (
        <details className="files" open>
          <summary>
            재현 검사 {again.subject}/{again.module}
            {again.error && ' (실패)'}
          </summary>
          {again.error && <p className="state error">{again.error}</p>}
          {again.out.length > 0 && <pre className="made-text">{again.out.join('\n')}</pre>}
        </details>
      )}

      {log.length > 0 && (
        <details className="files" open={Boolean(server?.error)}>
          <summary>서버 로그 {log.length}줄</summary>
          <pre className="made-text">{log.join('\n')}</pre>
        </details>
      )}
    </section>
  )
}

export default ViewPanel
