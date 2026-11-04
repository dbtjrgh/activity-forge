/**
 * **다른 호에서만 쓰던 녹음 짚기(참고)** (2026-11-04) — 대화가 원본 완성본의 소리를 그대로 가져와, 그 호 전용 녹음이 이번 호에 올라갔다.
 * 9호 KOL1M09W4S2 가 7호 박사 대사 `SL_ko_128_s2_nar01 · nar02` 를 썼다 — 9호 공유 폴더에는 같은 역할의 공통 녹음(`104_s2_nar03 · nar08`)이 있었다.
 *
 * 앞 호 녹음을 다시 쓰는 일은 흔하다(개발 완료 601개 가운데 154개 · 소리 1,378개). 이름만으로 짚으면 13%가 걸려 쓸 수 없었다.
 * 그래서 셋이 다 맞을 때만 짚는다 —
 *   ① 이름 주인(`homeOf`)이 이 호도 1호도 아니다(1호 녹음은 공통 기본으로 돌려 쓴다)
 *   ② 기획서 녹음 표에 안 적혔다 — 일부러 다시 쓰는 것은 「(기존)」으로 이름이 적힌다(`plansound.ts`)
 *   ③ 다른 개발 완료 완성본이 그 소리를 주인 호 밖에서 쓴 적이 없다 — 여러 호가 돌려 쓰면 공통 녹음이다
 * 기획서 이름을 못 읽었으면 짚지 않는다(짐작하지 않는다). 2026-11-04 기획서 이름이 있는 38개로 재 보니 2개가 걸렸고, W4S2 에 7호 대사를 넣으면 둘 다 걸렸다.
 *
 * 막지 않는다 — 사람이 들어 보고 정한다. AI 를 따로 부르지 않는다(다른 검사로 고칠 차례가 오면 그 글에 참고로 같이 실린다).
 * 완성본 AssetTable 을 읽는 것은 후보가 있을 때만이다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import { hoLabel } from '../../../shared/forge'
import { activities, hallDirs } from './hallwalk'
import { homeOf } from './planreuse'
import { planSound } from './plansound'
import type { Forge } from './runtime'

const monthOf = (code: string): string | null => /^[A-Z]{2}L\dM(\d\d)W\dS\d$/.exec(code)?.[1] ?? null

/**
 * @param want AssetTable 이 부르는 호 저장소 안 경로(`sounds/SL_ko_128_s2_nar01.mp3` …, `pubfiles.ts` `wantOf`)
 * @param act 이 학습코드의 액티비티 폴더 — 작업 폴더를 거기서 셈한다(`<작업 폴더>/sparkon_mNN/src/activity/<코드>`)
 */
export function foreignSounds(forge: Forge, code: string, act: string, rsc: string, want: string[]): string[] {
  const month = monthOf(code)
  if (!month) return []
  const plan = planSound(forge, code, rsc)
  if (plan.note) return []
  const listed = new Set([...plan.own, ...plan.unsure, ...plan.others, ...plan.near, ...plan.shared, ...plan.joined].map((n) => n.toLowerCase()))

  const picks = new Map<string, string>()
  for (const rel of want) {
    const name = path.basename(rel).replace(/\.[^.]+$/, '')
    const home = homeOf(name)
    const hm = home && monthOf(home)
    if (!home || !hm || hm === month || hm === '01' || listed.has(name.toLowerCase())) continue
    picks.set(name, home)
  }
  if (!picks.size) return []

  // 다른 개발 완료 완성본이 주인 호 밖에서 그 소리를 썼나 — 이 학습코드 호는 빼고 센다
  const work = path.resolve(act, '..', '..', '..', '..')
  const hallOf = new Map(hallDirs(work).map((h) => [h.month, h.dir]))
  const elsewhere = new Set<string>()
  for (const a of activities(work)) {
    if (a.finished !== true || a.month === month || a.code === code) continue
    const dir = hallOf.get(a.month)
    if (!dir) continue
    let text = ''
    try {
      text = fs.readFileSync(path.join(dir, 'src', 'activity', a.code, 'AssetTable.ts'), 'utf8')
    } catch {
      continue
    }
    for (const [name, home] of picks) if (a.month !== monthOf(home) && text.includes(name)) elsewhere.add(name)
  }
  return [...picks]
    .filter(([name]) => !elsewhere.has(name))
    .map(([name, home]) => `${name} (${hoLabel(monthOf(home) as string)} ${home} 녹음)`)
}
