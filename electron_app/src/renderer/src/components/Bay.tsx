/**
 * **놓는 자리 한 칸** — 리소스 · figma 화면 · 기획서가 같은 꼴로 보인다.
 *
 * 셋은 사람이 **주는 것**이라는 점에서 하나인데, 여태 생김새가 다 달랐다 —
 * 리소스만 점선 칸이고 나머지 둘은 글 한 줄이라, **어디에 놓으면 되는지가
 * 눈에 안 들어왔다.** 여기서 한 꼴로 맞춘다 (2026-09-21 사용자 말 —
 * 「누가 봐도 여기에 놔야 할 것 같이」).
 *
 * **칸은 받는 자리가 아니다** (2026-09-23 사용자 말 — 「구역 구별하지 말고」). 파일은 화면
 * 어디에 놓아도 확장자로 나뉘어 들어간다(`DropAll.tsx` · `lib/dropbus.ts`). 칸은 **무엇이
 * 몇 개 들어왔나**를 보인다. 따로 적는 것은 figma 화면의 **Ctrl+V** 하나다 — 붙여넣기는
 * 끌어다 놓기와 길이 달라서.
 *
 * **들어 있는 개수를 늘 보인다.** 「받았습니다」만 보이면 몇 개가 쌓였는지,
 * 지운 것이 지워졌는지 알 수 없다.
 *
 * 그림은 **인라인 SVG** 다. 앱 CSP 가 바깥 CDN 을 막고, 막는 것이 맞다.
 */

/** 어떻게 주나 — **붙여넣기만** 따로 적는다. 파일은 화면 어디에 놓아도 된다(`DropAll.tsx`) */
type How = 'paste'

/** 칸마다 다른 그림. 글자 없이 꼴만으로 무엇을 놓는 자리인지 알게 한다. */
const ICONS = {
  /** 파일 더미 */
  rsc: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  /** 화면 */
  shot: 'M3 5h18v11H3zM8 20h8M12 16v4',
  /** 종이 */
  plan: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6'
} as const

function Bay({
  icon,
  title,
  how,
  hint,
  count,
  busy,
  action,
  children
}: {
  icon: keyof typeof ICONS
  title: string
  how?: How
  /** 한 줄 설명. **무엇을 놓으면 되는지**만 적는다 */
  hint: string
  /** 지금 들어 있는 개수. 0 이면 「아직 없습니다」 */
  count: number
  busy?: boolean
  /** 오른쪽 위에 놓을 단추 (있으면) */
  action?: React.ReactNode
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className={`bay ${count ? 'has' : 'empty'}${busy ? ' busy' : ''}`}>
      {/* 설명은 **비었을 때만** — 들어 있으면 할 일을 이미 안다. 들어 있을 때는 제목 줄에 마우스를 올리면 나온다 (2026-10-01 「글씨가 너무 많아서」) */}
      <div className="bay-head" title={count ? hint : undefined}>
        <svg className="bay-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d={ICONS[icon]} />
        </svg>
        <span className="bay-title">{title}</span>
        {/* **어떻게 주는지를 제목 옆에 박는다.** 이것이 이 칸의 성격이다. */}
        {how === 'paste' && (
          <span className="bay-how">
            <kbd>Ctrl</kbd>
            <kbd>V</kbd>
          </span>
        )}
        <span className={count ? 'bay-count on' : 'bay-count'}>
          {count ? `${count}개` : '없음'}
        </span>
        {action}
      </div>
      {!count && <p className="bay-hint">{hint}</p>}
      {children}
    </div>
  )
}

export default Bay
