/**
 * **둘러보기의 단계 표** (2026-10-16, 계획 P6) — 처음 설정 뒤 한 번 진행판 → 작업대 → 대화 → 검수 → 커밋 → main 올리기를 짚는다.
 *
 * 여기는 **화면 · 칸 id · 글만** 둔다. 차례 · 화면 바꾸기는 `components/tour/useTour.ts`, 막 · 안내 상자 · 막는 빗장은 `Tour.tsx`.
 * 둘러보기는 Claude 를 부르지 않고, 커밋 · 푸시 · 정션 변경 · 미리보기를 하지 않는다 — 그래서 이 파일과 그 둘에는 `window.api` 가 없다.
 * 단추 이름은 `shared/forge/status.ts` 의 `BUTTON` 을 그대로 끼워 넣는다(이름이 바뀌면 글도 같이 바뀐다).
 *
 * 본 적 있음은 이 PC 의 localStorage 에만 둔다 — 사람마다 · PC 마다의 편의라 settings.json · .user.json 에는 넣지 않는다.
 */

import { BUTTON, TITLE } from '../../../shared/forge'
import { TARGET, TOUR_ANCHOR } from './anchors'

/** 단계 표의 판 번호 — 단계를 크게 바꾸면 올린다. `tourSeen` 에 이 번호를 남긴다 */
export const TOUR_REV = 1

/** 어느 화면에서 보이나 — `bench` 는 작업대(열 학습코드가 없으면 글로만) */
export type TourScreen = 'board' | 'bench'

export interface TourStep {
  screen: TourScreen
  /** 짚을 칸 id — 없으면 가운데에 글만 */
  anchor?: string
  title: string
  /** 「~합니다 / ~하세요」 짧은 한두 문장. 함수면 작업대에 연 학습코드의 호 이름(`hoLabel`, 못 열었으면 null)을 받는다 */
  text: string | ((ho: string | null) => string)
  /** 칸이 없으면 「없습니다」 글 없이 건너뛴다(지금 바로 할 수 있는 학습코드는 다 끝난 호에서 안 그려진다) */
  optional?: boolean
}

const WAIT_MS = 5_000
/**
 * 작업대 단계 — 작업대를 열면 학습코드 읽기(forgePrepare)가 10초 넘게 걸리기도 한다.
 * 진행판으로 갔다가 ← 로 돌아와도 작업대를 다시 열므로 작업대 단계는 모두 이만큼 기다린다(기다리는 동안에도 넘길 수 있다)
 */
const BENCH_MS = 15_000
/** 칸이 없으면 건너뛰는 단계는 오래 안 기다린다 — 진행판은 앞 단계에서 이미 읽었다 */
const OPTIONAL_MS = 1_200
/**
 * 작업대가 다 읽힌 뒤(순서 막대가 보인 뒤) 칸을 더 기다리는 시간 — 대화 칸 둘은 forgeChatGet 한 번만큼 늦게 그려진다.
 * 지난 호 완성본처럼 그 칸이 끝내 안 그려지는 작업대에서 단계마다 15초씩 「불러오는 중」을 보이지 않게
 */
export const BENCH_LOADED_MS = 3_000

export const waitOf = (s: TourStep): number => (s.optional ? OPTIONAL_MS : s.screen === 'bench' ? BENCH_MS : WAIT_MS)

export const textOf = (s: TourStep, ho: string | null): string => (typeof s.text === 'function' ? s.text(ho) : s.text)

