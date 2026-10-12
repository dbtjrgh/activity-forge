/**
 * **학습코드 → figma 에서 찍을 자리.** 바깥과 안 닿는다 — 글자만 본다.
 *
 * 차례를 정하려면 figma 화면 한 장이 있어야 하는데(`order.ts`), 지금 카드는
 * 「캡처해서 붙여넣어 주세요」까지만 말한다. **어디를 찍어야 하는지는 말해
 * 주지 않는다** — 한 호가 36차시면 사람이 36번 섹션을 찾아 헤맨다.
 * 그것을 한 줄로 줄이는 것이 이 파일의 전부다.
 *
 * **거꾸로 가는 표다.** 2026-09-16 에 걷어낸 `figma/name.ts` 가 섹션 이름을
 * 읽어 학습코드로 옮겼고(8호 영어 36개 중 31개), 여기서는 그 표를 뒤집어
 * 학습코드에서 섹션 이름을 그린다. **읽는 쪽은 API 를 불렀지만 이쪽은 안
 * 부른다** — 사람에게 보여 줄 글자를 만들 뿐이다.
 *
 * **영어 말고는 활동 이름을 모른다.** 그 표는 8호 영어 섹션으로만 맞춰 봤다.
 * 국어·수학은 활동 이름을 짐작하지 않고 **페이지와 주차까지만** 말한다
 * (저장소 CLAUDE.md 6번 — 모르면 `null`, 짐작을 확정처럼 보여주지 않는다).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

/** 활동 이름이 곧 S 번호다. `figma/name.ts` 의 SESSION 을 뒤집은 것 — 영어에서만 맞춰 봤다. */
const ACTS: Record<number, string[]> = {
  1: ['Word Explorer', 'Read Together', 'Sing Along', 'Say Aloud'],
  2: ['Story Movie', 'Story Check', 'Word Adventure', 'Write Now'],
  3: ['Word Play', 'My Mini Book', 'Sentence Fun']
}

/** 페이지 이름 앞머리가 과목이다 (`영어_7호_Lv1`). */
const SUBJECT: Record<string, string> = { EN: '영어', KO: '국어', MA: '수학' }

/** 활동 이름 표를 맞춰 본 과목. 나머지는 활동 이름을 말하지 않는다. */
const ACTS_KNOWN = new Set(['EN'])

export type Study = { subject: string; level: number; month: number; week: number; session: number }

/**
 * figma 에서 찾아갈 자리를 사람 말로 한 줄.
 *
 * **화면이 이 글을 그대로 글자로 찍는다** — 별표를 넣으면 별표가 보인다
 * (저장소 CLAUDE.md). 강조가 필요하면 화면 쪽 JSX 에서 한다.
 *
 * 못 그리면 빈 글이다. 부르는 쪽이 그때는 이 줄을 아예 안 붙인다.
 */
export function figmaSpot(study: Study | null): string {
  if (!study) return ''
  const subject = SUBJECT[study.subject]
  if (!subject) return ''

  // figma 는 학습코드의 `M07` 을 `7호` 라고 부른다. 앞의 0 을 뗀다.
  const page = `${subject}_${study.month}호_Lv${study.level}`
  const section = `${study.month}호 … Lv${study.level} … ${study.week}주`

  const head = `figma 에서 ${page} 페이지의 ${section} 섹션입니다.`
  // **이름이 제각각이라 그대로 못 적는다** — 같은 파일에 `7호_lv1_1주_Word Play`
  // 와 `7호 Lv1 3주_Word Adventure (0818)` 와 `7호_Lv1_1주차_Story Movie (0812)`
  // 가 같이 있다. 밑줄·띄어쓰기·`주/주차`·뒤에 붙는 날짜가 다 다르다.
  const loose = '밑줄과 띄어쓰기는 섹션마다 다르니 그 부분은 흘려 보세요.'

  const acts = ACTS_KNOWN.has(study.subject) ? ACTS[study.session] : undefined
  if (!acts || !acts.length) return `${head} ${loose}`

  // 활동 이름이 곧 S 번호라, 같은 주차에서 이 몇 개 중 하나가 이 차시다.
  return `${head} 섹션 이름 끝의 활동 이름은 ${acts.join(' · ')} 가운데 하나입니다. ${loose}`
}

/** `7호_lv1_1주_Word Play` · `7호 Lv1 3주_Word Adventure (0818)` · `7호_Lv1_1주차_Story Movie (0812)` */
const FRAME_NAME = /(\d{1,2})\s*호[\s_]*lv\.?\s*(\d)[\s_]*(\d)\s*주(?:차)?[\s_]*(.*)$/i

/**
 * **거꾸로 — figma 프레임 이름에서 학습코드** (2026-09-29, M5). figma 에서 파일로 내보낸 PNG 는 프레임 이름을 달고 온다.
 * 섹션 이름과 같은 짜임이라(위 `figmaSpot` 의 세 예) 같은 표를 뒤집는다.
 *
 * - 프레임 이름 꼴이 아니면 null — 부르는 쪽이 여느 파일로 다룬다
 * - 꼴은 맞는데 학습코드까지 못 가면 `why` — **활동 이름 표는 영어만 맞춰 봤다.** 국어 · 수학은 섹션 이름에
 *   S 번호가 없어 짐작하지 않고 묻는다(저장소 규칙 6)
 */
export function frameCode(name: string): { code: string } | { why: string } | null {
  const m = FRAME_NAME.exec(name)
  if (!m) return null
  if (/국어|수학|KO|MA/i.test(name.slice(0, m.index))) {
    return { why: '국어와 수학 프레임 이름에는 몇 번째 활동(S)인지가 없어 학습코드를 알 수 없습니다. 파일 이름 앞에 학습코드를 붙이세요.' }
  }
  const act = m[4].replace(/\(\s*\d+\s*\)\s*$/, '').trim().toLowerCase()
  for (const [session, names] of Object.entries(ACTS)) {
    if (names.some((n) => n.toLowerCase() === act)) {
      return { code: `ENL${m[2]}M${m[1].padStart(2, '0')}W${m[3]}S${session}` }
    }
  }
  return { why: `프레임 이름의 활동 「${m[4].trim()}」을 활동 목록에서 찾지 못했습니다. 파일 이름 앞에 학습코드를 붙이세요.` }
}
