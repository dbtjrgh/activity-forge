/**
 * 받침에 맞는 조사 (양산을 모른다). 「figma 화면를」이 화면에 그대로 찍히고 있었다 (2026-09-29, M4 에 찾음).
 *
 * `withFinal` 은 받침이 있을 때(을 · 이 · 으로), `without` 은 없을 때. 「으로」는 ㄹ 받침이면 「로」다.
 * 한글로 안 끝나면 받침을 모르니 `without` 이다.
 */
export function josa(word: string, withFinal: string, without: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return without
  const final = code % 28
  return final !== 0 && !(withFinal === '으로' && final === 8) ? withFinal : without
}
