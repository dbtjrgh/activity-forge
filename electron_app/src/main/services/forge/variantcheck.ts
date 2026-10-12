/**
 * **받은 파일이 다른 변형 판과 훨씬 잘 맞으면 모듈을 묻는다** — K32(로켓) ↔ K32Type2(로봇) (2026-10-01).
 *
 * 9호 모듈표는 「K32」라고만 적었고 배치표도 K32 였다. 그런데 완성본 L1W2S2 가운데 로봇 판(2 · 3 · 4 · 6호)은 `K32Type2`, 로켓(8호)만 `K32` 다.
 * 받은 애니메이션 25개가 로봇 판 이름(`robot_correct` · `dance` …)이었는데 앱은 로켓 판으로 만들어 로켓 질문 · 로켓 그림이 따라왔다
 * (사용자 말 — 「그런것도 양산기 안에서 잘 해야하는데 알아서」). 원본 변경 후보도 모듈 하나로 걸러져 로봇 판을 고를 길이 없었다.
 *
 * - **같은 칸의 완성본이 쓴 모듈 가운데 이름 뿌리가 같은 것**(`K32` · `K32Type2`)만 변형 판으로 본다 — 스펙에 따로 적지 않는다
 * - 받은 파일을 **이름 무리**(forge `commonfresh.ts` `familyOf` — 학습코드 앞머리를 떼고 숫자를 #)로 세어, 지금 원본과 변형 판 완성본이 각각 몇 개 맞나 견준다
 * - 앱이 가져온 파일(`carrylog.ts`)은 안 센다 — 지금 원본에서 가져온 것이라 지금 원본 쪽 점수만 오른다
 * - **크게 나을 때만**(`MORE` 개 이상 더 맞고 1.5배 이상) 기존 「모듈 고르기」 카드(`askmodule.ts` 와 같은 꼴)로 묻는다 — 바꾸는 것은 사람이다
 * - 사람이 한 번 답했으면(답 파일에 `#module`) 다시 묻지 않는다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Ask } from '../../../shared/forge'
import { MODULE_PATH } from '../../../shared/forge'
import { readAnswers } from './answer'
import { carriedRels } from './carrylog'
import type { Forge } from './runtime'

const MORE = 10
const root = (module: string): string => module.replace(/Type\d+$/i, '')

/** 폴더 안 파일 전부 — `_` 로 시작하는 폴더(`_figma` · `_원본`)는 뺀다 */
function walk(dir: string, sub = ''): string[] {
  let list: fs.Dirent[] = []
  try {
    list = fs.readdirSync(path.join(dir, sub), { withFileTypes: true })
  } catch {
    return []
  }
  return list.flatMap((d) => {
    const rel = sub ? `${sub}/${d.name}` : d.name
    if (d.isDirectory()) return d.name.startsWith('_') ? [] : walk(dir, rel)
    return [rel]
  })
}

export function variantAsk(forge: Forge, code: string, pick: { module: string; origin: string }): Ask | null {
  const study = forge.spec.parseStudyCode(code)
  const dir = forge.files.rscDir(code)
  if (!study || !dir || !pick.module || pick.module.includes('+')) return null
  if (readAnswers(forge.paths.REPO_ROOT, code).answers.some((a) => a.path === MODULE_PATH && a.by === 'person')) return null
  const slot = `L${study.level}W${study.week}S${study.session}`
  const month = String(study.month).padStart(2, '0')
  // 자기 자신은 뺀다 — 이미 반영한 학습코드는 완성본으로 잡혀 자기와 견준다
  const cells = forge.layout.scanCells(study.subject).filter((c) => c.slot === slot && c.issue !== month)
  const siblings = [...new Set(cells.map((c) => c.module))].filter((m) => m !== pick.module && !m.includes('+') && root(m) === root(pick.module))
  if (!siblings.length) return null

  const skip = carriedRels(forge.paths.REPO_ROOT, code)
  const mine = walk(dir).filter((r) => !skip.has(r)).map((r) => forge.commonfresh.familyOf(r))
  const score = (other: string): number => {
    const theirs = new Set([...forge.common.fileOf(other).values()].map((r) => forge.commonfresh.familyOf(r)))
    return mine.filter((f) => theirs.has(f)).length
  }
  const now = pick.origin ? score(pick.origin) : 0
  const codeOf = (c: { issue: string }): string => `${study.subject}L${study.level}M${c.issue}W${study.week}S${study.session}`
  let best: { module: string; code: string; n: number } | null = null
  for (const c of cells.filter((x) => siblings.includes(x.module))) {
    const n = score(codeOf(c))
    if (!best || n > best.n) best = { module: c.module, code: codeOf(c), n }
  }
  if (!best || best.n < now + MORE || best.n < now * 1.5) return null

  return {
    id: `module-variant|${slot}`,
    want: '모듈',
    where: MODULE_PATH,
    title: `받은 파일이 ${best.module} 모듈과 더 잘 맞습니다. 모듈을 확인하세요.`,
    desc: `받은 파일 ${mine.length}개 가운데 ${best.code}(${best.module})와 ${best.n}개, 지금 원본 ${pick.origin}(${pick.module})와 ${now}개가 이름이 맞습니다.`,
    give: '맞는 모듈을 고르고 이유를 입력하세요. 배치표에 저장되고 원본도 그 모듈로 다시 고릅니다.',
    options: [
      { value: best.module, why: `받은 파일 ${best.n}개가 이 모듈 완성본과 이름이 맞습니다` },
      { value: pick.module, why: '지금 배치표의 모듈' }
    ],
    shape: 'pick',
    count: 1,
    items: [],
    carry: true
  }
}
