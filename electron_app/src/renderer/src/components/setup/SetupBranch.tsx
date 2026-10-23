import { useState } from 'react'
import { onMainBranch, type BranchPlan, type BranchPlans } from '../../../../shared/forge'

/**
 * 처음 설정의 「내 브랜치」 계획 (2026-10-16) — sparkon_common 과 받아 둔 호마다 무엇을 할지. 메인 쪽은 `services/forge/setupbranch.ts`.
 * 원격에 같은 이름 브랜치가 있으면 마지막 커밋의 작성자와 날짜를 보이고, **두 번 눌러야** 따라간다(남의 브랜치에 실수로 푸시하지 않게).
 * 확인 창(`window.confirm`)은 쓰지 않는다 — CDP 가 멈춘다(함정).
 * 누른 상태(`armed`)는 이 칸 안에만 있다 — 작업 폴더나 브랜치 이름이 바뀌면 부르는 쪽이 새로 그린다(`key`)
 */
function say(p: BranchPlan, branch: string): string {
  switch (p.action) {
    case 'same':
      return `지금 ${branch} 브랜치입니다.`
    case 'local':
      return `로컬에 있는 ${branch} 브랜치로 바꿉니다.`
    case 'create':
      return `origin/main 에서 ${branch} 브랜치를 만듭니다.`
    case 'remote':
      return `원격에 ${branch} 브랜치가 이미 있습니다.`
    default:
      return p.why ?? ''
  }
}

type RowProps = {
  p: BranchPlan
  branch: string
  on: boolean
  armed: boolean
  disabled: boolean
  onArm: () => void
  onFollow: (on: boolean) => void
}

function Row({ p, branch, on, armed, disabled, onArm, onFollow }: RowProps) {
  const warn = p.action === 'remote' || p.action === 'dirty' || p.action === 'error'
  // 못 바꾸고 main 에 남을 저장소 — 메인이 실패로 두고 「마치기」를 막는다(`setupbranch.ts`)
  const stays = ((p.action === 'remote' && !on) || p.action === 'dirty') && onMainBranch(p.now)
  return (
    <li className={warn && !on ? 'warn' : 'ok'}>
      <span className="mono">{p.repo}</span>
      <span className="sub">{say(p, branch)}</span>
      {stays && <span className="sub">이대로 두면 {p.now} 브랜치에 남아 마칠 수 없습니다.</span>}
      {p.action === 'remote' && (
        <span className="sub">
          마지막 커밋 {p.author || '작성자 모름'}, {p.date || '날짜 모름'}
        </span>
      )}
      {p.action === 'remote' &&
        (on ? (
          <>
            <span className="sub">따라가기로 했습니다.</span>
            <button className="ghost" disabled={disabled} onClick={() => onFollow(false)}>
              취소
            </button>
          </>
        ) : (
          <button className={armed ? 'go' : 'ghost'} disabled={disabled} onClick={() => (armed ? onFollow(true) : onArm())}>
            {armed ? '한 번 더 누르면 따라갑니다' : '이 브랜치를 따라갑니다'}
          </button>
        ))}
    </li>
  )
}

export default function SetupBranch({
  plans,
  follow,
  onFollow,
  disabled
}: {
  plans: BranchPlans | null
  follow: Set<string>
  onFollow: (repo: string, on: boolean) => void
  disabled: boolean
}) {
  const [armed, setArmed] = useState('')
  if (!plans) return null
  if (plans.error) return <p className="state error">{plans.error}</p>
  const unsure = plans.repos.some((p) => p.action === 'remote' && !follow.has(p.repo))
  return (
    <>
      <ul className="first-plan">
        {plans.repos.map((p) => (
          <Row
            key={p.repo}
            p={p}
            branch={plans.branch}
            on={follow.has(p.repo)}
            armed={armed === p.repo}
            disabled={disabled}
            onArm={() => setArmed(p.repo)}
            onFollow={(on) => {
              setArmed('')
              onFollow(p.repo, on)
            }}
          />
        ))}
      </ul>
      {unsure && <p className="first-help">내 브랜치가 아니면 브랜치 칸에 다른 이름을 적으세요.</p>}
    </>
  )
}
