import { useCallback, useEffect, useRef, useState } from 'react'
import type { ShareAuto, ShareLook } from '../../../shared/forge'
import { formatAgo, formatBytes } from '../lib/format'
import ShareLists, { KIND } from './ShareLists'

/** 「공유 폴더에서 소리 11개, 애니메이션 2개를 자동으로 가져왔습니다.」 */
function autoLine(auto: ShareAuto): string {
  const parts = (Object.keys(KIND) as (keyof typeof KIND)[]).flatMap((k) => (auto.kinds[k] ? [`${KIND[k]} ${auto.kinds[k]}개`] : []))
  return `공유 폴더에서 ${parts.join(', ')}를 자동으로 가져왔습니다.`
}

/** 한 줄 — 「공유 폴더에 있음 12개, 앞 호에 있음 3개, 없음 1개」(사용자와 정한 셋) */
function countLine(got: ShareLook): string {
  const share = got.items.filter((i) => i.where === 'share').length
  const hall = got.items.filter((i) => i.where === 'hall').length
  const none = got.miss.filter((m) => m.none).length
  return `공유 폴더에 있음 ${share}개, 앞 호에 있음 ${hall}개, 없음 ${none}개`
}

/**
 * **사내 공유 폴더에서 가져오기** (2026-10-14, 메인 `sharefetch.ts`) — 작업대 「리소스」 칸과 받을 리소스 창(`compact`).
 * 기획서에 적힌 소리 이름과 학습코드 자리의 애니메이션 · 영상을 공유 폴더에서 찾아 개수를 보이고, 누르면 리소스 폴더에 넣는다.
 * 찾기는 열 때 · 리소스나 기획서가 바뀔 때(`stamp`) · 창으로 돌아올 때 한다. 만드는 중인 학습코드는 메인이 찾은 것을 **저절로 가져오고**,
 * 그러면 맨 위에 눈에 띄게 알리고 리소스 목록을 다시 읽게 한다(2026-10-15 사용자 말 — 「자동으로 가져올 때 좀 잘 보이게」).
 * 단추는 저절로 안 가져온 것(개발 완료 · 한 번 지운 것 등)을 넣는 길로 남는다. 공유 폴더에 닿지 않으면 정한 문장을 그대로 보이고 단추를 막는다.
 */
