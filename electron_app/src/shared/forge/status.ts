/**
 * **상태 일곱과 단추 이름 — 한 표** (2026-09-28, `_document/양산판.md` M2).
 *
 * 메인과 렌더러가 같이 쓴다. 같은 말을 화면마다 따로 적으면 「만들었음」·「양산」·「만들기」가
 * 한 화면 안에서 다른 뜻으로 섞인다(09-28 까지 그랬다).
 *
 * 2026-09-29 이름을 다시 골랐다(사용자 말 — 「끝 말고 어울리는 걸로 · 다른 것도 다 명칭 제대로」).
 * **한 낱말에 한 뜻** — 「끝」 하나가 호 저장소의 개발 완료 · 사람이 누르는 단추 · 차례 줄의 한 판이 끝남, 셋을 같이 뜻했다.
 * 이제 흐름이 이름에 보인다: 생성 대기 → 생성 중 → (답변 필요) → 검수 대기 → 「검수 완료」 → 개발 완료.
 *
 * **「개발 완료」는 사람이 누른 것뿐이다** — 호 저장소 `activityInfo.json` 의 `devFinished`.
 * 질문이 0 이어도 완료가 아니다: 9호에는 견줄 완성본이 없어 조용히 틀릴 수 있다.
 *
 * 2026-10-01 「모듈 없음」을 「입력 필요」에서 뗐다(사용자 말 — 색으로 구별). 스펙이 없는 모듈은
 * 만드는 사람이 채울 입력이 없다 — 스펙을 만드는 사람의 일이다.
 */

import type { BoardRow } from './board'

export type Status = '모듈 없음' | '입력 필요' | '생성 대기' | '생성 중' | '답변 필요' | '검수 대기' | '개발 완료'

/** 진행판 차례 · 색 이름. 앞일수록 사람 손이 먼저 가야 하는 것이다 */
export const STATUSES: { status: Status; tone: string }[] = [
  { status: '모듈 없음', tone: 'nomod' },
  { status: '입력 필요', tone: 'need' },
  { status: '답변 필요', tone: 'ask' },
  { status: '생성 대기', tone: 'ready' },
  { status: '생성 중', tone: 'busy' },
  { status: '검수 대기', tone: 'view' },
  { status: '개발 완료', tone: 'done' }
]

export const toneOf = (s: Status): string => STATUSES.find((x) => x.status === s)?.tone ?? 'need'

/** 단추 이름. **「확인」은 질문을 닫을 때만** — 학습코드를 마치는 단추는 `done` 이다 */
export const BUTTON = {
  make: '생성',
  again: '다시 생성',
  writeView: '저장소에 반영',
  rewrite: '저장소에 다시 반영',
  done: '검수 완료',
  commit: '양산 완료 커밋',
  /** 진행판 맨 위 — 학습코드마다 있던 「main에 올리기」를 모았다(2026-10-14). 작업대 검수 칸이 이 이름을 안내한다 */
  mainAll: 'main 에 모두 올리기',
  seen: '확인',
  // 아래는 둘러보기(`lib/tour.ts`)가 글로 안내하는 단추 — 단추와 안내 글이 같은 이름을 쓰게 여기 둔다(2026-10-16)
  chat: '대화로 생성',
  /** 이 PC 에서 대화를 시작한 적이 있으면(`chat.json` 의 state 가 idle 이 아님) 「대화로 생성」 대신 */
  chatAgain: '처음부터 다시 만들기',
  /** 이미 개발 완료로 커밋한 내 학습코드면 「양산 완료 커밋」 대신 */
  fixCommit: '수정사항 커밋',
  guide: '받을 리소스 보기',
  preview: '미리보기',
  tour: '둘러보기'
} as const

/** 둘러보기가 이름을 부르는 화면 제목 — 제목과 안내 글이 같은 이름을 쓰게 */
export const TITLE = {
  now: '지금 바로 할 수 있는 학습코드',
  settings: '설정'
} as const

/**
 * 진행판 칸 하나의 상태와 **다음 할 일 한 마디.**
 * 모르는 것은 모른다고 — 형편을 못 읽은 칸(`work` 없음)은 배치표 단계만으로 가른다.
 * `row.stage` 는 forge `layout` 이 내는 글이라 **여기서 바꾸지 않는다**(forge 쪽 이름).
 */
export function statusOf(row: BoardRow): { status: Status; next: string } {
  const w = row.work
  const chat = w?.chat?.state
  // 도는 중이 먼저다 — 완료된 학습코드를 다시 만들 때도 지금 도는 것이 사실이다. 시작한 때는 대화가 든다(`chatstore.ts`)
  if (w?.running != null) return { status: '생성 중', next: `${Math.max(1, Math.round(w.running / 60000))}분째` }
  // 대화가 사람을 기다리는 것도 같은 까닭으로 개발 완료보다 먼저다 (2026-10-08) — 완료된 학습코드를 「처음부터 다시 만들기」로
  // 다시 만들다 질문이 오면, 칸이 「개발 완료」로 남아 「질문 답변」 목록에서 빠졌다(작업대는 검수 완료를 막고 있다).
  // `chat` 은 대화 id 가 있을 때만 온다(`boardwork.ts`). 이전 방식의 남은 카드 수(`run.json`)는 이제 안 본다. 앱에서 걷었다
  if (chat === 'asking') return { status: '답변 필요', next: w?.chat?.questions ? `질문 ${w.chat.questions}` : '질문 답변' }
  if (chat === 'stopped') return { status: '답변 필요', next: '대화 멈춤' }
  if (chat === 'error') return { status: '답변 필요', next: '대화 오류' }
  if (w?.finished) return { status: '개발 완료', next: '' }
  if (row.stage === '모듈 못 정함') return { status: '입력 필요', next: '모듈 선택' }
  if (row.stage === '스펙 먼저') return { status: '모듈 없음', next: '스펙 필요' }
  if (row.stage === '리소스 대기') return { status: '입력 필요', next: '리소스 넣기' }
  // 들어왔지만 기획서에 적힌 소리가 없으면 그것이 먼저다 — 작업대 순서 막대(`lib/benchorder.ts`)와 같은 차례 · 같은 셈(`rsccount.ts`).
  // 원본과 개수를 견주던 「리소스 n개 부족」은 다 넣은 완성본에도 절반이 떴다(2026-10-14)
  if (w?.rscGap) return { status: '입력 필요', next: `소리 ${w.rscGap}개 없음` }
  // 대화로 다 만든 것은 화면을 다시 묻지 않는다 — 이미 그 입력으로 만들었다
  if (w?.needsShot && w.shots === 0 && chat !== 'done') return { status: '입력 필요', next: '화면 붙이기' }
  if (chat === 'done' || row.stage === '만들었음') return { status: '검수 대기', next: '미리보기' }
  return { status: '생성 대기', next: BUTTON.make }
}

/**
 * **figma 화면을 지금 붙일 수 있는 칸** — 진행판 「지금 바로 할 수 있는 학습코드」가 쓴다 (2026-10-01). 같이 쓰던 「화면 연속 붙여넣기」는 2026-10-14 에 걷었다.
 * 다음 할 일이 「소리 n개 없음」인 칸도 넣는다 — 캡처는 리소스와 상관없이 지금 할 수 있다. 둘이 따로 세면 한 화면에서 「없다」와 「2개」가 같이 뜬다
 */
export function wantsShot(row: BoardRow): boolean {
  const w = row.work
  if (statusOf(row).next === '화면 붙이기') return true
  return Boolean(w?.rscGap && w.needsShot && w.shots === 0 && w.running === null && w.chat?.state !== 'done')
}
