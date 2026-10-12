/**
 * **새 모듈 알림** (2026-09-29 사용자 말 — 「신규모듈같은게 나왔을 때 나한테 보고되도록」).
 *
 * 열린 진행판마다 배치표가 정한 모듈 가운데 **스펙이 없는 것**(forge 진행판 단계 「스펙 먼저」)을 모듈별로 모은다.
 * 누가 쓰든 같은 배치표 · 호 저장소를 보므로 똑같이 셀 수 있다 — 그래서 보내는 길 없이 **스펙 주인의 앱이 스스로 센다**(사용자 결정).
 *
 * 모듈마다 「그 모듈을 쓴 완성본 수」를 같이 싣는다(forge `api.modules` 그대로). **0 이면 초안을 못 만든다** —
 * `draftSpec` 이 완성본을 견줘 초안을 쓰기 때문이다. 그때는 그렇다고 말한다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { NewModule, NewModules } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { listBoards } from './board'
import { loadForge, type Forge } from './runtime'

/** 모듈 소스 폴더 — 호 저장소들이 같이 쓰는 `sparkon_common/_common/module/<과목 폴더>/<모듈>`. 국어 폴더 이름만 KR 이다 */
const MODULE_DIR: Record<string, string> = { EN: 'EN', MA: 'MA', KO: 'KR' }

/**
 * **Claude 에게 줄 글** (2026-09-29 사용자 말 — 「스펙 만드는 거 클로드 이용해서 할 텐데 … 신규모듈 만들고 나서 이거 보고 스펙 만들어 시킬 것 같은데」).
 * 스펙 화면을 앱에 두는 대신, 이 저장소에서 Claude 에게 붙여 넣을 한 덩이를 만든다 — 무엇을 · 어디를 보고 · 어떻게 끝났다고 보는지.
 */
function askText(forge: Forge, m: NewModule): string {
  const dir = join(forge.paths.workRoot(), 'sparkon_common', '_common', 'module', MODULE_DIR[m.subject] ?? m.subject, m.module)
  const base = m.module.split('_')[0] ?? m.module
  const like = forge.spec.listSpecs(m.subject).filter((s) => s !== m.module && s.split('_')[0] === base)
  return [
    `${m.subject}/${m.module} 모듈 스펙을 만들어 줘 (forge/_spec/${m.subject}/${m.module}.json).`,
    `- 이번에 쓰는 칸 ${m.codes.length}개: ${m.codes.join(', ')}`,
    `- 모듈 소스: ${dir}${existsSync(dir) ? '' : ' — **아직 없음**(모듈을 먼저 만들어야 한다)'}`,
    m.samples
      ? `- 이 모듈을 쓴 완성본 ${m.samples}개 — \`cd forge && yarn forge draft ${m.subject}/${m.module}\` 로 초안을 뽑아 시작한다`
      : '- 이 모듈을 쓴 완성본이 없어 초안(draft)을 못 뽑는다 — 모듈 소스가 GameData 를 받는 꼴을 읽고 쓴다',
    like.length ? `- 이름이 비슷한 스펙(본보기): ${like.map((s) => `_spec/${m.subject}/${s}.json`).join(', ')}` : '',
    '- 규칙은 forge/CLAUDE.md. 끝나면 `cd forge && yarn check:spec` 통과까지.'
  ]
    .filter(Boolean)
    .join('\n')
}

export async function newModules(): Promise<NewModules> {
  try {
    const forge = await loadForge()
    const { boards, error } = await listBoards()
    if (error) return { modules: [], error }
    const used = new Map(forge.api.modules().map((m) => [`${m.subject}/${m.module}`, m.count]))
    const by = new Map<string, NewModule>()
    for (const b of boards) {
      for (const row of forge.layout.boardOf(b.subject, b.issue)) {
        if (row.stage !== '스펙 먼저' || !row.module) continue
        // 「M30+M31」처럼 둘을 쓰는 칸은 모듈마다 따로 센다 — 스펙은 모듈마다 한 장이다
        for (const module of row.module.split('+')) {
          if (existsSync(forge.spec.specPath(b.subject, forge.spec.resolveModule(b.subject, module)))) continue
          const key = `${b.subject}/${module}`
          const at = by.get(key) ?? { subject: b.subject, module, codes: [], samples: used.get(key) ?? 0, ask: '' }
          at.codes.push(row.code)
          by.set(key, at)
        }
      }
    }
    for (const m of by.values()) m.ask = askText(forge, m)
    return { modules: [...by.values()].sort((a, b) => b.codes.length - a.codes.length || a.module.localeCompare(b.module)) }
  } catch (error) {
    return { modules: [], error: toMessage(error) }
  }
}
