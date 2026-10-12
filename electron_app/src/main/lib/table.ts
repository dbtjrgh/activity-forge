/**
 * **AI 가 낸 글에서 표를 줄과 칸으로 가른다.** 양산도 리소스도 모른다.
 *
 * 브리프는 늘 「탭으로 나눠서 답하라」고 시키는데 **AI 는 마크다운 표로 답하는 일이
 * 잦다.** 전에는 탭만 읽어서 그런 답이 통째로 0줄이 됐고, 버린 기록도 안 남아
 * **조용히** 사라졌다 — 재 보니 여섯 줄 다 맞은 답을 한 줄도 못 건졌다(2026-09-15).
 * 꼴이 어긋났다고 맞는 답을 버릴 까닭이 없다.
 *
 * **두 곳이 쓴다** — 리소스 맞추기(`brief.ts`)와 이름 정하기(`name.ts`). 가르는
 * 셈이 두 벌이 되면 한쪽만 고쳐 놓고 「저기서는 되는데 여기서는 안 된다」가 된다.
 */

/** 마크다운 표의 구분선(`|---|---|`)인가. */
function isRule(line: string): boolean {
  return /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-')
}

/**
 * 표를 칸 배열의 줄 목록으로 읽는다. **칸이 둘 미만인 줄은 버린다** —
 * 앞뒤에 설명을 붙여 보내도 표만 건져낸다.
 *
 * 머리글은 **다음 줄이 구분선인가**로 가린다. 이름(`별칭`·`지금이름`…)을 미리
 * 정해 두면 끝이 없다.
 */
export function readRows(text: string): string[][] {
  const out: string[][] = []
  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? '').trim()
    if (!line || line.startsWith('#')) continue
    if (isRule(line) || isRule(lines[i + 1] ?? '')) continue

    // 탭이 먼저다 — 시킨 꼴이고, 칸 안에 파이프가 들어 있어도 안전하다.
    // 탭이 없을 때만 마크다운 표로 본다(양끝 파이프를 떼고 가른다).
    const cell = line.includes('\t')
      ? line
          .replace(/^\s*[-*|]\s*/, '')
          .split('\t')
          .map((c) => c.trim())
      : line.includes('|')
        ? line
            .replace(/^\s*\|/, '')
            .replace(/\|\s*$/, '')
            .split('|')
            .map((c) => c.trim())
        : []

    if (cell.length < 2) continue
    // 어느 칸이든 구분선 조각이면 표의 틀이다.
    if (cell.some((c) => /^[-=:|\s]+$/.test(c))) continue
    out.push(cell)
  }
  return out
}
