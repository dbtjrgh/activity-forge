/**
 * **기획서가 다시 쓰는 다른 학습코드의 소리 · 애니메이션 이름 — 받는 규칙** (2026-10-15, 공유 폴더 가져오기 `sharepick.ts` 가 쓴다).
 *
 * 기획서는 앞 학습코드 것을 다시 쓸 때 원래 이름을 그대로 적는다 — `SL_ma_114_s1_nar03 (기존 재사용)`, 로티 `mal1m04w2s1_effect`.
 * 이름에 든 학습코드(소리는 번호를 거꾸로 셈)로 공유 폴더와 그 학습코드 완성본 자리를 바로 찾는다.
 *
 * 그런데 기획서 PDF 한 벌에 다른 레벨 · 다른 주 시트가 같이 실려 온다 — MAL2M08W2S3 · MAL3M08W2S3 기획서에 L3 3주 시트의
 * `SL_ma_331_s3_*` 11개가 있었고 완성본은 하나도 안 썼다. 9호 기획서 31개를 완성본 sounds 와 대 보고 정했다 —
 * - **소리** — 이름의 누적 주가 이 학습코드보다 늦지 않고, 이름 뒤에 「기존 · 재사용」이 적혔거나 레벨이 같을 때만.
 *   받은 것 36개 중 26개를 완성본이 썼다(안 쓴 10개 중 2개는 1쪽 주인으로 거르는 남의 기획서 — `plansound.ts`,
 *   6개는 KOL2M08W2S2 기획서가 「기존」이라 적은 것). 안 받은 것 90개 중 89개는 안 썼다(못 받은 하나는 MAL1M08W3S3 의 L2 `231_s3_nar01`).
 *   쪽마다 주인 학습코드로 가르기는 안 맞았다 — 다른 시트 이름이 이 학습코드 쪽에도 섞였고, 진짜 다시 쓰는 MAL1M08W4S1 의 `114` 는 빠졌다.
 *   주 · 레벨 구조만으로도 안 맞았다 — KOL2M08W2S3 은 같은 호 1주 S2(`229_s2`)를 다시 쓴다.
 *   이 규칙이 안 받은 이름도 **이 학습코드의 공유 폴더**에 있으면 받는다(2026-10-23, `shareown.ts`) — 한 주 늦은 번호 · 다른 레벨 번호가 거기 들어 있다
 * - **로티** — 이름의 누적 주가 늦지 않은 것만 후보로 낸다. 로티는 다른 레벨 것을 그대로 쓰는 일이 흔해(MAL1M08W3S3 ← `mal2m08w3s3_*`)
 *   레벨은 안 본다. 로티 이름은 그림 이름과 꼴이 같아(`mal2m08w1s3_bg`) 실제로 로티 자리에 있는 것만 고른다(`sharepick.ts`)
 *
 * 이름은 `plansound.ts` 의 `norm` 을 거친 것을 받는다(폭 없는 글자를 뗀 것). Electron 을 import 하지 않는다(services 규칙).
 */

/** 누적 주 — 호(M)마다 4주라 M08 W2 는 30. 소리 번호와 공유 폴더의 애니메이션 · 영상 폴더(`W30`)가 같은 수를 쓴다 */
export const weekNo = (month: number, week: number): number => (month - 1) * 4 + week

type Cell = { level: number; k: number }

const cellOf = (code: string): Cell | null => {
  const m = /^[A-Z]{2}L(\d)M(\d\d)W(\d)S\d$/.exec(code)
  return m ? { level: Number(m[1]), k: weekNo(Number(m[2]), Number(m[3])) } : null
}

/** 소리 이름이 처음 만들어진 학습코드 — `SL_ko_206_s2_nar07` 은 KOL2M02W2S2. 공용(com …)은 null */
export function homeOf(name: string): string | null {
  const m = /^SL_(ma|ko)_(\d)(\d\d)_s(\d)_/i.exec(name)
  if (!m || Number(m[3]) < 1) return null
  const month = Math.ceil(Number(m[3]) / 4)
  return `${m[1].toUpperCase()}L${m[2]}M${String(month).padStart(2, '0')}W${Number(m[3]) - (month - 1) * 4}S${m[4]}`
}

/**
 * 로티 이름 앞머리의 학습코드 — 9호 꼴 `mal2m08w1s3_…`, 옛 꼴 `Ko_L3_M02_W1_S3_…` · `Ma_L1_M7_W4_S3_…`(M 한 자리).
 * 2026-10-23(K2) — 국어 옛 호의 두 자리 꼴 `Kor_L01_M01_W01_S01_…` · `Ko_L01_M02_W1_S2_…` 와 S 뒤 점 `Ko_L1_M01_W1_S1._…` 도 읽는다.
 * 그 꼴 로티 165개 / 9 학습코드가 이름 주인 자리에 같은 이름 · 같은 바이트로 있었다. L · W · S 는 숫자로 읽어 앞 0 을 뗀다
 */
const LOTTIE_HEAD = '(ma|kor?|en)[-_]?l(\\d{1,2})[-_]?m(\\d{1,2})[-_]?w(\\d{1,2})[-_]?s(\\d{1,2})[._-]'
export function lottieHome(name: string): string | null {
  const m = new RegExp(`^${LOTTIE_HEAD}`, 'i').exec(name)
  if (!m) return null
  const [l, month, w, s] = [m[2], m[3], m[4], m[5]].map(Number)
  if (l < 1 || l > 9 || month < 1 || w < 1 || w > 4 || s < 1 || s > 9) return null
  return `${m[1].slice(0, 2).toUpperCase()}L${l}M${String(month).padStart(2, '0')}W${w}S${s}`
}

/** 다른 학습코드 소리 이름을 받나 — `tagged` 는 이름 뒤에 「기존 · 재사용」이 적혔나 */
export function soundReuse(home: string, code: string, tagged: boolean): boolean {
  const h = cellOf(home)
  const c = cellOf(code)
  return Boolean(h && c && home !== code && h.k <= c.k && (tagged || h.level === c.level))
}

/** 기획서 글의 로티 이름 — 앞머리는 `lottieHome` 꼴, 뒤는 확장자 앞까지(점은 S 바로 뒤에만) */
const LOTTIE = new RegExp(`(?<![A-Za-z0-9_])(${LOTTIE_HEAD.replace(/\((?!\?)/g, '(?:')}[A-Za-z0-9_-]*[A-Za-z0-9])`, 'gi')

/** 기획서 글에 적힌 다른 학습코드 로티 후보 — 이 학습코드보다 늦은 주는 뺀다. 소문자로 */
export function planLotties(text: string, code: string): string[] {
  const c = cellOf(code)
  if (!c) return []
  const out = new Set<string>()
  for (const m of text.matchAll(LOTTIE)) {
    const name = m[1].toLowerCase()
    const home = lottieHome(name)
    const h = home ? cellOf(home) : null
    if (home && home !== code && h && h.k <= c.k) out.add(name)
  }
  return [...out].sort()
}
