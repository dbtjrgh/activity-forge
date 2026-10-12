/**
 * **대화로 만들기의 글** — 첫 지시 · 사람의 답 · 앱 검사 결과를 Claude 에게 건네는 글과, 받은 답 읽기 (2026-10-08).
 *
 * 규칙은 8호(M07) 대화를 조사해 넣었다(`_document/자동양산.md` 「틀」 10-08). 그때 사람이 짜증 낸 것이 곧 규칙이다 —
 * 시키지 않은 판단(「왜 니 멋대로」), 넣은 것을 못 찾음(「기획서 제대로 본거 맞니?」), 이름만 보고 짐작, 오래 걸리면 그냥 물어볼 것.
 *
 * **끝맺음 약속** — 차례마다 `<<<양산>>>` … `<<<끝>>>` 사이에 JSON 한 덩어리로 끝낸다. 질문(`ask`)이면 앱이 질문 칸에 띄우고,
 * 완료(`done`)면 앱이 리소스를 복사하고 타입 검사를 돌린다. 덩어리가 없으면 그 글 전체를 질문으로 보인다(사람이 글로 답한다).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import type { ChatChecks, ChatQuestion } from '../../../shared/forge'
import type { ChatCtx } from './chatprep'

const OPEN = '<<<양산>>>'
const CLOSE = '<<<끝>>>'

export type ChatFile = { to: string; from: string }
/** `unread` — 끝 덩어리가 있는데 읽지 못했다(또는 받은 글이 비었다). 앱이 그렇다고 한 줄 남긴다 */
export type ChatReply =
  | { kind: 'ask'; say: string; questions: ChatQuestion[]; unread?: boolean }
  | { kind: 'done'; say: string; files: ChatFile[]; check: string[] }

const list = (xs: string[]): string => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- (없음)')

