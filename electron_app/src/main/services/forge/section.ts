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
 * MA 기획서 1쪽 글의 학습코드 — `(MA-L2-M08-W1-S1)` → `MAL2M08W1S1`. 없으면 null.
 * 진행판에 놓을 때 가르기(`sortpaper.ts`)와 작업대 · 대화 시작의 「다른 학습코드 기획서」 막기(`shot.ts`)가 같이 쓴다
 */
export function planCode(text: string): string | null {
  const m = /\(\s*MA-L(\d)-M(\d\d)-W(\d)-S(\d)\s*\)/i.exec(text)
  return m ? `MAL${m[1]}M${m[2]}W${m[3]}S${m[4]}` : null
}

/**
 * 국어 「개발자 전달」 기획서의 학습코드 — 1쪽 머리 `Lv3_08호 S3(읽기)` 와 파일 이름 `한글스파크_Lv3_9호(M08)_1주_…` 를 같이 읽는다(2026-10-26).
 * 1쪽에는 주가 없고 호는 M 번호(`08호` = M08)다. 레벨 · M 번호가 1쪽과 파일 이름에서 다르거나 주가 없으면 null — 짐작하지 않는다.
 * 본보기는 9호 KOL3M08W1S3 한 장뿐이다. 공유 폴더의 국어 상세기획서는 여러 호를 묶은 pptx 라 학습코드가 없다.
 * 진행판에 놓을 때 가르기(`sortpaper.ts`)만 쓴다 — 작업대의 「다른 학습코드 기획서」 막기는 파일 이름을 안 받는다
 */
export function koPlanCode(text: string, fileName: string): string | null {
  const head = /Lv\s*(\d)\s*_\s*(\d{1,2})\s*호\s*S\s*(\d)/.exec(text.slice(0, 300))
  const file = /Lv(\d)_\d{1,2}호\(M(\d\d)\)_(\d)주/i.exec(fileName)
  if (!head || !file || head[1] !== file[1] || Number(head[2]) !== Number(file[2])) return null
  return `KOL${file[1]}M${file[2]}W${file[3]}S${head[3]}`
}

/**
 * 기획서 1쪽이 말하는 주인 학습코드 — `planCode` 꼴(괄호)이 먼저, 없으면 괄호 없이 적은 것(`모듈 ID  MA-L1-M08-W2-S1`, 국어 `KO-L1-…`).
 * 기획서 모듈넘버를 배치표와 견줄 때(`layoutfill.ts` · `planmodule.ts`)만 쓴다 — 9호 「개발자 전달」 기획서는 괄호 없이 적어,
 * MAL1M08W3S3 폴더에 잘못 든 W2S1 기획서(M30_1)를 못 가렸다(2026-10-14).
 * 진행판 가르기 · 대화 시작 막기는 그대로 `planCode`(괄호만)다 — 넓히면 그 둘의 동작이 바뀐다
 */
export function pageOwner(text: string): string | null {
  const strict = planCode(text)
  if (strict) return strict
  const m = /(?<![A-Za-z0-9])(MA|KO)-L(\d)-M(\d\d)-W(\d)-S(\d)(?![0-9])/.exec(text)
  return m ? `${m[1]}L${m[2]}M${m[3]}W${m[4]}S${m[5]}` : null
}

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
 * 영어가 아닌 과목 표시 — 한글 과목 이름이나 **대문자 KO · MA · NU 한 덩어리만** (2026-10-21). 두 글자를 대소문자 없이 보면
 * `Number` · `Menu` 의 nu, `Make` · `Mascot` 의 ma, `Kong` 의 ko 에도 걸려 영어 프레임을 막는다(누리를 더할 때 짚혔고 KO · MA 도 같은 날 고쳤다).
 * 앞은 영문자가 아니고(`MENU` 아님), 뒤는 학습코드의 `L<숫자>`(`MAL1M08…` · `KOL1…`)이거나 영문자가 아니어야 한다(`MA` · `MA 1호` · `MA2` · `KO-L1-…` · `NU_`).
 * 2026-10-23 에 뒤를 영문자 전부로 막았다 — 10-21 판은 뒤가 소문자만 아니면 걸어 `MAKE` · `MAP` · `NUMBER` · `KOREA` 처럼 대문자로 쓴 영어 낱말도 막았다.
 * 그 판이 일부러 막던 대문자 과목 이름(`MATH` · `KOREAN` · `NURI`)은 낱말째 따로 둔다. 뒤의 숫자는 그대로 막는다 — 숫자까지 놓으면 `MA2` 가 영어 학습코드로 간다.
 * `KOR`(국어 로티 이름의 `Kor_` 를 대문자로 쓴 것)도 10-21 판이 막던 것이라 따로 둔다 — 뒤가 영문자가 아닐 때만(`KOREA` 는 영어 낱말이다)
 */
const OTHER_SUBJECT = /국어|수학|누리|(?<![A-Za-z])(?:(?:KO|MA|NU)(?:L\d|(?![A-Za-z]))|(?:MATH|KOREAN|NURI)(?![a-z])|KOR(?![A-Za-z]))/

/**
 * **거꾸로 — figma 프레임 이름에서 학습코드** (2026-09-29, M5). figma 에서 파일로 내보낸 PNG 는 프레임 이름을 달고 온다.
 * 섹션 이름과 같은 짜임이라(위 `figmaSpot` 의 세 예) 같은 표를 뒤집는다.
 *
 * - 프레임 이름 꼴이 아니면 null — 부르는 쪽이 여느 파일로 다룬다
 * - 꼴은 맞는데 학습코드까지 못 가면 `why` — **활동 이름 표는 영어만 맞춰 봤다.** 국어 · 수학은 섹션 이름에
 *   S 번호가 없어 짐작하지 않고 묻는다(저장소 규칙 6). 누리(2026-10-21)는 프레임 이름을 본 적이 없다 — 영어 활동 이름과 겹쳐
 *   영어 학습코드로 가지 않게 같이 막는다. 그래서 글도 「S 가 없다」가 아니라 「영어만 안다」로 적는다
 */
export function frameCode(name: string): { code: string } | { why: string } | null {
  const m = FRAME_NAME.exec(name)
  if (!m) return null
  const head = name.slice(0, m.index)
  if (OTHER_SUBJECT.test(head)) {
    return { why: '영어 프레임 이름만 학습코드로 바꿀 수 있습니다. 파일 이름 앞에 학습코드를 붙이세요.' }
  }
  const act = m[4].replace(/\(\s*\d+\s*\)\s*$/, '').trim().toLowerCase()
  for (const [session, names] of Object.entries(ACTS)) {
    if (names.some((n) => n.toLowerCase() === act)) {
      return { code: `ENL${m[2]}M${m[1].padStart(2, '0')}W${m[3]}S${session}` }
    }
  }
  return { why: `프레임 이름의 활동 「${m[4].trim()}」을 활동 목록에서 찾지 못했습니다. 파일 이름 앞에 학습코드를 붙이세요.` }
}
