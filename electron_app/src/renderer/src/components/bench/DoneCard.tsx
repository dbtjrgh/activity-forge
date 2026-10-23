import { useCallback, useEffect, useState } from 'react'
import { BUTTON, type CommitResult, type DoneResult } from '../../../../shared/forge'
import { TOUR_ANCHOR } from '../../lib/anchors'
import { bolded } from '../../lib/text'
import UnusedRsc from './UnusedRsc'

/**
 * **「검수 완료」 · 「양산 완료 커밋」** (2026-09-29, M7 · 2026-09-30) — 앱 안 창에서 보고 누른다. 앞 단추는 호 저장소의
 * activityInfo.json 을 devFinished:true · 오늘 날짜 · 내 이름으로(`done.ts`), 뒤 단추는 그 학습코드만 `<코드> 양산 완료` 로
 * 커밋 · 푸시한다(`hallcommit.ts`). **액티비티는 다시 만들지 않는다** — 본 그대로가 끝이다.
 *
 * main 에 올리는 것과 완료 뒤 리소스 폴더 정리는 진행판 맨 위로 옮겼다(2026-10-14 사용자 말 — 「메인에 한 번에 다 올리는 식」,
 * 「매 학습코드 내에 리소스 정리 버튼은 없애고」). 여기는 그 자리를 한 줄로 안내만 한다.
 *
 * 앱 안 창에는 preload 가 없어 거기 단추를 못 둔다 — 그래서 작업대에 둔다(M6 판단).
 *
 * 2026-10-14 —
 * - 두 단추 다 하기 직전에 메인이 타입 검사를 한다(10초 넘게). 이 학습코드에 오류가 있으면 안 하고 오류 줄을 돌려준다
 * - 이미 개발 완료로 커밋한 내 학습코드면 커밋 단추가 「수정사항 커밋」이다(`committed`) — 메인이 문구를 `<코드> 수정사항 반영` 으로 고른다
 * - Claude 가 적은 「미리보기에서 확인할 것」(`look`)을 검수 완료 바로 위에 보인다. 「확인했습니다」를 누르기 전에는 검수 완료가 꺼진다
 * - 남이 끝낸 학습코드는 막는다(`lock` 은 그 까닭). 작업대에서 「그래도 고치기」로 풀면 `force` 로 부른다
 */
/** 하기 직전 타입 검사가 찾은 이 학습코드 오류 줄 — 앞 스무 줄 */
function TscLines({ lines }: { lines?: string[] }) {
  if (!lines?.length) return null
  return (
    <ul className="sub main-extra">
      {lines.slice(0, 20).map((l, i) => (
        <li key={i} className="mono">
          {l}
        </li>
      ))}
    </ul>
  )
}

/**
 * `wait` — 막는 까닭 한 줄. 대화로 만드는 중이면 파일이 반쯤 쓰인 채라 검수 완료 · 커밋을 막는다 (2026-10-08 첫 시험에서 켜져 있었다)
 */
