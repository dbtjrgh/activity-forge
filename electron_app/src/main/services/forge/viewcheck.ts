/**
 * 띄우기 전에 **정션이 걸려 있나 · 어느 호가 걸려 있나** (`view.ts` 에서 떼어 냄).
 *
 * 정션을 앱이 걸지 않는 까닭은 `view.ts` 머리말에 있습니다. 여기는 보기만 하고,
 * 막히면 **칠 명령**(`sparkon link MNN`)을 같이 돌려줍니다.
 */

import { existsSync, realpathSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { LinkState, ViewCheck } from '../../../shared/forge'
import { hoLabel } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { homeTaken } from './commonlink'
import { loadForge } from './runtime'

function monthOf(code: string): string {
  return /M(\d\d)/.exec(code)?.[1] ?? ''
}

/** 정션 하나를 본다. 어디를 가리키는지까지 읽어 둔다 — 「걸려는 있는데 딴 데」가 있다. */
function linkAt(name: string, at: string): LinkState {
  if (!existsSync(at)) return { name, at, ok: false, target: '' }
  try {
    return { name, at, ok: true, target: realpathSync(at) }
  } catch (error) {
    // 끊어진 정션은 존재하는데 따라갈 수 없다. 이것도 「안 걸린 것」이다.
    return { name, at, ok: false, target: toMessage(error) }
  }
}

/** 호 저장소 하나에 걸린 정션 셋 — 공통 소스 · 공통 리소스 · 글꼴. 회귀 검사(`regressserve.ts`)도 이것을 본다 */
export function hallLinks(repo: string): LinkState[] {
  return [
    linkAt('공통 소스', join(repo, 'src', '_common')),
    linkAt('공통 리소스', join(repo, 'public', 'sparklab', 'common')),
    linkAt('글꼴', join(repo, 'public', 'sparklab', 'font'))
  ]
}

export async function viewCheck(code: string): Promise<ViewCheck> {
  const blank: ViewCheck = {
    repo: '',
    activity: false,
    links: [],
    linkedMonth: '',
    sameMonth: false,
    command: '',
    blocked: ''
  }

  let forge: Awaited<ReturnType<typeof loadForge>>
  try {
    forge = await loadForge()
  } catch (error) {
    return { ...blank, blocked: toMessage(error) }
  }

  const month = monthOf(code)
  if (!month) return { ...blank, blocked: '학습코드에서 호를 읽지 못했습니다.' }

  const root = forge.paths.workRoot()
  const repo = join(root, `sparkon_m${month}`)
  const out: ViewCheck = { ...blank, repo, command: `sparkon link M${month}` }
  if (!existsSync(repo)) return { ...out, blocked: `호 폴더가 없습니다: ${repo}` }

  // 먼저 써야 볼 것이 있다. 안 쓴 차시를 띄우면 vite 가 빈 화면을 낸다.
  out.activity = existsSync(join(repo, 'src', 'activity', code))

  out.links = hallLinks(repo)

  // **어느 호가 지금 걸려 있나.** `sparkon_common/node_modules` 는 하나뿐이고
  // 호마다 다시 겁니다 — 그래서 이것이 「지금 작업 중인 호」입니다.
  // 공용 폴더 자리는 forge `commonPick` 하나입니다(2026-10-21). 작업 폴더 밖으로 정했으면 `sparkon link` 는
  // 거기에 걸지 않습니다(CLI 는 작업 폴더 안 sparkon_common 만 봅니다). 그 자리가 비었으면 「연결」이 공용 폴더로 가는
  // 정션을 먼저 겁니다(`commonlink.ts`, 2026-10-23). 다른 폴더가 있으면 막고 명령 대신 그 까닭을 말합니다.
  const common = forge.commonroot.commonPick()
  const linkable = common.beside || common.free
  // 걸 수 없는 명령은 내놓지 않는다 — 내놓으면 「연결」 단추가 작업 폴더 안의 옛 사본에 건다(2026-10-21 검증)
  if (!linkable) out.command = ''
  const shared = linkAt('공통 node_modules', join(common.dir, 'node_modules'))
  out.links.push(shared)
  if (shared.ok) {
    const m = /sparkon_m(\d\d)/.exec(basename(join(shared.target, '..')))
    out.linkedMonth = m?.[1] ?? ''
    out.sameMonth = out.linkedMonth === month
  }

  const broken = out.links.filter((l) => !l.ok)
  if (broken.length) {
    // 그 자리가 비었으면(`free`) 손으로 칠 `sparkon link` 는 「먼저 clone부터」로 멈춘다 — 「연결」 단추만 된다(정션을 먼저 건다)
    const missing = `미리보기 연결이 없습니다(${broken.map((l) => l.name).join(', ')}).`
    out.blocked = !linkable
      ? `${homeTaken(common.home) || '작업 폴더 안에 다른 sparkon_common 폴더가 있어'} 공용 폴더로 미리보기를 연결할 수 없습니다.`
      : common.beside
        ? `${missing} 아래 명령을 PowerShell 에서 실행하세요.`
        : missing
  } else if (!out.sameMonth) {
    out.blocked = out.linkedMonth
      ? `미리보기가 ${hoLabel(out.linkedMonth)}에 연결되어 있습니다. ${hoLabel(month)}로 다시 연결하세요.`
      : '미리보기가 어느 호에 연결되어 있는지 읽지 못했습니다.'
  } else if (!out.activity) {
    out.blocked = '아직 저장소에 없는 학습코드입니다. 먼저 대화로 생성하세요.'
  }
  return out
}