export function firstBrief(c: ChatCtx): string {
  const rel = (p: string): string => p.split(path.sep).join('/')
  return [
    `스파크온 액티비티 ${c.code} 를 만든다. 모듈은 ${c.module} 이다.`,
    '일하는 동안 쓰는 글(무엇을 읽고 무엇을 하는지)도 한국어로 짧게 쓴다 — 사람이 진행 줄로 본다.',
    '너는 이 학습코드의 호 저장소 폴더 안에서 일한다. 지금 작업 폴더가 그 폴더이고, 쓸 수 있는 곳은 여기뿐이다.',
    '',
    '## 폴더',
    `- 작업 폴더(쓰기): ${rel(c.act)} — 지금은 빈 뼈대다. GameData.ts · AssetTable.ts · Activity.ts 를 쓴다`,
    `- 리소스 폴더(읽기): ${rel(c.rsc)} — 사람이 넣은 그림 · 소리 · 로티. _figma 는 figma 화면, _plan 은 기획서`,
    `- 원본 완성본(읽기, 앱이 추천): ${c.origin.code} — 코드 ${rel(c.origin.act)} · 리소스 ${rel(c.origin.rsc)}`,
    ...c.others.map((o) => `- 같은 모듈 다른 완성본(읽기): ${o.code} — 코드 ${rel(o.act)} · 리소스 ${rel(o.rsc)}`),
    `- 모듈 소스(읽기): ${rel(c.moduleDir)}`,
    `- 모듈 스펙(읽기): ${rel(c.specFile)} — 항목 설명 · 값 범위 · 모듈이 이름을 박아 부르는 그림(fixedAlias)`,
    '',
    '## 받은 입력',
    'figma 화면(붙인 차례 = 이닝 차례):',
    list(c.shots),
    '기획서:',
    list(c.plans),
    '앱이 앞 호에서 리소스 폴더로 가져온 파일(모든 호가 같은 파일을 쓰는 것):',
    list(c.carried),
    '',
    '리소스 표(탭 구분 — 파일, 그림 크기, 원본 같은 이름 파일과 바이트가 같은가, 원본에서 쓰던 별칭):',
    c.table,
    '',
    '## 하는 법',
    '1. 원본의 GameData.ts · AssetTable.ts · Activity.ts 와 모듈 스펙을 먼저 읽는다. 원본에서 출발한다. 새로 짓지 않는다.',
    '2. 값(낱말 · 문장 · 정답 · 소리 파일 번호)의 정본은 기획서다. 기획서를 끝까지 읽는다. 쪽이 많으면 pages 로 나눠 연다.',
    '   기획서도 틀릴 수 있다. 앞뒤가 안 맞는 값(그 이닝 낱말과 다른 주어, 어긋난 번호 같은 것)은 그대로 넣지 말고 ask 로 바로 묻는다.',
    '   기획서대로 두는 답과 고친 값을 고를 답으로 두고, 그 소리 파일 이름도 질문에 적는다(녹음이 기획서와 같으면 의도일 수 있다). 끝 보고 check 에만 적고 넘어가지 않는다.',
    '3. 자리(좌표 · 배치)의 정본은 figma 화면이다. 화면을 모두 열어 본다. 이닝 차례는 figma 화면을 붙인 차례다.',
    '   figma 가 없는 이닝의 글자 조각(자모) 간격은 다른 이닝 간격을 옮겨 쓰지 않는다. 옆으로 놓인 글자(틱)와 위아래로 쌓은 글자(폼)는 간격이 다르다.',
    '   종이에 이미 찍힌 같은 짜임의 글자(위아래로 쌓은 글자, 받침 글자)를 열어 보고 그 간격을 따른다. 어림한 자리는 끝 보고 check 에 적는다.',
    '4. 그림은 이름만 보고 짐작하지 않는다. 후보 그림은 Read 로 열어 눈으로 본다. 소리는 기획서 대본의 파일 이름과 번호로 맞춘다.',
    '5. 이번 회차 내용(낱말 그림 · 책 · 스티커 · 대사처럼 회차마다 바뀌는 것)은 리소스 폴더의 파일에서 고른다. 그림을 편집하지 않는다.',
    '   리소스 표에서 「폴더에 없음」인 자리 가운데 호마다 같은 틀(타자기 · 자판 · 배경 틀 같은 것)은 원본이나 같은 모듈 완성본의 리소스를 그대로 써도 된다.',
    '   그럴 때는 여러 완성본에서 같은 파일인지(크기 · 모양) 확인하고 쓴다. 내용이 바뀌어야 할 것 같은데 받은 파일이 없으면 묻는다.',
    '   앱이 앞 호에서 가져온 파일은 앞 호들이 다 같았다는 뜻일 뿐이다. figma 화면의 같은 틀(빈칸 상자 같은 것)과 크기나 모양이 다르면 figma 가 정본이다.',
    '   가져온 파일을 그대로 쓰지 말고, figma 와 같은 파일을 달라고 묻는다. 어느 이닝에 어느 크기가 맞는지는 획 그림이 그 틀 안에 드는지로 본다.',
    '   호 저장소에 놓일 파일은 끝 덩어리 files 에 적는다 — 앱이 복사한다.',
    '   모듈이 이름을 박아 부르는 그림(스펙 fixedAlias, 원본 AssetTable 의 「이름 고정」)은 그 이름 그대로 둔다.',
    '6. Activity.ts 는 원본 것에서 학습코드만 바꾼다. activityInfo.json · index.html · main.ts · App.vue · style.css 는 건드리지 않는다.',
    '7. 원본 · 모듈을 바꾸거나 모듈 코드를 고쳐야 할 것 같으면 하지 말고 묻는다. 시키지 않은 판단을 하지 않는다.',
    '8. 묻는 것은 기획서 · figma 로도 정할 수 없는 것, 기획서 오기로 보이는 것, 빠진 입력뿐이다. 모아서 한 번에 묻는다. 사소한 것은 원본대로 하고 끝 보고에 적는다.',
    '   figma 화면이나 기획서가 없어서 정할 수 없으면 그것부터 달라고 묻는다.',
    '   입력이 빠져 GameData.ts · AssetTable.ts 를 다 쓸 수 없으면 done 으로 끝내지 않는다. 짐작으로 채우지 말고 ask 로 묻는다.',
    '',
    '## 끝맺음 (반드시)',
    `차례를 끝낼 때마다 마지막에 ${OPEN} 와 ${CLOSE} 사이에 JSON 하나를 둔다. 사람에게 보이는 글은 한국어, 업무용 말투로 짧게 쓴다.`,
    '사람이 꼭 봐야 할 것(기획서 오기로 보이는 것, 기획서와 다르게 한 것)은 **이렇게** 굵게 쓰고 맨 앞에 둔다.',
    '질문할 때:',
    OPEN,
    '{"status":"ask","say":"지금까지 한 일 한두 줄","questions":[{"text":"질문","options":["고를 답1","고를 답2"]}]}',
    CLOSE,
    'options 는 고를 답이 있을 때만 적는다. 없으면 빈 배열이고, 사람이 글로 답한다.',
    '다 만들었을 때(GameData.ts · AssetTable.ts · Activity.ts 를 다 쓴 뒤):',
    OPEN,
    '{"status":"done","say":"만든 것 요약","files":[{"to":"images/bg.png","from":"images/Group 12.png"}],"check":["사람이 미리보기에서 볼 것"]}',
    CLOSE,
    `files 의 to 는 호 저장소 public/sparklab/${c.code}/ 안의 경로다. from 은 리소스 폴더 안의 상대 경로이고, 원본이나 같은 모듈 완성본의 리소스를 쓸 때만 그 파일의 전체 경로다.`,
    'AssetTable 이 가리키는 파일을 하나도 빠짐없이 적는다(이름이 같아도). to 의 폴더와 파일 이름은 AssetTable 의 경로 상수와 대소문자까지 같게 쓴다(로티는 animation 과 animations 가 학습코드마다 다르다).',
    'JSON 은 코드 펜스 없이 그대로 쓰고, 경로의 구분자는 / 로 쓴다.',
    '끝낸 뒤 앱이 리소스를 복사하고 타입 검사(vue-tsc)와 스펙 검사를 돌려 결과를 보낼 수 있다. 그러면 고치고 같은 꼴로 다시 끝맺는다.'
  ].join('\n')
}

