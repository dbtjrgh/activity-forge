import { useState } from 'react'
import type { RegressChanged, RegressProgress, RegressResult, RegressRow } from '../../../../shared/forge'
import { formatAgo } from '../../lib/format'

/**
 * 빠른 모듈 회귀 검사 칸 (2026-10-15) — 공용 모듈을 고쳤을 때 그 모듈을 쓰는 개발 완료 완성본을 뒤에서 돌려 본다.
 * 돌리는 것은 메인(`services/forge/regress.ts`)이 숨긴 창 · 음소거로 한다. 여기는 고를 것 · 진행 줄 · 결과 표만.
 * 「첫 이닝까지」는 끝까지 간 것이 아니다 — 표에 그대로 적고, 요약 줄과 머리 요약 칸(`Manage.tsx`)도 그 수를 따로 말한다(`regressTally`).
 * 「모두 통과」 · 「끝 화면까지 문제 없이」는 끝 화면까지 다 간 때만 쓴다.
 */

/** 학습코드 하나의 형편 — 머리 요약 칸(`Manage.tsx`)도 이 셈을 쓴다 */
export function regressTrouble(r: RegressRow): 'ok' | 'warn' | 'fail' | 'wait' {
  if (r.reached === null) return 'wait'
  if (!r.reached) return 'fail'
  const { done, shown, data } = r.innings
  const short = r.mode === 'full' && ((done !== null && shown !== null && done < shown) || (data !== null && shown !== null && data !== shown))
  return r.errors.length || r.missing.length || short ? 'warn' : 'ok'
}

/** 결과 세기 — 확인 필요, 문제 없음, 문제 없음 가운데 첫 이닝까지만 본 것. 머리 요약 칸도 이 셈을 쓴다 */
export function regressTally(rows: RegressRow[]): { bad: number; ok: number; firstOnly: number } {
  const ok = rows.filter((r) => regressTrouble(r) === 'ok')
  return { bad: rows.length - ok.length, ok: ok.length, firstOnly: ok.filter((r) => r.mode === 'first').length }
}

