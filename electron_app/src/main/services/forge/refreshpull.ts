/**
 * **업데이트 받기 — 먼저 그대로 받고, git 이 거절할 때만 치워 두고 받는다** (2026-10-21) — `refresh.ts` 가 부른다.
 *
 * 스펙 · 배치표(`_spec` · `_layout`)가 고쳐져 있어도 먼저 그냥 `pull --ff-only` 한다. git 은 앞으로 감기에서
 * 받을 커밋이 안 건드리는 파일의 고친 내용을 그대로 둔다. 받을 커밋이 **고친 파일을 건드릴 때만** git 이 거절하고,
 * 그때만 `refreshstash.ts` 로 치워 두고 받는다.
 * 처음에는 고친 것이 있으면 늘 치워 두고 pull 했다. 그런데 치워 둔 동안(망을 타서 1분까지) 작업대가 배치표에 적으면
 * 되돌리기가 실패해 고친 내용이 stash 에만 남았다 — 앱만 쓰는 사람은 꺼낼 길이 없다. 그래서 치우는 일을 드물게 하고,
 * 치운 뒤에는 망을 타지 않는다 — 첫 pull 이 이미 받아 온 원격 가지(`@{u}`)로 `merge --ff-only` 만 한다(로컬이라 짧다).
 * 하던 일(`busy.ts`)이 있으면 치우기 직전에 한 번 더 멈춘다 — 첫 pull 이 도는 사이 대화가 시작됐을 수 있다.
 *
 * 왜 거절했나는 git 글이 아니라 **사실로** 가린다 — git 이 그 PC 의 말(한국어)로 답할 수 있다. 받을 커밋과 비교해
 *   - 바꾸는 파일이 고친 파일과 겹치면 → 치워 두고 받는다
 *   - 새로 더하는 파일과 같은 이름의 올리지 않은 파일이 있으면 → 그 이름을 대고 멈춘다(git 글이 영어로 새던 자리)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { git, isAncestor, tryGit } from '../../lib/git'
import { ASK_TIMEOUT, LITERAL, asideOf, bringBack, changes, setAside } from './refreshstash'

/** 받는 것은 망을 탄다 */
const PULL_TIMEOUT = 60_000
/** 치운 뒤의 앞으로 감기는 로컬이다 — 망을 안 탄다 */
const MERGE_TIMEOUT = 30_000

/**
 * 자격 증명이 없어 git 이 못 물었다 — 업데이트 확인(`checkUpdate`)과 받기가 같이 본다(공용 저장소 `commonpull.ts` 도).
 * 「could not read」만 보면 원격이 없을 때(「Could not read from remote repository」)도 로그인으로 읽었다 —
 * 2026-10-21 공용 저장소 시험에서 없는 원격 주소가 「로그인이 필요합니다」로 나와 이름 · 비밀번호를 못 읽은 때로 좁혔다
 */
export const needsLogin = (why: string): boolean => /could not read (?:Username|Password)|Authentication|terminal prompts disabled|credential/i.test(why)
export const LOGIN_NOTE = 'git 로그인이 필요합니다. 터미널에서 git pull 명령을 한 번 실행해 로그인하세요.'
const DIVERGED = '원격 저장소와 이력이 달라 업데이트하지 않았습니다. git 명령으로 직접 병합하세요.'

export const busyNote = (work: string[]): string => `하던 일이 있어 업데이트하지 않았습니다: ${work.join(', ')}. 끝난 뒤 다시 누르세요.`
export const dirtyNote = (n: number): string => `수정한 파일이 ${n}건 있어 업데이트하지 않았습니다. 커밋하거나 되돌린 뒤 다시 누르세요.`
const keptNote = (n: number): string => (n ? `직접 고친 스펙과 배치표 파일 ${n}개는 그대로 두었습니다.` : '')

export type Pulled = { ok: true; kept: string } | { ok: false; error?: string; note?: string }

/** `-z` 로 받은 이름들 — 한글 · 띄어쓰기 이름도 따옴표 없이 온다 */
const names = (out: string): string[] => out.split('\0').filter(Boolean)
const fullHead = async (repo: string): Promise<string> => (await git(repo, ['rev-parse', 'HEAD'], ASK_TIMEOUT)).trim()

