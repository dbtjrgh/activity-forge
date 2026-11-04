import { useState } from 'react'
import { isClaudeLoginNote, type SetupCheck } from '../../../../shared/forge'
import ClaudeLogin from '../ClaudeLogin'

/**
 * 처음 설정의 「필요한 프로그램」 — `FirstRun.tsx` 에서 뗐다(2026-10-16, git 이름 칸과 「확인했습니다」가 붙어 200줄을 넘을 참이었다).
 * 상태를 못 읽은 것(`confirm`)은 사람이 「확인했습니다」로 넘기고, git 이름 · 메일(`identity`)은 「저장」을 누를 때만 적는다.
 */
export default function SetupChecks({
  checks,
  confirmed,
  onConfirm,
  onRecheck
}: {
  checks: SetupCheck[]
  confirmed: Set<string>
  onConfirm: (name: string) => void
  onRecheck: () => Promise<void>
}) {
  const [checking, setChecking] = useState(false)
  const recheck = (): void => {
    setChecking(true)
    void onRecheck().finally(() => setChecking(false))
  }
  return (
    <section className="first-checks">
      <h2>
        필요한 프로그램
        {checks.some((c) => !c.ok) && (
          <button className="ghost" disabled={checking} onClick={recheck}>
            {checking ? '확인 중…' : '다시 확인'}
          </button>
        )}
      </h2>
      <ul>
        {checks.map((c) => {
          const passed = c.ok || confirmed.has(c.name)
          return (
            <li key={c.name} className={passed ? 'ok' : c.required ? 'fail' : 'warn'}>
              <b>{passed ? '✓' : c.required ? '✕' : '!'}</b> {c.name}
              {c.required && <span className="sub">(필수)</span>}
              <span className="sub">{c.note}</span>
              {c.install && (
                <button className="ghost" onClick={() => void window.api.setupOpenInstall(c.name)}>
                  설치 페이지 열기
                </button>
              )}
              {c.confirm && !passed && (
                <button className="ghost" onClick={() => onConfirm(c.name)}>
                  확인했습니다
                </button>
              )}
              {c.identity && <GitIdentity onSaved={recheck} />}
              {isClaudeLoginNote(c.note) && <ClaudeLogin done="로그인되었습니다." onDone={recheck} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** git 이름 · 메일 칸 — 저장하면 다시 확인해서 이 줄이 ✓ 로 바뀐다 */
function GitIdentity({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = (): void => {
    setSaving(true)
    setError('')
    void window.api.setupGitIdentity(name, email).then((why) => {
      setSaving(false)
      if (why) setError(why)
      else onSaved()
    })
  }
  return (
    <div className="first-row">
      <input placeholder="git 이름" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
      <input placeholder="메일" value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} />
      <button className="go" onClick={save} disabled={saving || !name.trim() || !email.trim()}>
        저장
      </button>
      {error && <p className="state error">{error}</p>}
    </div>
  )
}
