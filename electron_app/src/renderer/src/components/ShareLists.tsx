import type { ShareLook } from '../../../shared/forge'
import { formatBytes } from '../lib/format'

export const KIND = { sound: '소리', lottie: '애니메이션', video: '영상' } as const

/**
 * 「공유 폴더에서 가져오기」(`ShareFetch.tsx`)의 두 목록 — 가져올 파일 · 가져오지 않은 파일. 작업대에서만 그린다(받을 리소스 창은 한 줄).
 * 2026-11-04 에 `ShareFetch.tsx` 가 200줄이 되어 뗐다. 기획서 참고 이름으로 다른 학습코드 폴더에서 찾은 소리(`near`)는 그 자리를 같이 적는다
 */
export default function ShareLists({ got }: { got: ShareLook }) {
  return (
    <>
      {got.items.length > 0 && (
        <details className="files">
          <summary>가져올 파일 {got.items.length}개</summary>
          <ul>
            {got.items.map((i) => (
              <li key={i.to} title={i.from}>
                <span className="mono">{i.to}</span>
                <span className="sub">
                  {KIND[i.kind]}, {i.where === 'hall' ? `앞 호 완성본 ${i.from}` : i.near ? '공유 폴더(다른 학습코드 폴더)' : '공유 폴더'}, {formatBytes(i.bytes)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {got.miss.length > 0 && (
        <details className="files">
          <summary>가져오지 않은 파일 {got.miss.length}개</summary>
          <ul>
            {got.miss.map((m) => (
              <li key={m.name}>
                <span className="mono">{m.name}</span>
                <span className="sub">{m.why}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
