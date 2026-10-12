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

  let paths: Awaited<ReturnType<typeof loadForge>>['paths']
  try {
    paths = (await loadForge()).paths
  } catch (error) {
    return { ...blank, blocked: toMessage(error) }
  }

  const month = monthOf(code)
  if (!month) return { ...blank, blocked: '학습코드에서 호를 읽지 못했습니다.' }

  const root = paths.workRoot()
  const repo = join(root, `sparkon_m${month}`)
  const out: ViewCheck = { ...blank, repo, command: `sparkon link M${month}` }
  if (!existsSync(repo)) return { ...out, blocked: `호 폴더가 없습니다: ${repo}` }

  // 먼저 써야 볼 것이 있다. 안 쓴 차시를 띄우면 vite 가 빈 화면을 낸다.
  out.activity = existsSync(join(repo, 'src', 'activity', code))

  out.links = [
    linkAt('공통 소스', join(repo, 'src', '_common')),
    linkAt('공통 리소스', join(repo, 'public', 'sparklab', 'common')),
    linkAt('글꼴', join(repo, 'public', 'sparklab', 'font'))
  ]

  // **어느 호가 지금 걸려 있나.** `sparkon_common/node_modules` 는 하나뿐이고
  // 호마다 다시 겁니다 — 그래서 이것이 「지금 작업 중인 호」입니다.
  const shared = linkAt('공통 node_modules', join(root, 'sparkon_common', 'node_modules'))
  out.links.push(shared)
  if (shared.ok) {
    const m = /sparkon_m(\d\d)/.exec(basename(join(shared.target, '..')))
    out.linkedMonth = m?.[1] ?? ''
    out.sameMonth = out.linkedMonth === month
  }

  const broken = out.links.filter((l) => !l.ok)
  if (broken.length) {
    out.blocked = `미리보기 연결이 없습니다(${broken.map((l) => l.name).join(', ')}). 아래 명령을 PowerShell 에서 실행하세요.`
  } else if (!out.sameMonth) {
    out.blocked = out.linkedMonth
      ? `미리보기가 ${hoLabel(out.linkedMonth)}에 연결되어 있습니다. ${hoLabel(month)}로 다시 연결하세요.`
      : '미리보기가 어느 호에 연결되어 있는지 읽지 못했습니다.'
  } else if (!out.activity) {
    out.blocked = '아직 저장소에 없는 학습코드입니다. 먼저 대화로 생성하세요.'
  }
  return out
}
