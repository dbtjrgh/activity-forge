import type { LayoutPick } from '../../../shared/forge'
import OriginPicker from './bench/OriginPicker'

/**
 * 배치표가 정한 모듈과 원본 — `Resource.tsx` 에서 떼어 냄.
 * **못 정했으면 빈칸이 아니라 왜 못 정했는지를 쓴다.**
 */
function LayoutCard({
  code,
  layout,
  hasSpec,
  onChanged
}: {
  code: string
  layout: LayoutPick
  hasSpec: boolean
  onChanged: () => void
}) {
  return (
    <section className="card">
      <h3>모듈과 원본</h3>
      {layout.ok ? (
        <>
          <dl className="pairs">
            <dt>모듈</dt>
            <dd>
              <span className="mono">{layout.module}</span>
              {!hasSpec && <span className="tag warn">스펙 없음</span>}
              <span className={`tag${layout.verdict === '갈림' ? ' warn' : ''}`}>
                {layout.verdict}
              </span>
            </dd>
            <dt>원본</dt>
            <dd>
              <span className="mono">{layout.origin}</span>
              {!layout.sameSlot && <span className="tag warn">다른 위치의 원본</span>}
            </dd>
          </dl>
          {layout.why && <p className="sub">{layout.why}</p>}
          {layout.alt.length > 0 && (
            <p className="sub">다른 후보: {layout.alt.map((a) => a).join(', ')}</p>
          )}
          {/* 기계가 고른 원본이 틀리면 여기서 — 받을 리소스 · 만들기가 다 이 원본을 따른다 */}
          <OriginPicker code={code} onChanged={onChanged} />
        </>
      ) : layout.made ? (
        // 배치표 짐작과 다른, 호 저장소에 다 만든 것 — 구경 · 미리보기용이라 오류 색으로 쓰지 않는다. 공용 모듈을 안 쓰면 모듈이 빈 글
        <>
          <dl className="pairs">
            <dt>모듈</dt>
            <dd>
              {layout.module ? <span className="mono">{layout.module}</span> : <span>공용 모듈 사용 안 함</span>}
              {layout.module && !hasSpec && <span className="tag warn">스펙 없음</span>}
              <span className="tag">개발 완료</span>
            </dd>
          </dl>
          <p className="sub">{layout.why}</p>
        </>
      ) : layout.first ? (
        // 새 모듈의 첫 학습코드 — 잘못이 아니라 원본 후보가 아직 없는 것이라 오류 색으로 쓰지 않는다
        <>
          <dl className="pairs">
            <dt>모듈</dt>
            <dd>
              <span className="mono">{layout.module}</span>
              {!hasSpec && <span className="tag warn">스펙 없음</span>}
              <span className="tag">첫 학습코드</span>
            </dd>
          </dl>
          <p className="sub">{layout.why}</p>
        </>
      ) : (
        <>
          <p className="state error">{layout.why || '모듈을 정하지 못했습니다.'}</p>
          {/* 고르는 곳은 진행판 한 곳이다(`board/LayoutPicks.tsx`) — 작업대에 두 번째 고르기를 두지 않는다 */}
          {(layout.verdict === '갈림' || layout.verdict === '없음') && (
            <p className="sub">진행판의 「모듈 선택이 필요한 학습코드」에서 모듈을 고르세요.</p>
          )}
        </>
      )}
    </section>
  )
}

export default LayoutCard
