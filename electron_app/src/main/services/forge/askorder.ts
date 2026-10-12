/**
 * **순서만 남은 자리** — 파일은 다 왔는데 몇 번이 어느 자리인지만 모를 때 사람에게 고르게 하는 카드 (2026-10-01).
 *
 * 사람에게 묻는 것은 맨 마지막이다 — 도구(이름 · 크기) → AI(figma 화면) → **기획서가 없으면 기획서부터** → 그래도 모르면 사람이 순서를 고른다
 * (사용자 말 — 「ai판단 후에도 도저히 안되면 기획서까지 달라는말을 해야하지 않을까 그것도 안되면 사용자보고 이닝 순서 알려달라해야지」).
 * 9호 KOL1M08W2S2 의 내레이션 다섯은 이름이 `SL_ko_113_…` → `SL_ko_129_…` 로 와 「파일 없음」 표로 떴다 — 파일은 다 있었고
 * 원본 이름을 넣으라는 말이 틀린 안내였다. 소리는 AI 가 못 듣는다 — 대본(기획서)이 있어야 AI 가 정한다.
 *
 * 같은 크기 그림 묶음(`sizematch.ts`)과 이름 무리(`askasset.ts`)가 같이 쓴다. Electron 을 import 하지 않는다(services 규칙).
 */

import type { Ask } from '../../../shared/forge'
import type { Issue } from '@/gen/types'

/** 첫 카드에만 붙는 할 일 — 기획서가 있나로 갈린다 */
export function orderGive(hasPlan: boolean): string {
  return hasPlan
    ? '파일은 모두 있지만 순서를 알 수 없습니다. 기획서의 순서대로 고르세요. 번호가 같은 항목끼리 한 세트입니다.'
    : '파일은 모두 있지만 순서를 알 수 없습니다. 기획서를 넣고 「다시 생성」을 누르면 AI가 순서를 찾습니다. 기획서가 없으면 직접 고르세요.'
}

/**
 * 자리마다 한 장 — 후보는 같은 파일들. `what` 은 「같은 크기(122x137) 그림」 · 「비슷한 파일」처럼 후보가 무엇인지.
 * `was` 는 그 자리에 원본이 쓰던 파일(카드의 묶인 항목 칸).
 */
export function orderAsks(issues: Issue[], was: string[], files: string[], what: string, hasPlan: boolean): Ask[] {
  return issues.map((issue, k) => ({
    id: `asset|${issue.path}`,
    want: '고르기' as const,
    where: issue.path,
    title: `${issue.path.split('.').pop()} — ${what} ${files.length}개 가운데 이 자리 것을 고르세요.`,
    desc: '',
    give: k === 0 ? orderGive(hasPlan) : '',
    options: files.map((value) => ({ value, why: '' })),
    shape: 'pick' as const,
    count: 1,
    items: [was[k] ?? ''],
    carry: false,
    byHand: true
  }))
}
