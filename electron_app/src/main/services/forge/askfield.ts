/**
 * **에러 하나를 그 자리 카드 한 장으로** — 스펙 필드를 보고 칸 꼴(좌표·값·고르기)을 정한다.
 *
 * `ask.ts` 가 306줄이 되어 갈랐다 (2026-09-18, 동작 변화 없음). 카드를 모으고
 * 리소스 요구를 무리로 묶는 것은 `ask.ts`, 배치표 카드는 `askmodule.ts` 에 있다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Ask } from '../../../shared/forge'
import { valueAt } from './answer'
import { carryable, fieldAt } from './field'
import type { Issue, Recipe, Spec } from '@/gen/types'

/** 스펙에 적힌 자동 검사 없는 규칙. 기계가 판정 못 한다고 스펙이 스스로 말한 것. */
export const HANDS_OFF = '자동 검사가 없는 규칙입니다'

export function askOf(issue: Issue, spec: Spec | null, recipe: Recipe): Ask {
  // ─ 스펙의 필드를 찾아 그 자리가 무엇을 원하는지 본다 ─
  const field = spec ? fieldAt(spec, issue.path) : null
  const base = {
    id: `${issue.rule}|${issue.path}`,
    where: issue.path,
    title: issue.message,
    count: 1,
    items: [] as string[],
    now: valueAt(recipe, issue.path, spec?.gameData?.root ?? ''),
    // **무엇을 다음 호에 물려줄 수 있나는 한 곳이 정한다** (`field.ts`).
    carry: carryable(spec, issue.path),
    // 앞선 호에서 이미 정해 둔 것이 있으면 그 까닭을 보여 준다. 「또 물어보네」가
    // 아니라 「전에는 이렇게 정했는데 이번엔 안 맞는다」를 알 수 있게.
    ...(field?.defaultWhy ? { carried: field.defaultWhy } : {})
  }

  // ─ 스펙이 「사람이 봐야」라고 못 박은 것 ─
  if (issue.message.startsWith(HANDS_OFF)) {
    return {
      ...base,
      want: '사람이 봐야',
      desc: issue.why ?? '',
      give: '미리보기로 직접 확인한 뒤 「확인」을 누르세요.',
      options: [],
      shape: 'none',
      // 눈으로 보는 일은 호마다 다시 해야 한다. 「봤음」을 물려주면 안 본
      // 다음 호가 본 것이 된다.
      carry: false
    }
  }

  const desc = field?.desc ?? issue.why ?? ''

  // **posTable 은 앱이 안 받는다.** 선지 개수마다 좌표가 몇 개씩 딸린 표라
  // 칸을 늘리고 줄이는 일이 함께 온다. 그것은 양산기 화면(forge-ui.bat)의 몫이다.
  if (field?.type === 'posTable') {
    return {
      ...base,
      want: '좌표',
      desc,
      give: '선지별 좌표 표입니다. forge-ui.bat 화면에서 입력하세요.',
      options: [],
      shape: 'none',
      // 앱이 값을 못 받는 자리는 물려줄 값도 없다.
      carry: false
    }
  }

  if (field && (field.type === 'point' || field.figma)) {
    const anchor = field.figmaBase?.label
    return {
      ...base,
      want: '좌표',
      desc,
      give: field.figma
        ? `figma 에서 이 요소의 왼쪽 위 x, y 좌표와 너비, 높이를 입력하세요${anchor ? ` (${anchor} 기준)` : ''}.`
        : '화면 가운데를 0, 0 으로 한 x, y 좌표를 입력하세요.',
      options: [],
      shape: field.figma ? 'figma' : 'xy'
    }
  }

  if (field?.type === 'enum' && field.values?.length) {
    return {
      ...base,
      want: '고르기',
      desc,
      give: '아래에서 하나를 고르세요.',
      options: field.values.map((v) => ({ value: v, why: '스펙 값' })),
      shape: 'pick'
    }
  }

  // 칸을 늘리고 줄이는 일(배열·객체)과, 스펙에서 자리를 못 찾은 것은 앱이 안 받는다.
  // **모르는 자리에 값을 넣는 것이 제일 나쁜 실패다** (저장소 CLAUDE.md 6번).
  const scalar = field?.type === 'number' || field?.type === 'string' || field?.type === 'bool'
  const asset = String(field?.type ?? '').startsWith('asset:')
  const shape = !field ? 'none' : field.type === 'number' ? 'number' : scalar || asset ? 'text' : 'none'
  return {
    ...base,
    want: '값',
    desc,
    give: !field
      ? '스펙에 없는 항목입니다. forge-ui.bat 화면에서 입력하세요.'
      : scalar || asset
        ? (field.minLengthWhy ?? '기획서의 값을 아래 칸에 입력하세요.')
        : (field.minLengthWhy ?? '개수를 바꿔야 하는 항목입니다. forge-ui.bat 화면에서 입력하세요.'),
    options: [],
    shape,
    carry: base.carry && shape !== 'none'
  }
}
