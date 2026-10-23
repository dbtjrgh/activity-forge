import type { NeedRow, PlanCheck } from '../../../shared/forge'
import { kindClass, kindName } from '../lib/format'
import CopyButton from './CopyButton'
import GuideButton from './guide/GuideButton'
import ShareFetch from './ShareFetch'

/** 한 갈래의 이름표 — 영상은 서비스가 `video` 로 따로 모아 준다 */
const label = (kind: string): string => (kind === 'video' ? '영상' : kindName(kind))

/** 기획서 소리 이름으로 확인한 것 — 못 했으면 까닭, 없는 것이 있으면 이름째 */
function SoundCheck({ plan, row }: { plan: PlanCheck; row: NeedRow | undefined }) {
  if (plan.note) return <p className="sub">{plan.note}</p>
  const missing = row?.missing ?? []
  const unsure = row?.unsure ?? []
  return (
    <>
      {missing.length ? (
        <>
          <p className="state warn">
            기획서 소리 {plan.names}개 가운데 {missing.length}개가 없습니다.
          </p>
          <ul className="need-sounds">
            {missing.map((n) => (
              <li key={n} className="mono">
                {n}
              </li>
            ))}
          </ul>
          <p className="row-actions">
            <CopyButton text={missing.join('\n')}>목록 복사</CopyButton>
          </p>
        </>
      ) : (
        <p className="state done">기획서 소리 {plan.names}개가 모두 있습니다.</p>
      )}
      {unsure.length > 0 && <p className="sub">범위로만 적힌 {unsure.length}개는 세지 않습니다.</p>}
    </>
  )
}

/**
 * 리소스 — 무엇이 없나 (2026-10-14 에 셈을 바꿨다, 메인 `rsccount.ts`).
 * **「없음」은 기획서에 적혔는데 없는 소리 이름뿐이다.** 그림 · 로티는 같은 모듈 완성본이 쓴 수의 범위만 참고로 보인다 —
 * 원본 하나와 개수를 견주던 때는 다 넣은 완성본에도 절반이 「부족」이라 사람이 늘 헷갈렸다(사용자 말 — 「안내하는게 좀 불친절해서」).
 */
function NeedCard({
  code,
  need,
  plan,
  needError,
  guide,
  busy,
  onChanged
}: {
  code: string
  need: NeedRow[]
  plan: PlanCheck
  needError?: string
  /** 받을 리소스 창은 원본이 있어야 그린다 */
  guide: boolean
  /** 공유 폴더에서 가져오기를 막나 — 리소스를 넣는 칸과 같은 때 */
  busy: boolean
  /** 공유 폴더에서 가져왔다 — 작업대가 다시 읽는다 */
  onChanged: () => void
}) {
  const sound = need.find((n) => n.kind === 'sound')
  return (
    <section className="card">
      <h3>리소스</h3>
      {/* 양산의 첫 손 — figma 에서 무엇을 내보낼지 */}
      {guide && <GuideButton code={code} big short={sound?.missing.length ?? 0} />}
      {needError ? (
        <p className="state warn">{needError}</p>
      ) : (
        <>
          <SoundCheck plan={plan} row={sound} />
          {/* 기획서나 리소스가 바뀌면 공유 폴더를 다시 찾는다 */}
          <ShareFetch code={code} stamp={`${plan.names}|${plan.note}|${need.map((n) => n.kind + n.here).join(',')}`} busy={busy} onDone={onChanged} />
          {need.length > 0 && (
            <table className="need-table">
              <thead>
                <tr>
                  <th>종류</th>
                  <th className="num">지금</th>
                  <th className="num">같은 모듈 완성본</th>
                </tr>
              </thead>
              <tbody>
                {need.map((n) => (
                  <tr key={n.kind}>
                    <td>
                      <span className={`kind-chip ${kindClass(n.kind)}`}>{label(n.kind)}</span>
                    </td>
                    <td className="num">{n.here}</td>
                    <td className="num" title={n.range ? `개발 완료 완성본 ${n.range.n}개` : '비교할 완성본이 2개보다 적습니다.'}>
                      {n.range ? (n.range.min === n.range.max ? `${n.range.min}` : `${n.range.min}~${n.range.max}`) : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  )
}

export default NeedCard