export default function DoneCard({
  code,
  wrote,
  dummy,
  wait = '',
  lock = '',
  force = false,
  committed = false,
  look = [],
  onSeen,
  onDone
}: {
  code: string
  wrote: boolean
  dummy: boolean
  wait?: string
  lock?: string
  force?: boolean
  committed?: boolean
  look?: string[]
  onSeen?: () => void
  onDone: () => void
}) {
  const [there, setThere] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  // 어느 단추가 도는 중인가 — 검수 완료 · 커밋은 타입 검사로 10초 넘게 걸려 그동안 단추 이름을 바꾼다
  const [doing, setDoing] = useState<'' | 'done' | 'commit'>('')
  const [got, setGot] = useState<DoneResult | null>(null)
  const [pushed, setPushed] = useState<CommitResult | null>(null)

  useEffect(() => {
    let off = false
    void window.api.forgeViewCheck(code).then((c) => !off && setThere(c.activity))
    return () => {
      off = true
    }
  }, [code, wrote])

  const done = useCallback(async () => {
    setBusy(true)
    setDoing('done')
    try {
      const r = await window.api.forgeDone(code, force)
      setGot(r)
      if (r.ok) onDone()
    } finally {
      setBusy(false)
      setDoing('')
    }
  }, [code, force, onDone])

  const commit = useCallback(async () => {
    setBusy(true)
    setDoing('commit')
    try {
      const r = await window.api.forgeCommit(code, force)
      setPushed(r)
      // 커밋했으면 다시 읽는다 — 마지막 커밋이 개발 완료가 되어 다음 단추 이름이 「수정사항 커밋」이 된다
      if (r.ok) onDone()
    } finally {
      setBusy(false)
      setDoing('')
    }
  }, [code, force, onDone])

  const off = busy || !there || dummy || Boolean(wait) || Boolean(lock)
  return (
    <section className="card">
      <h3>검수</h3>
      {/* 막는 검사가 아니라 한 번 누르기 — 대화 끝 글에 묻혀 안 보던 것을 단추 바로 위에 둔다 */}
      {look.length > 0 && (
        <div className="done-look">
          {/* 검수 완료가 꺼진 까닭이 이 줄이다 — 「확인했습니다」를 눌러야 켜진다 */}
          <p className="state warn">미리보기에서 아래 {look.length}개를 확인한 뒤 「확인했습니다」를 누르세요.</p>
          <ul>
            {/* Claude 가 굵게 적은 것(`**기획서 오기**`)이 있다 — 대화 칸과 같이 풀어 그린다 */}
            {look.map((l, i) => (
              <li key={i}>{bolded(l)}</li>
            ))}
          </ul>
          <button className="ghost" disabled={busy} onClick={onSeen}>
            확인했습니다
          </button>
        </div>
      )}
      <p className="row-actions">
        <button id={TOUR_ANCHOR.benchCheck} className="go" onClick={() => void done()} disabled={off || look.length > 0}>
          {doing === 'done' ? '타입 검사 중…' : BUTTON.done}
        </button>
        <button id={TOUR_ANCHOR.benchCommit} onClick={() => void commit()} disabled={off}>
          {doing === 'commit' ? '타입 검사 중…' : committed ? BUTTON.fixCommit : BUTTON.commit}
        </button>
        {/* 할 일 차례는 작업 순서 막대가 말한다 — 못 누를 때 까닭 한 줄만 (2026-10-01). 도는 중은 단추 이름이, 남의 것은 머리 경고가 말한다 */}
        {doing ? null : wait ? (
          <span className="sub">{wait}</span>
        ) : lock ? null : dummy || there === false ? (
          <span className="sub">대화로 생성한 뒤 누를 수 있습니다.</span>
        ) : null}
      </p>
      {got?.error && <p className="state error">{got.error}</p>}
      <TscLines lines={got?.tscErrors} />
      {got?.ok && <p className="state done">{got.note}</p>}
      {pushed?.error && <p className="state error">{pushed.error}</p>}
      <TscLines lines={pushed?.tscErrors} />
      {pushed && (pushed.done.length > 0 || pushed.note) && (
        <p className={pushed.ok ? 'state done' : 'sub'}>{[...pushed.done, pushed.note].filter(Boolean).join(', ')}</p>
      )}
      {/* main 에 올리기 · 리소스 폴더 정리는 진행판 맨 위에서 한 번에 한다 — 단추가 없어진 자리를 한 줄로 알린다 */}
      <p className="sub">main 에는 진행판의 「{BUTTON.mainAll}」로 올립니다.</p>
      {/* 커밋 전에 치우게 — 옮긴 파일은 「양산 완료 커밋」에 같이 담긴다 */}
      <UnusedRsc code={code} wrote={wrote} wait={wait} force={force} />
    </section>
  )
}
