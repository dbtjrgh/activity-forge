/**
 * **Tab 으로 채우는 입력 칸** (2026-10-01 사용자 요청 — 「탭 누르면 바로 완성되게」).
 * 비어 있을 때 Tab 을 누르면 제안한 값이 들어가고 다음 칸으로 넘어간다. 제안이 없으면 보통 입력 칸이다.
 * 예시 글(placeholder)에 들어갈 값만 보인다(Tab 안내 글은 사용자가 뺐다) — 남의 이름을 예시로 박지 않는다(제안은 그 PC 의 git 이름에서 온다)
 */
function SuggestInput({
  label,
  value,
  suggest,
  onChange,
  disabled
}: {
  label: string
  value: string
  suggest: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <input
      aria-label={label}
      placeholder={suggest ? `${label}: ${suggest}` : label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // 막지 않는다 — 채운 뒤 Tab 은 그대로 다음 칸으로 간다
        if (e.key === 'Tab' && !e.shiftKey && value === '' && suggest) onChange(suggest)
      }}
    />
  )
}

export default SuggestInput