/** 걸린 시간 — 초를 먼저 반올림한다(분과 초를 따로 반올림하면 「1분 60초」가 나왔다) */
function seconds(ms: number): string {
  const s = Math.round(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`
}

function reachedText(r: RegressRow): string {
  if (r.reached === null) return r.took ? '확인 못 함' : '못 돌림'
  if (!r.reached) return '못 감'
  return r.mode === 'full' ? '끝 화면까지' : '첫 이닝까지'
}

function inningText(r: RegressRow): string {
  const { done, shown, data } = r.innings
  if (shown === null) return '—'
  const base = r.mode === 'full' ? `${done ?? '—'}/${shown}` : `표시 ${shown}`
  return data !== null && data !== shown ? `${base} (GameData ${data})` : base
}

function Row({ r }: { r: RegressRow }) {
  const t = regressTrouble(r)
  const why = r.note || r.errors[0] || r.missing[0] || ''
  const detail = [...r.errors, ...r.missing.map((m) => `없음: ${m}`), ...r.log].join('\n')
  return (
    <tr>
      <td className="mono">{r.code}</td>
      <td className={t === 'ok' ? '' : t}>{reachedText(r)}</td>
      <td>{inningText(r)}</td>
      <td className={r.errors.length ? 'warn' : ''}>{r.errors.length}</td>
      <td className={r.missing.length ? 'warn' : ''}>{r.missing.length}</td>
      <td>{r.took ? seconds(r.took) : '—'}</td>
      <td className="sub manage-wrap" title={detail}>
        {why}
      </td>
    </tr>
  )
}

/** 요약 한 줄 — 첫 이닝까지만 본 것을 「끝까지 문제 없음」으로 말하지 않는다 */
function Summary({ rows }: { rows: RegressRow[] }) {
  const { bad, ok, firstOnly } = regressTally(rows)
  if (bad) {
    return (
      <p className="sub">
        확인 필요 {bad}개, 문제 없음 {ok}개{firstOnly ? `(첫 이닝까지만 확인 ${firstOnly}개)` : ''}입니다. 줄에 마우스를 올리면 기록이 보입니다.
      </p>
    )
  }
  if (!firstOnly) return <p className="manage-ok">{rows.length}개 모두 끝 화면까지 문제 없이 갔습니다.</p>
  if (firstOnly === rows.length) return <p className="sub">{rows.length}개 모두 첫 이닝까지만 확인했고 오류가 없습니다.</p>
  return (
    <p className="sub">
      {rows.length}개 모두 오류가 없었고, 그 가운데 {firstOnly}개는 첫 이닝까지만 확인했습니다.
    </p>
  )
}

function Result({ last }: { last: RegressResult }) {
  if (last.error) return <p className="state error">{last.error}</p>
  if (!last.at) return <p className="sub">아직 돌려 본 적이 없습니다.</p>
  const rows = [...last.rows].sort((a, b) => order(a) - order(b))
  return (
    <>
      <p className="sub">
        {formatAgo(last.at)} 확인, {last.modules.join(', ')}, 완성본 {last.rows.length}개, {seconds(last.took)} 소요
      </p>
      {last.names && <p className="state warn">{last.names}</p>}
      {last.limited && <p className="state warn">{last.limited}</p>}
      <Summary rows={rows} />
      <table className="run-table manage-table">
        <thead>
          <tr>
            <th>학습코드</th>
            <th>결과</th>
            <th>이닝</th>
            <th>오류</th>
            <th>404</th>
            <th>시간</th>
            <th>참고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.code} r={r} />
          ))}
        </tbody>
      </table>
    </>
  )
}

const order = (r: RegressRow): number => ({ fail: 0, warn: 1, wait: 2, ok: 3 })[regressTrouble(r)]

/** 고친 모듈 — 일부를 못 읽었어도(main 에 없는 커밋) 찾은 모듈과 단추는 그대로 보인다 */
function Changed({ changed, busy, onRun }: { changed: RegressChanged; busy: boolean; onRun: (names: string[]) => void }) {
  return (
    <>
      {changed.error && <p className={changed.modules.length ? 'state warn' : 'state error'}>{changed.error}</p>}
      {changed.modules.length ? (
        <div className="manage-bar">
          <span>고친 공용 모듈:</span>
          {changed.modules.map((m) => (
            <span key={m.key} className="mono">
              {m.key} <span className="sub">완성본 {m.finished}개{m.dirty ? ', 커밋 안 함' : ''}{m.ahead ? ', main 에 없는 커밋' : ''}</span>
            </span>
          ))}
          <button className="ghost" disabled={busy} onClick={() => onRun(changed.modules.map((m) => m.key))}>
            고친 모듈 돌려 보기
          </button>
        </div>
      ) : (
        !changed.error && <p className="sub">고친 공용 모듈이 없습니다.</p>
      )}
      {changed.outside.length > 0 && (
        <p className="state warn">
          모듈 폴더 밖이 바뀌었습니다({changed.outside.join(', ')}). 확인할 모듈 이름을 직접 적으세요.
        </p>
      )}
    </>
  )
}

function RegressSection({ changed, last, progress, runError, onRun }: { changed: RegressChanged | null; last: RegressResult | null; progress: RegressProgress; runError: string; onRun: (names: string[]) => void }) {
  const [name, setName] = useState('')
  const busy = progress.running
  const go = (): void => onRun(name.split(/[\s,]+/).filter(Boolean))
  return (
    <>
      {changed ? <Changed changed={changed} busy={busy} onRun={onRun} /> : <p className="state">고친 모듈을 찾는 중…</p>}
      <div className="manage-bar">
        <input
          className="code-input manage-regress-name"
          value={name}
          placeholder="모듈 이름 (예: M28, K05, VideoPlayer)"
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
        />
        <button className="ghost" disabled={busy || !name.trim()} onClick={go}>
          돌려 보기
        </button>
        {busy && (
          <span className="sub">
            실행 중입니다{progress.total ? ` (${progress.done}/${progress.total})` : ''}.{progress.now.length ? ` 지금: ${progress.now.join(', ')}` : ''}
          </span>
        )}
      </div>
      {runError && <p className="state error">{runError}</p>}
      {last ? <Result last={last} /> : <p className="state">지난 결과를 불러오는 중…</p>}
    </>
  )
}

export default RegressSection
