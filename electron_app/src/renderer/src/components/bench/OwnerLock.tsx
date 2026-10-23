import { useEffect, useState } from 'react'

/**
 * **남이 끝낸 학습코드** (2026-10-14, 메인 `owner.ts`) — 작업대 머리 아래 경고 한 줄과 안전장치 단추 「그래도 고치기」.
 * 작업대는 대화로 생성 · 검수 완료 · 커밋 · 휴지통 · 초기화 단추를 막는다. 사용자 결정 — 「그래도 덮어씌우고 싶으면 할 수 있게 안전장치 버튼」.
 * 한 번 누르면 무엇이 풀리는지 보이고 한 번 더 눌러야 푼다(확인 창은 CDP 를 멈추게 해서 안 쓴다 — `ResetCode.tsx` 와 같은 꼴).
 * 푼 것은 이 학습코드에서만, 다른 학습코드로 가면 다시 잠긴다(`Bench`). `canOpen` 이 false 면(지난 호에서 모듈이 달라 보기만 하는 칸) 경고만 보인다
 */
export default function OwnerLock({
  code,
  line,
  open,
  canOpen,
  onOpen
}: {
  code: string
  line: string
  open: boolean
  canOpen: boolean
  onOpen: () => void
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => setArmed(false), [code])
  if (!line) return null
  if (open) return <p className="state warn owner-lock">{line} 이 학습코드에서는 고치는 단추를 풀었습니다.</p>
  return (
    <div className="owner-lock">
      {/* 대화 · 검수 · 초기화 칸은 막힌 까닭을 따로 안 적는다 — 이 줄이 말한다 */}
      <p className="state warn">{line} 고치는 단추를 막았습니다.</p>
      {canOpen && (
        <p className="row-actions">
          <button className={armed ? 'danger' : 'ghost'} onClick={() => (armed ? onOpen() : setArmed(true))}>
            그래도 고치기
          </button>
          {armed && <span className="sub">한 번 더 누르면 남이 끝낸 학습코드를 고칩니다.</span>}
        </p>
      )}
    </div>
  )
}