export const TOUR_STEPS: TourStep[] = [
  // 막은 이 창에만 걸린다 — 따로 뜬 받을 리소스 창 · 미리보기 창은 parent 가 없는 다른 창이라 그대로 눌리고 소리도 난다
  { screen: 'board', title: BUTTON.tour, text: '둘러보는 동안에는 아무것도 만들거나 올리지 않습니다. 받을 리소스 창과 미리보기 창은 닫고 보세요.' },
  { screen: 'board', anchor: TOUR_ANCHOR.sideBoards, title: '호 목록', text: '누르면 그 호의 진행판이 열립니다.' },
  { screen: 'board', anchor: TOUR_ANCHOR.boardTiles, title: '학습코드', text: '색이 상태를 나타냅니다. 누르면 작업대가 열립니다.' },
  { screen: 'board', anchor: TOUR_ANCHOR.boardDrop, title: '기획서 놓는 칸', text: '기획서 PDF를 놓으면 1쪽을 읽어 학습코드마다 나눠 넣습니다. 리소스와 figma 화면은 작업대에 넣습니다.' },
  { screen: 'board', anchor: TOUR_ANCHOR.boardNow, optional: true, title: TITLE.now, text: '지금 할 수 있는 학습코드를 모아 보여 줍니다.' },
  { screen: 'bench', anchor: TOUR_ANCHOR.benchOrder, title: '작업 순서 막대', text: '지금 할 단계를 강조합니다. 누르면 그 영역으로 이동합니다.' },
  { screen: 'bench', anchor: TARGET.need, title: '리소스', text: `기획서에 적혔는데 없는 소리를 보여 줍니다. 「${BUTTON.guide}」를 누르면 figma 옆에 띄울 창이 열립니다.` },
  { screen: 'bench', anchor: TARGET.shot, title: 'figma 화면', text: 'figma 화면을 Ctrl+V 로 붙입니다. 붙인 순서가 이닝 순서입니다.' },
  // 단추 이름은 개발 완료인지가 아니라 이 PC 에 대화 기록(chat.json)이 있는지로 갈린다(`ChatFlow.tsx`) — _recipe 는 PC 마다 따로다
  { screen: 'bench', anchor: TARGET.chat, title: BUTTON.chat, text: `누르면 Claude 가 만들기 시작하고 사용 금액이 나갑니다. 이 PC 에서 대화한 적이 있으면 「${BUTTON.chatAgain}」로 보입니다.` },
  { screen: 'bench', anchor: TARGET.answer, title: '답 입력란', text: 'Claude 가 물으면 여기에 답합니다. 그림은 Ctrl+V 로 붙입니다.' },
  // 연결 단추 이름은 `ViewPanel.tsx` 와 같은 꼴 — 「9호(M14)로 연결」
  { screen: 'bench', anchor: TOUR_ANCHOR.benchView, title: BUTTON.preview, text: (ho) => `만든 액티비티를 띄워 확인합니다. ${ho ? `「${ho}로 연결」을` : '호 연결 단추를'} 누르면 다른 호의 연결은 해제됩니다.` },
  { screen: 'bench', anchor: TOUR_ANCHOR.benchCheck, title: BUTTON.done, text: '미리보기로 확인한 뒤 누르면 개발 완료가 됩니다.' },
  // 「수정사항 커밋」은 내가 개발 완료로 커밋한 학습코드에서만이다(`DoneCard.tsx` 의 committed) — 남이 끝낸 것은 그대로다
  { screen: 'bench', anchor: TOUR_ANCHOR.benchCommit, title: BUTTON.commit, text: `이 학습코드만 커밋해 올립니다. 내가 개발 완료로 커밋한 학습코드에서는 「${BUTTON.fixCommit}」으로 보입니다.` },
  { screen: 'board', anchor: TOUR_ANCHOR.boardSync, title: BUTTON.mainAll, text: '올릴 목록을 먼저 보여 주고, 한 번 더 눌러야 올립니다.' },
  { screen: 'board', anchor: TOUR_ANCHOR.sideSettings, title: TITLE.settings, text: '작업 폴더, 리소스 폴더, 이름과 팀을 여기서 바꿉니다.' },
  { screen: 'board', anchor: TOUR_ANCHOR.sideTour, title: BUTTON.tour, text: '이 단추로 언제든 다시 볼 수 있습니다.' }
]

/** 작업대를 열 학습코드가 없을 때 작업대 단계에 붙이는 한 줄 — `benchCode` 는 지금 보이는 진행판 한 과목만 본다 */
export const NO_BENCH = '개발 완료인 학습코드가 이 진행판에 없어 글로만 보여 줍니다.'
/** 수학 진행판 — 작업대를 열지 않는다(계획 P6, 영어 · 국어만) */
export const NO_BENCH_MA = '수학 진행판에서는 작업대를 열지 않아 글로만 보여 줍니다.'
/** 작업대 단계에 왔는데 진행판을 아직 못 읽었다 — 결과가 오면 그때 고른다(`useTour.ts`) */
export const NO_BOARD = '진행판을 아직 읽지 못해 글로만 보여 줍니다.'
/** 후보를 다 열어 봐도 대화 칸이 안 그려졌다 — 배치표가 원본을 못 고른 개발 완료 칸은 보기만 연다(`tourbench.ts`) */
export const NO_BENCH_OPEN = '작업대에서 대화까지 열리는 개발 완료 학습코드가 이 진행판에 없어 글로만 보여 줍니다.'
/** 칸을 기다렸는데 안 생겼을 때 */
export const MISSING = '이 화면에는 지금 없습니다.'

const SEEN_KEY = 'tourSeen'
const PENDING_KEY = 'tourPending'

/** 처음 설정 「마치기」가 성공하면 남긴다 — 다음에 앱 화면이 뜨면 한 번 저절로 시작한다 */
export function markTourPending(): void {
  try {
    localStorage.setItem(PENDING_KEY, '1')
  } catch {
    // 못 남기면 저절로 안 뜰 뿐이다 — 옆줄 「둘러보기」로 볼 수 있다
  }
}

/** 저절로 시작할까 — 표시가 있으면 지운다(한 번뿐). 이 판을 이미 봤으면 시작하지 않는다(처음 설정을 다시 했을 때) */
export function takeTourPending(): boolean {
  try {
    if (localStorage.getItem(PENDING_KEY) === null) return false
    localStorage.removeItem(PENDING_KEY)
    return localStorage.getItem(SEEN_KEY) !== String(TOUR_REV)
  } catch {
    return false
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, String(TOUR_REV))
  } catch {
    // 못 남겨도 그만이다 — 저절로 시작하는 것은 tourPending 이 있을 때뿐이다
  }
}
