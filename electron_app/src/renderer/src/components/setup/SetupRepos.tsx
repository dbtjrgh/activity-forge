import { useState } from 'react'
import type { SetupRepo, WorkPick } from '../../../../shared/forge'
import CopyButton from '../CopyButton'

/**
 * 처음 설정의 「받아 둘 저장소」 점검표 (2026-10-16, 사용자 결정 — 저장소는 전부 사람이 git 으로 받는다). 메인 쪽은 `services/forge/setuprepos.ts`.
 * 있으면 ✓ 와 지금 브랜치, 없으면 받을 명령 한 줄과 복사 단추. 공용 둘과 sparkon_cli 가 먼저고, 호 저장소는 호 차례로 하나 이상.
 * 「다시 확인」은 디스크를 다시 잰다 — 앱은 받지 않는다
 */
function Row({ r, full }: { r: SetupRepo; full: boolean }) {
  return (
    <li className={r.have ? 'ok' : 'fail'}>
      <b>{r.have ? '✓' : '✕'}</b>
      <span className="mono">{r.name}</span>
      {r.label && <span className="sub">{r.label}</span>}
      {r.have && r.branch && <span className="sub">{r.branch} 브랜치</span>}
      {r.why && <span className="sub first-why">{r.why}</span>}
      {!r.have && (
        <>
          {full && <code className="mono first-cmd">{r.command}</code>}
          <CopyButton text={r.command}>명령 복사</CopyButton>
        </>
      )}
    </li>
  )
}

export default function SetupRepos({ pick, onRecheck, disabled }: { pick: WorkPick; onRecheck: () => Promise<void>; disabled: boolean }) {
  const [checking, setChecking] = useState(false)
  const recheck = (): void => {
    setChecking(true)
    void onRecheck().finally(() => setChecking(false))
  }
  const base = pick.repos.filter((r) => r.kind !== 'hall')
  const halls = pick.repos.filter((r) => r.kind === 'hall')
  const lacking = base.filter((r) => !r.have)
  return (
    <section className="first-step first-repos">
      <h2>
        <span className="first-n">2</span>
        받아 둘 저장소
        <button className="ghost" disabled={checking || disabled} onClick={recheck}>
          {checking ? '확인 중…' : '다시 확인'}
        </button>
      </h2>
      {pick.repos.some((r) => !r.have) && <p className="first-help">명령을 PowerShell에서 실행한 뒤 「다시 확인」을 누르세요.</p>}
      <ul>
        {base.map((r) => (
          <Row key={r.name} r={r} full />
        ))}
      </ul>
      {lacking.length > 1 && (
        <div className="first-row">
          <CopyButton text={lacking.map((r) => r.command).join('\n')}>없는 것 명령 모두 복사</CopyButton>
        </div>
      )}
      {!halls.some((r) => r.have) && <p className="first-help">호 저장소는 하나 이상 받으세요.</p>}
      <ul>
        {halls.map((r) => (
          <Row key={r.name} r={r} full={false} />
        ))}
      </ul>
      {/* 아직 없는 것(`pick.missing`)은 맨 아래 「설정 완료」를 못 누르는 까닭으로 한 번만 보인다 — 여기에도 두면 같은 글이 두 번 나온다 */}
    </section>
  )
}