/** 받을 커밋이 새로 더하는 파일 가운데 이미 있는 올리지 않은 파일 — git 은 이것을 덮지 않고 거절한다(무시하는 파일은 덮는다) */
async function untrackedOf(repo: string, added: string[]): Promise<string[]> {
  const there = added.filter((p) => existsSync(resolve(repo, p)))
  if (!there.length) return []
  return names(await git(repo, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...there], ASK_TIMEOUT, LITERAL))
}

/**
 * pull · merge 가 실패한 까닭. `overlap` 은 「받을 커밋이 고친 파일을 건드린다」 — 치워 두면 받을 수 있는 경우 하나뿐이다.
 * HEAD 가 그대로이고 원격 가지가 앞에 있을 때만 사실로 가리고, 아니면 git 글로 가린다(로그인 · 이력이 다름 · 그 밖).
 */
async function whyNot(repo: string, before: string, err: string): Promise<{ overlap: boolean; text: string }> {
  const said = err.replace(/\s+/g, ' ').trim()
  const fallback = needsLogin(err) ? LOGIN_NOTE : /fast-forward|diverg|갈라/i.test(err) ? DIVERGED : `업데이트하지 못했습니다: ${said}`
  const up = (await tryGit(repo, ['rev-parse', '-q', '--verify', '@{u}'], ASK_TIMEOUT)).out.trim()
  if (!up || up === before || (await fullHead(repo)) !== before) return { overlap: false, text: fallback }
  if (!(await isAncestor(repo, 'HEAD', '@{u}', ASK_TIMEOUT))) return { overlap: false, text: DIVERGED }
  const diff = ['diff', '--name-only', '--no-renames', '-z']
  const taken = await untrackedOf(repo, names(await git(repo, [...diff, '--diff-filter=A', 'HEAD', '@{u}'], ASK_TIMEOUT)))
  if (taken.length) {
    return { overlap: false, text: `받을 파일과 이름이 같은 파일이 있어 업데이트하지 않았습니다: ${taken.join(', ')}. 그 파일을 다른 폴더로 옮긴 뒤 다시 누르세요.` }
  }
  const incoming = new Set(names(await git(repo, [...diff, 'HEAD', '@{u}'], ASK_TIMEOUT)))
  const overlap = (await changes(repo)).some((c) => incoming.has(c.path))
  return { overlap, text: fallback }
}

/**
 * 받기. `aside` 는 고친 파일이 든 스펙 · 배치표 자리(`asideOf`) — 비었으면 고친 것이 없다. `prefixes` 는 그 자리를 다시 잴 때 쓴다.
 * 성공하면 `kept` 에 그대로 둔 고친 파일 한 줄(없으면 빈 글).
 */
export async function pullKeeping(repo: string, aside: string[], prefixes: string[], busy: () => string[]): Promise<Pulled> {
  const before = await fullHead(repo)
  const first = await tryGit(repo, ['pull', '--ff-only'], PULL_TIMEOUT)
  if (first.ok) return { ok: true, kept: aside.length ? keptNote((await changes(repo)).length) : '' }
  const why = await whyNot(repo, before, first.err)
  if (!why.overlap || !aside.length) return { ok: false, error: why.text }

  // 받을 커밋이 고친 스펙 · 배치표를 건드린다 — 이때만 치워 둔다. 그 사이 바뀐 것이 있을 수 있어 처음 조건을 다시 잰다
  const work = busy()
  if (work.length) return { ok: false, note: busyNote(work) }
  const now = await asideOf(repo, prefixes)
  if (!now.length) return { ok: false, note: dirtyNote((await changes(repo)).length) }
  const set = await setAside(repo, now)
  if (!set.stashed) return { ok: false, error: `직접 고친 스펙과 배치표 파일을 잠시 치워 두지 못해 업데이트하지 않았습니다. ${set.why ?? ''}`.trim() }
  const merged = await tryGit(repo, ['merge', '--ff-only', '--quiet', '@{u}'], MERGE_TIMEOUT)
  // 못 받았어도 치워 둔 것은 그대로 되돌려 놓는다 — 안 그러면 고친 배치표가 작업 폴더에서 사라진 채로 남는다
  const back = await bringBack(repo, now)
  if (!merged.ok) return { ok: false, error: [(await whyNot(repo, before, merged.err)).text, back.note].filter(Boolean).join(' ') }
  return { ok: true, kept: back.ok ? keptNote(set.count) : back.note }
}
