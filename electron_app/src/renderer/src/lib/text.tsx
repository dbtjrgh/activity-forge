import type { ReactNode } from 'react'

/**
 * `**이렇게**` 강조한 글을 <b> 로 그린다.
 *
 * **왜 있나** — 스펙(`_spec/*.json`)의 `why`·`desc` 는 사람이 손으로 쓴 글이고
 * 거기에 별표 강조가 들어 있다. 화면은 글자를 그대로 찍으므로 **별표가 그대로
 * 보인다** (2026-09-16 에 `사람이 봐야` 카드에서 그러고 있었다).
 *
 * **글을 고치지 않고 화면에서 푼다.** 별표가 든 스펙이 119장에 흩어져 있고,
 * 그 글은 forge-ui.bat 화면도 같이 쓴다. 저장소 규칙(「강조는 화면 쪽 JSX 에서
 * `<b>`」)도 이쪽이다.
 *
 * 짝이 안 맞는 별표는 **글자 그대로 둔다** — 임의로 지우면 사람이 쓴 뜻이 바뀐다.
 */
export function bolded(text: string): ReactNode {
  if (!text.includes('**')) return text
  const out: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*/g
  let at = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > at) out.push(text.slice(at, m.index))
    out.push(<b key={m.index}>{m[1]}</b>)
    at = m.index + m[0].length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}