export default function ShareFetch({
  code,
  stamp,
  busy = false,
  compact = false,
  onDone
}: {
  code: string
  stamp: string
  busy?: boolean
  /** 받을 리소스 창 — 한 줄과 단추만, 목록은 작업대에서 */
  compact?: boolean
  onDone: () => void
}) {
  const [got, setGot] = useState<ShareLook | null>(null)
  const [taking, setTaking] = useState(false)
  const [checking, setChecking] = useState(false)
  const [said, setSaid] = useState('')
  const [back, setBack] = useState(0)
  /** 방금 저절로 가져왔나 — 알림을 한 번 빛낸다 */
  const [fresh, setFresh] = useState(false)
  /** 이 칸이 본 마지막 「저절로 가져온 때」 — 바뀌면 방금 가져온 것이다. 처음 읽은 것은 지난 일이라 빛내지 않는다 */
  const seen = useRef<string | null | undefined>(undefined)

  // 다른 학습코드로 넘어가면 앞 목록을 바로 비운다 — 새 목록이 오기 전에 누르면 앞 학습코드의 자리를 보낸다
  useEffect(() => {
    setGot(null)
    setSaid('')
    setFresh(false)
    seen.current = undefined
  }, [code])

  // 창으로 돌아오면 다시 찾는다 — 다른 창에서 기획서를 넣었을 수 있다. 메인이 같은 학습코드는 한 번만 찾는다
  useEffect(() => {
    const again = (): void => setBack((n) => n + 1)
    window.addEventListener('focus', again)
    return () => window.removeEventListener('focus', again)
  }, [])

  // 메인이 저절로 가져왔으면(마지막 때가 바뀌면) 리소스 목록을 다시 읽게 한다 — 부르는 쪽 함수가 바뀌어도 찾기를 다시 돌리지 않게 ref 로
  const done = useRef(onDone)
  done.current = onDone
  const show = useCallback((r: ShareLook) => {
    setGot(r)
    const at = r.auto?.at ?? null
    if (seen.current === undefined) seen.current = r.copying ? null : at
    else if (at && at !== seen.current) {
      seen.current = at
      setFresh(true)
      done.current()
    }
  }, [])

  useEffect(() => {
    let live = true
    void window.api.forgeShareLook(code).then((r) => live && show(r))
    return () => {
      live = false
    }
  }, [code, stamp, back, show])

  // 뒤에서 넣는 중이면 끝날 때까지 2초마다 다시 묻는다
  useEffect(() => {
    if (!got?.copying) return
    const t = setTimeout(() => setBack((n) => n + 1), 2000)
    return () => clearTimeout(t)
  }, [got])

  // 연결을 다시 확인한다 — 못 닿은 것은 메인이 3분 들고 있어서, 로그인한 뒤 바로 보려면 사람이 누른다
  const recheck = useCallback(async () => {
    setChecking(true)
    try {
      show(await window.api.forgeShareLook(code, true))
    } finally {
      setChecking(false)
    }
  }, [code, show])

  const take = useCallback(async () => {
    if (!got) return
    setTaking(true)
    try {
      const r = await window.api.forgeShareTake(code, got.items.map((i) => i.to))
      // 못 닿은 것은 위 경고 줄이 말한다 — 같은 글을 두 번 안 보인다
      setSaid(r.look.offline ? '' : (r.look.error ?? r.put.error ?? r.put.note))
      // 넣은 뒤의 목록은 다시 찾아 그린다 — 받은 `look` 은 넣기 전에 잰 것이다
      show(await window.api.forgeShareLook(code))
      onDone()
    } finally {
      setTaking(false)
    }
  }, [code, got, onDone, show])

  if (!got) return <p className="share-fetch sub">공유 폴더를 확인하고 있습니다.</p>
  if (got.error) return <p className="share-fetch state error">{got.error}</p>
  const bytes = got.items.reduce((sum, i) => sum + i.bytes, 0)
  return (
    <div className={`share-fetch${compact ? ' compact' : ''}`}>
      {got.copying ? (
        <p className="share-auto now">
          <b>공유 폴더에서 {got.copying}개를 자동으로 가져오는 중입니다.</b>
        </p>
      ) : (
        got.auto && (
          <p className={`share-auto${fresh ? ' now' : ''}`}>
            <b>{autoLine(got.auto)}</b> <span className="sub">{formatAgo(Date.parse(got.auto.at))}</span>
          </p>
        )
      )}
      {got.autoNote && <p className="state warn">{got.autoNote}</p>}
      {got.offline ? (
        <p className="state warn">{got.offline}</p>
      ) : (
        <p className="share-count">
          {countLine(got)}
          {got.have > 0 && <span className="sub">, 이미 있음 {got.have}개</span>}
        </p>
      )}
      {/* 자리를 모르는 종류 — 받을 리소스 창에서도 보인다. 안 보이면 그 창에는 「없음 0개」로만 읽힌다 */}
      {got.unknown && <p className="state warn">{got.unknown}</p>}
      <p className="row-actions">
        <button className="ghost" type="button" disabled={busy || taking || Boolean(got.offline) || Boolean(got.copying) || got.items.length === 0} title={got.root} onClick={() => void take()}>
          {taking ? '가져오는 중입니다' : '공유 폴더에서 가져오기'}
        </button>
        {got.offline && (
          <button className="ghost" type="button" disabled={checking} onClick={() => void recheck()}>
            {checking ? '확인하는 중입니다' : '다시 확인'}
          </button>
        )}
        {!got.offline && got.items.length > 0 && (
          <span className="sub">
            {got.items.length}개, {formatBytes(bytes)}
          </span>
        )}
      </p>
      {/* 기획서 참고 이름으로 같은 호 앞선 학습코드 폴더에서 가져온 소리 — 이름은 기획서 그대로지만 자리가 달라 들어 보게 한다(`shareown.ts`) */}
      {got.near && got.near.length > 0 && (
        <p className="state warn">
          기획서 참고 이름으로 다른 학습코드 폴더에서 가져온 소리가 {got.near.length}개 있습니다. 미리보기에서 맞는 녹음인지 들어 보세요. {got.near.join(', ')}
        </p>
      )}
      {!compact && <ShareLists got={got} />}
      {!compact && got.notes.map((n) => (
        <p key={n} className="sub">
          {n}
        </p>
      ))}
      {got.truncated && <p className="state warn">{got.truncated}</p>}
      {said && <p className="sub">{said}</p>}
    </div>
  )
}