/** 지난 차례 뒤 리소스 폴더에서 바뀐 것 — 앱이 알린다(`chatprep.ts` `diffInputs`) */
export type Moved = { added: string[]; gone: string[]; changed: string[] }

/** 사람의 답 — 붙인 그림은 리소스 폴더 안 경로로. figma 화면이 바뀌었으면 지금 차례 전체를 다시 준다(차례 = 이닝 차례) */
export function replyBrief(text: string, images: string[], rsc: string, moved: Moved, shots: string[]): string {
  const pics = images.map((i) => path.join(rsc, i).split(path.sep).join('/'))
  const lines = (title: string, xs: string[]): string[] => (xs.length ? ['', title, ...xs.map((a) => `- ${a}`)] : [])
  const figma = [...moved.added, ...moved.gone, ...moved.changed].some((f) => f.startsWith('_figma/'))
  return [
    '사용자의 답:',
    text.trim() || '(글 없음)',
    ...lines('사용자가 붙인 그림(Read 로 열어 본다):', pics),
    ...lines('지난 차례 뒤에 리소스 폴더에 새로 들어온 파일(앱이 알린다 — 열어 보고 반영한다. _figma 는 figma 화면, _plan 은 기획서):', moved.added),
    ...lines('지난 차례 뒤에 내용이 바뀐 파일(같은 이름 — 다시 열어 본다):', moved.changed),
    ...lines('지난 차례 뒤에 리소스 폴더에서 없어진 파일:', moved.gone),
    ...(figma ? lines('지금의 figma 화면 차례(붙인 차례 = 이닝 차례):', shots) : []),
    '',
    `이어서 진행하고, 같은 꼴(${OPEN} … ${CLOSE})로 끝맺는다.`
  ].join('\n')
}

