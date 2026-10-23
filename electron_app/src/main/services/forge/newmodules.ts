/**
 * **새 모듈 알림** (2026-09-29 사용자 말 — 「신규모듈같은게 나왔을 때 나한테 보고되도록」).
 *
 * 열린 진행판마다 배치표가 정한 모듈 가운데 **스펙이 없는 것**(forge 진행판 단계 「스펙 먼저」)을 모듈별로 모은다.
 * 누가 쓰든 같은 배치표 · 호 저장소를 보므로 똑같이 셀 수 있다 — 그래서 보내는 길 없이 **각자의 앱이 스스로 센다**(사용자 결정).
 *
 * **스펙은 누구나 만든다** (2026-10-21 사용자 결정 — 「git 권한 있는 사람은 다 스펙을 만들게」). 2026-09-29 부터는
 * `.user.json` 에 `specOwner` 가 있는 한 사람의 앱만 이 알림을 띄웠다. 이제 모두에게 뜨므로 아래 글은
 * **받은 사람의 양산기 저장소(SparkOn-양산기)에서 그대로 돌아야 한다** — 경로는 그 PC 의 것으로 적고,
 * forge 패키지 설치(초기 설정은 양산기를 받기만 한다)와 커밋 · 푸시까지 적는다. 둘이 같은 스펙을 만들 수 있어 먼저 받고, 이미 올라왔으면 멈춘다.
 *
 * 모듈마다 「그 모듈을 쓴 완성본 수」를 같이 싣는다(forge `api.modules` 그대로). **0 이면 초안을 못 만든다** —
 * `draftSpec` 이 완성본을 견줘 초안을 쓰기 때문이다. 그때는 그렇다고 말한다.
 *
 * **메인 스레드를 오래 안 붙잡는다** (2026-10-21). 모두의 앱이 켤 때마다 세게 되자 진행판 34장을 잇달아 읽는 동안
 * 메인이 1.2초 멈췄다. 그래서 한 장마다 쉬어 가고(`rest`), 완성본 수(`api.modules`, 70~90ms)는 새 모듈이 있을 때만 센다.
 * 한 번에 붙잡는 것은 forge 함수 하나다 — `boardOf` 한 장이 20~40ms, 가장 무거운 MA10 이 100ms 안팎(부하에 따라 80~130ms, 대부분 배치 계산)이라
 * 그 한 장보다 짧게 나누려면 forge 쪽을 고쳐야 한다. 도는 중에 또 부르면 그 결과를 나눠 주지 않고 끝난 뒤 한 번만 다시 센다 — 도는 셈은 호를 열기 전의
 * 배치표를 읽었을 수 있다. 같은 진행판 목록으로 다시 묻지 않는 것은 화면 쪽이 맡는다(`NewModules.tsx`).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import { dirname, relative, sep } from 'node:path'
import type { NewModule, NewModules } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { listBoards } from './board'
import { loadForge, type Forge } from './runtime'

/**
 * **Claude 에게 줄 글** (2026-09-29 사용자 말 — 「스펙 만드는 거 클로드 이용해서 할 텐데 … 신규모듈 만들고 나서 이거 보고 스펙 만들어 시킬 것 같은데」).
 * 스펙 화면을 앱에 두는 대신, 양산기 저장소에서 Claude Code 에게 붙여 넣을 한 덩이를 만든다 — 무엇을 · 어디를 보고 · 어떻게 끝났다고 보는지 · 어떻게 올리는지.
 *
 * - 모듈 소스 폴더는 `sparkon_common/_common/module/<과목 폴더>/<모듈>` — 과목 폴더 이름(국어만 KR)은 forge `subjects.ts` 한 표(`dirOf`)에서 받는다
 * - 커밋은 그 스펙 파일 하나만 — 양산기 폴더에 고친 파일이 남으면 「업데이트」가 자료를 안 받는다(`refresh.ts`)
 * - 커밋 문구는 지난 스펙 커밋들의 꼴(「M38_1 · M38_2 스펙을 더한다」)을 따른다
 * - 다시 받을 때는 `--rebase --autostash` 다 (2026-10-21) — 앱이 `_layout` 을 고쳐 둔 채라 `--rebase` 만으로는 git 이 거절한다
 * - 못 올리면 커밋을 되돌리고 스펙 파일을 저장소 밖으로 옮긴다 (2026-10-21). 안 올린 커밋이 남으면 「업데이트」가 멈춘다.
 *   `--soft` 로 되돌리면 파일이 담긴 채(`A `)라 `refreshstash.ts` 의 `asideOf` 가 치워 두지 못해 역시 멈추고, 그대로 두면
 *   권한 있는 사람이 같은 파일을 올린 뒤 `pull` 이 「untracked 파일을 덮어쓴다」로 멈춘다
 */
