/**
 * **내 것 · 남의 것** — 그 학습코드를 누가 끝냈나 (2026-10-14 사용자 결정). 판단은 여기 한 곳이다.
 *
 * 그전에는 다섯 곳(검수 완료 · 커밋 · 안 쓰는 리소스 · 리소스 폴더 정리 · 초기화)이 activityInfo 를 따로 읽고 **팀만** 봤다 —
 * 같은 팀(my-team) 다른 사람이 끝낸 지난 호 학습코드(4호에 다른 개발자가 끝낸 학습코드 같은 것)는 못 가려 검수 완료가 만든 사람 · 날짜를 나로 바꿀 수 있었다.
 * 대화 시작은 아예 안 봤다. 그래서 만든 사람까지 보고 한 곳에서 판단한다.
 *
 * - `mine` — 개발 완료이고 activityInfo 의 만든 사람과 팀이 둘 다 비지 않았고 설정(.user.json)과 둘 다 같다
 * - `theirs` — 개발 완료인데 내 것이 아니다. 메인이 빗장이다 — 검수 완료 · 커밋 · 휴지통 · 대화 시작이 `force` 없이는 안 한다
 * - 개발 완료가 아니면 둘 다 false — 만드는 중인 9호 학습코드는 막지 않는다
 * - **다른 팀이 만드는 중인 칸**(`otherTeam`)은 따로 본다 — 9호 KO 협력사 29칸처럼 팀이 적혔는데 개발 완료가 아닌 칸.
 *   2026-09-29 에 KOL1M07W1S1 검수 완료가 만든 사람을 내 이름으로 갈았다. 이것은 `force` 로 못 푼다(전과 같다)
 *
 * 작업 트리의 activityInfo 를 본다(지금 파일). 마지막 커밋의 것은 `committedInfo` — 커밋 문구 고르기 · 학습코드 초기화가 본다.
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Owner } from '../../../shared/forge'
import { git } from '../../lib/git'
import type { Forge } from './runtime'
import { repoOf } from './writecheck'

export type { Owner }

type Info = { devFinished?: unknown; finishedDate?: unknown; devTeam?: unknown; developer?: unknown }

const str = (x: unknown): string => (typeof x === 'string' ? x.trim() : '')

/** activityInfo 한 벌 → 주인. `me` 는 설정의 만든 사람 · 팀. 마지막 커밋의 것(`committedInfo`)도 이것으로 가른다 */
export function ownerFrom(info: Info | null, me: { developer: string; devTeam: string }): Owner {
  const finished = info === null ? null : info.devFinished === true
  const developer = str(info?.developer)
  const devTeam = str(info?.devTeam)
  const mine = finished === true && Boolean(developer && devTeam) && developer === str(me.developer) && devTeam === str(me.devTeam)
  return { finished, developer, devTeam, finishedDate: str(info?.finishedDate), mine, theirs: finished === true && !mine }
}

/** 호 저장소 작업 트리의 activityInfo — 없으면 개발 완료가 아닌 것, 못 읽으면 `finished: null`(남의 것으로도 안 친다) */
export function ownerOf(forge: Forge, code: string): Owner {
  return ownerAt(repoOf(forge.paths, code), code, forge.user.loadUser())
}

/** 저장소 뿌리를 받는 쪽 — 「main 에 모두 올리기」(`hallsyncplan.ts`)가 저장소마다 부르고, 시험 저장소로도 돌린다 */
export function ownerAt(repo: string, code: string, me: { developer: string; devTeam: string }): Owner {
  const at = path.join(repo, 'src', 'activity', code, 'activityInfo.json')
  let info: Info | null = {}
  if (repo && fs.existsSync(at)) {
    try {
      info = JSON.parse(fs.readFileSync(at, 'utf8')) as Info
    } catch {
      info = null
    }
  }
  return ownerFrom(info, me)
}

/**
 * 남이 끝냈을 때 보일 한 문장 — 작업대 경고와 막은 까닭이 같은 글을 쓴다. 남의 것이 아니면 빈 글.
 * 만든 사람 이름에 이미 괄호가 든다(`seokho.yu(유석호)`) — 팀은 한 칸 띄어 붙인다
 */
export function ownerLine(o: Owner): string {
  if (!o.theirs) return ''
  const who = o.developer && o.devTeam ? `${o.developer} (${o.devTeam}) 님이` : o.developer ? `${o.developer} 님이` : o.devTeam ? `${o.devTeam} 팀이` : '다른 사람이'
  return `${who} ${o.finishedDate ? `${o.finishedDate}에 ` : ''}끝낸 학습코드입니다.`
}

/** 다른 팀이 만드는 중인 칸인가 — 그 팀 이름, 아니면 빈 글. 팀이 안 적혔으면(빈 뼈대 · 우리가 만드는 중) 빈 글 */
export function otherTeam(o: Owner, myTeam: string): string {
  return o.finished !== true && o.devTeam && o.devTeam !== str(myTeam) ? o.devTeam : ''
}

/** 마지막 커밋의 activityInfo — 지금 파일은 검수 완료를 잘못 눌렀어도 되돌릴 대상이라 커밋한 것을 본다. 없거나 못 읽으면 null */
export async function committedInfo(repo: string, code: string): Promise<Info | null> {
  try {
    return JSON.parse(await git(repo, ['show', `HEAD:src/activity/${code}/activityInfo.json`], 30_000)) as Info
  } catch {
    return null
  }
}

/** 작업대가 보는 주인 형편 — 경고 한 문장과 마지막 커밋에서도 개발 완료인가(「수정사항 커밋」) */
export async function ownerFor(forge: Forge, code: string): Promise<Owner & { line: string; committed: boolean }> {
  const o = ownerOf(forge, code)
  const repo = repoOf(forge.paths, code)
  const committed = repo && fs.existsSync(path.join(repo, '.git')) ? (await committedInfo(repo, code))?.devFinished === true : false
  return { ...o, line: ownerLine(o), committed }
}