/**
 * 앱 검사 결과 — 막는 것(타입 오류 · 다시 못 읽음 · 없는 파일 · 복사 실패)과 참고(스펙).
 * `last` 는 사람의 답에 덧붙일 때 — 세 번 고쳐도 막혀 사람에게 넘어온 결과는 Claude 가 아직 못 봤다
 */
export function fixBrief(c: ChatChecks, opts: { spec: boolean; last?: boolean }): string {
  const part = (title: string, xs: string[]): string[] => (xs.length ? [title, ...xs.slice(0, 40).map((x) => `- ${x}`), ''] : [])
  const notRun = c.tsc?.ran === false
  return [
    opts.last ? '지난번 앱 검사에서 남은 것이다(그 뒤에 고쳤으면 넘어간다).' : '앱이 검사한 결과다. 고친 뒤 같은 꼴로 다시 끝맺는다.',
    '빠진 입력(받지 못한 리소스 · figma 화면 · 기획서) 때문에 고칠 수 없는 것이면 done 으로 다시 끝내지 말고 ask 로 그 입력을 묻는다.',
    '',
    ...(notRun ? [`앱이 타입 검사를 실행하지 못했다(${c.tsc?.why ?? ''}). 파일을 다 썼으면 같은 done 끝맺음으로 다시 끝내면 앱이 다시 검사한다.`, ''] : []),
    ...part('타입 오류(반드시 고친다):', c.tsc?.errors ?? []),
    ...part('쓴 액티비티를 앱이 다시 읽지 못했다(Activity.ts 가 모듈을 import 하는지, GameData.ts · AssetTable.ts 가 있고 문법이 맞는지 본다):', c.unread ? [c.unread] : []),
    ...part('AssetTable 이 가리키는데 호 저장소에 없는 파일(files 에 빠졌거나 이름이 다르다):', c.files?.missing ?? []),
    ...part('리소스 복사 실패:', c.files?.failed ?? []),
    ...part('스펙 검사(참고 — 맞게 한 것이면 그대로 두고 끝 보고에 까닭을 적는다):', opts.spec ? (c.spec ?? []) : [])
  ].join('\n')
}

const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
const str = (x: unknown): string => (typeof x === 'string' ? x : '')

/** 덩어리의 JSON — 코드 펜스로 감쌌거나 앞뒤에 말이 붙어도 처음 `{` 부터 마지막 `}` 까지 */
function blockOf(raw: string): Record<string, unknown> | null {
  const a = raw.indexOf('{')
  const b = raw.lastIndexOf('}')
  if (a < 0 || b < a) return null
  try {
    const j: unknown = JSON.parse(raw.slice(a, b + 1))
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** 받은 글 읽기 — 마지막 덩어리. 닫는 표식이 없으면 그 뒤 전부를 덩어리로 본다. 덩어리가 없으면 글 전체를 질문으로 */
export function readReply(text: string): ChatReply {
  const at = text.lastIndexOf(OPEN)
  const before = (at >= 0 ? text.slice(0, at) : text).trim()
  if (at < 0) return { kind: 'ask', say: before, questions: [], ...(before ? {} : { unread: true }) }
  const end = text.indexOf(CLOSE, at)
  const j = blockOf(text.slice(at + OPEN.length, end >= 0 ? end : undefined))
  if (!j) return { kind: 'ask', say: text.trim(), questions: [], unread: true }
  const say = [before, str(j['say'])].filter(Boolean).join('\n\n')
  if (j['status'] === 'done') {
    const files = arr(j['files'])
      .map((f) => (f && typeof f === 'object' ? (f as Record<string, unknown>) : {}))
      .filter((f) => str(f['to']) && str(f['from']))
      .map((f) => ({ to: str(f['to']), from: str(f['from']) }))
    return { kind: 'done', say, files, check: arr(j['check']).map(String) }
  }
  const questions = arr(j['questions'])
    .map((q) => (q && typeof q === 'object' ? (q as Record<string, unknown>) : {}))
    .filter((q) => str(q['text']))
    .map((q) => ({ text: str(q['text']), options: arr(q['options']).map(String) }))
  return { kind: 'ask', say, questions, ...(say || questions.length ? {} : { unread: true }) }
}