function askText(forge: Forge, m: NewModule): string {
  const repo = dirname(forge.root)
  const rel = (p: string): string => relative(repo, p).split(sep).join('/')
  const file = rel(forge.spec.specPath(m.subject, m.module))
  // 모듈 폴더 자리는 forge `moduleDir` 하나다 — 공용 폴더를 다른 자리로 정할 수 있다(2026-10-21)
  const dir = forge.survey.moduleDir(m.subject, m.module)
  const base = m.module.split('_')[0] ?? m.module
  const like = forge.spec.listSpecs(m.subject).filter((s) => s !== m.module && s.split('_')[0] === base)
  return [
    `${m.subject}/${m.module} 모듈 스펙을 만들어 줘. 스펙 파일은 ${file} 이다(양산기 저장소 ${repo}).`,
    '- 먼저 그 저장소가 main 브랜치인지 보고 `git pull --ff-only` 로 최신을 받는다. main 이 아니거나 받지 못하면 멈추고 알려 줘.',
    '- 받은 뒤 그 스펙 파일이 이미 있으면(다른 사람이 먼저 올렸으면) 만들지 말고 알려 줘.',
    '- `forge/node_modules` 가 없으면 `cd forge && yarn install --frozen-lockfile` 부터 한다(양산 앱의 초기 설정은 저장소를 받기만 한다).',
    `- 이번에 쓰는 학습코드 ${m.codes.length}개: ${m.codes.join(', ')}`,
    `- 모듈 소스: ${dir}${existsSync(dir) ? '' : ' — **아직 없음**(모듈을 먼저 만들어야 한다)'}`,
    m.samples
      ? `- 이 모듈을 쓴 완성본 ${m.samples}개 — \`cd forge && yarn forge draft ${m.subject}/${m.module} --write\` 로 초안을 써서 시작한다(여러 과목이 쓰는 모듈이면 초안이 forge/_spec/_common 에 생긴다)`
      : '- 이 모듈을 쓴 완성본이 없어 초안(draft)을 못 뽑는다 — 모듈 소스가 GameData 를 받는 꼴을 읽고 쓴다',
    like.length ? `- 이름이 비슷한 스펙(본보기): ${like.map((s) => rel(forge.spec.specPath(m.subject, s))).join(', ')}` : '',
    '- 규칙은 forge/CLAUDE.md. 끝나면 `cd forge && yarn check:spec` 통과까지. 통과하지 못하면 커밋하지 말고 까닭을 알려 줘.',
    `- 통과하면 만든 스펙 파일 하나만 \`git add\` 해 커밋하고 main 에 푸시한다. 다른 파일은 커밋하지 않는다. 커밋 문구는 「${m.subject} ${m.module} 스펙을 더한다」 한 줄이다.`,
    '- 원격에 새 커밋이 있어 푸시가 거절되면 `git pull --rebase --autostash` 뒤 다시 푸시한다(양산 앱이 고쳐 둔 _layout 파일이 있어 --autostash 가 없으면 git 이 받지 않는다). 그 사이 같은 스펙이 올라와 충돌하면 `git rebase --abort` 하고 아래처럼 한다.',
    '- 푸시할 권한이 없거나 같은 스펙이 먼저 올라와 올리지 못하면 `git reset HEAD~1` 로 커밋만 되돌리고, 그 스펙 파일은 저장소 밖으로 옮긴 뒤 옮긴 자리를 알려 줘. 커밋이나 그 파일이 저장소에 남으면 양산 앱의 「업데이트」가 멈춘다.',
    '- 권한이 없어 못 올렸으면 푸시 권한이 있는 사람이 그 파일을 올려야 한다고 사람에게 알려 줘.',
    '- 푸시하면 다른 사람 양산 앱의 「업데이트」가 켜지고, 받으면 이 모듈 학습코드를 만들 수 있다.'
  ]
    .filter(Boolean)
    .join('\n')
}

/** 다음 차례로 넘긴다 — 그 사이 쌓인 IPC 와 화면 일을 먼저 돌린다(`scene.ts` 와 같은 꼴) */
const rest = (): Promise<void> => new Promise((r) => setImmediate(r))

/** 도는 셈과, 그 뒤에 한 번 더 돌 셈 — 위 머리말 「메인 스레드를 오래 안 붙잡는다」 */
let running: Promise<NewModules> | null = null
let again: Promise<NewModules> | null = null

export function newModules(): Promise<NewModules> {
  if (!running) {
    running = count().finally(() => {
      running = null
    })
    return running
  }
  // `running` 이 풀릴 때는 위 finally 가 이미 돌았다 — 그래서 아래 newModules() 는 새로 센다
  again ??= running.then(() => {
    again = null
    return newModules()
  })
  return again
}

async function count(): Promise<NewModules> {
  try {
    const forge = await loadForge()
    const { boards, error } = await listBoards()
    if (error) return { modules: [], error }
    const by = new Map<string, NewModule>()
    for (const b of boards) {
      await rest()
      for (const row of forge.layout.boardOf(b.subject, b.issue)) {
        if (row.stage !== '스펙 먼저' || !row.module) continue
        // 「M30+M31」처럼 둘을 쓰는 칸은 모듈마다 따로 센다 — 스펙은 모듈마다 한 장이다
        for (const module of row.module.split('+')) {
          if (existsSync(forge.spec.specPath(b.subject, forge.spec.resolveModule(b.subject, module)))) continue
          const key = `${b.subject}/${module}`
          const at = by.get(key) ?? { subject: b.subject, module, codes: [], samples: 0, ask: '' }
          at.codes.push(row.code)
          by.set(key, at)
        }
      }
    }
    if (!by.size) return { modules: [] }
    await rest()
    const used = new Map(forge.api.modules().map((m) => [`${m.subject}/${m.module}`, m.count]))
    for (const m of by.values()) {
      m.samples = used.get(`${m.subject}/${m.module}`) ?? 0
      m.ask = askText(forge, m)
    }
    return { modules: [...by.values()].sort((a, b) => b.codes.length - a.codes.length || a.module.localeCompare(b.module)) }
  } catch (error) {
    return { modules: [], error: toMessage(error) }
  }
}
