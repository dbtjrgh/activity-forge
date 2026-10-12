import { HO_OF } from '../../../../shared/forge'
import OriginPicker from '../bench/OriginPicker'
import './guideorigin.css'

/** 앞 학습코드 → 「7호 L1W1S3」. 못 읽으면 빈 글 */
export function originPlace(origin: string): string {
  const m = /^[A-Z]{2}L(\d)M(\d\d)W(\d)S(\d)$/.exec(origin)
  return m ? `${HO_OF[m[2] as string]?.name ?? `M${m[2]}`} L${m[1]}W${m[3]}S${m[4]}` : ''
}

/**
 * 받을 리소스 창 머리의 **이 창의 쓰임과 원본** (2026-09-30, 10-01 다시 씀).
 *
 * 처음 보는 사람이 「여기 놓으면 교체되나, 참고하라는 건가」를 몰랐다(사용자 말). 그래서 맨 위에 답을 박는다 —
 * **아래 그림은 참고용이다.** 무엇을 해야 하는지 세 단계로 적고, 원본 학습코드는 이 칸에만 한 번 적는다
 * (목록 머리마다 학습코드를 붙였더니 오히려 헷갈렸다). 원본이 틀렸으면 여기서 바꾼다(`OriginPicker`)
 */
function GuideOrigin({
  code,
  origin,
  note,
  onChanged
}: {
  code: string
  origin: string
  note?: string
  onChanged: () => void
}) {
  const place = originPlace(origin)
  const ho = place.split(' ')[0]
  return (
    <div className="guide-origin">
      {/* 세 단계는 낱말만 — 풀어 쓴 설명은 마우스를 올리면 (2026-10-01 「글씨가 너무 많아서」) */}
      <ol
        className="guide-steps"
        title={`아래 그림은 ${ho || '앞 호'}에서 같은 자리에 쓴 참고용 그림입니다. 파일 이름은 바꾸지 않아도 됩니다. 들어오면 「받음」이 표시됩니다.`}
      >
        <li>figma에서 같은 역할의 그림 찾기</li>
        <li>1x PNG로 내보내기</li>
        <li>작업대에 끌어다 놓기</li>
      </ol>
      <div className="guide-origin-line">
        <span className="guide-origin-label">참고 원본</span>
        <b className="mono">{origin || '—'}</b>
        <span className="sub">{place}</span>
        <span className="guide-grow" />
        <OriginPicker code={code} onChanged={onChanged} />
      </div>
      {note && <p className="guide-origin-note">{note}</p>}
    </div>
  )
}

export default GuideOrigin
