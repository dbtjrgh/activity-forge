/**
 * **공용 폴더가 작업 폴더 밖일 때 미리보기 연결을 잇는다** (2026-10-23).
 *
 * sparkon CLI 는 공용 폴더 설정(`.user.json` 의 commonRoot)을 모르고 늘 **작업 폴더 안** `sparkon_common` 을 본다.
 * `link` 는 그 폴더가 없으면 「먼저 clone부터」로 멈추고(`link_activity`), `init` 은 그 자리에 공용 저장소를 하나 더 받는다.
 * CLI 는 팀 저장소라 고치지 않는다(2026-10-16 결정). 대신 「연결」을 누를 때 그 자리에 공용 폴더로 가는 정션을 먼저 건다 —
 * 그러면 CLI 가 거는 `src/_common` · `sparkon_common/node_modules` 가 그 정션을 거쳐 공용 폴더에 닿는다.
 *
 * - **그 자리에 아무것도 없을 때만 건다.** 진짜 폴더가 있으면 건드리지 않는다. 다른 곳을 가리키거나 끊어진 정션도 그대로 둔다 —
 *   정션은 지워도 내용이 안 사라지지만 사람이 일부러 둔 것일 수 있다(저장소 CLAUDE.md 6번). 그때 미리보기 점검(`viewcheck.ts`)이
 *   「연결」 단추 대신 그 자리에 무엇이 있는지(`homeTaken`) 알린다. 사람이 그 정션을 치우면 다음 「연결」이 건다
 * - 공용 폴더에 `_common/module` 이 없으면 안 건다 — 빈 곳을 가리키는 정션은 없느니만 못하다(`setCommonRoot` 와 같은 기준)
 * - 정션은 관리자 권한이 필요 없다. 건 뒤 실제 경로로 다시 잰다. 공용 폴더로 이어지지 않으면(정션은 내 컴퓨터 볼륨만 가리킨다 —
 *   네트워크 드라이브의 공용 폴더) 방금 건 정션을 바로 걷는다. 남겨 두면 그 뒤로는 「다른 폴더를 가리킨다」로만 보인다
 * - 부르는 곳은 `link.ts` 하나다 — 사람이 「연결」을 누를 때만. 처음 설정(`setupprep.ts`)은 작업 폴더 안 sparkon_common 이
 *   있어야 시작하고(`setuprepos.ts`) 공용 폴더 설정은 「마치기」 뒤에 생기니 부를 일이 없다
 * - **CLI 는 이 정션을 거쳐 공용 폴더를 직접 고친다**(sparkon_cli `make_symlink` 를 읽어 봄) — 링크를 걸기 전에
 *   `shell.rm('-rf', <링크 자리>)` 를 먼저 한다. shelljs 는 정션이면 링크만 떼지만(`lstat` 으로 봄), 공용 폴더의 `node_modules` 가
 *   진짜 폴더(그 폴더에서 `yarn install` 을 한 것)면 휴지통 없이 지운다. 그래서 공용 폴더를 밖에 두었고 그 폴더가 진짜 폴더면
 *   `link.ts` 가 CLI 를 부르지 않고 멈춘다(`realModules`). 작업 폴더 안 기본 자리는 여태대로 CLI 에 맡긴다
 * - 확인 안 함: 개발자 모드 PC 는 CLI 가 정션 대신 상대 경로 symlink 를 건다. `sparkon_common/node_modules` 의 상대 경로가
 *   이 정션 너머(공용 폴더)에서 풀리면 끊어진다 — 그때는 연결 뒤 다시 재는 `viewCheck` 가 「연결 없음」으로 알린다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync, lstatSync, readlinkSync, realpathSync, rmdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { toMessage } from '../../lib/errors'

export type CommonLink = { ok: boolean; made: boolean; why: string }

const real = (p: string): string => {
  try {
    const r = realpathSync(p)
    return process.platform === 'win32' ? r.toLowerCase() : r
  } catch {
    return ''
  }
}

/**
 * `home`(작업 폴더 안 sparkon_common 자리)에 무엇이 있나 — 비었으면 빈 글, 아니면 「…있어」로 끝나는 까닭 앞머리.
 * 정션(끊어진 것도)은 가리키는 곳을 같이 댄다
 */
export function homeTaken(home: string): string {
  try {
    if (!lstatSync(home).isSymbolicLink()) return '작업 폴더 안에 다른 sparkon_common 폴더가 있어'
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? '' : `작업 폴더 안의 sparkon_common 폴더를 읽지 못해(${toMessage(error)})`
  }
  let at = ''
  try {
    at = readlinkSync(home)
  } catch {
    // 못 읽으면 가리키는 곳 없이 알린다
  }
  return `작업 폴더 안의 sparkon_common 폴더가 다른 폴더${at ? `(${at})` : ''}를 가리키고 있어`
}

/** 공용 폴더의 `node_modules` 가 링크가 아닌 진짜 폴더인가 — 그러면 CLI 가 「연결」 때 휴지통 없이 지운다 */
export function realModules(dir: string): boolean {
  try {
    const s = lstatSync(join(dir, 'node_modules'))
    return s.isDirectory() && !s.isSymbolicLink()
  } catch {
    return false
  }
}

/** `home`(작업 폴더 안 sparkon_common)이 `dir`(쓰는 공용 폴더)로 이어지게 — 이미 이어져 있으면 아무것도 안 한다 */
export function commonLink(home: string, dir: string): CommonLink {
  const to = real(dir)
  if (!to) return { ok: false, made: false, why: `공용 폴더가 없습니다: ${dir}` }
  // 같은 자리이거나 이미 그리로 가는 정션
  if (real(home) === to) return { ok: true, made: false, why: '' }
  const taken = homeTaken(home)
  if (taken) return { ok: false, made: false, why: `${taken} 연결하지 않았습니다.` }
  if (!existsSync(join(dir, '_common', 'module'))) return { ok: false, made: false, why: '공용 폴더 안에 _common/module 폴더가 없어 연결하지 않았습니다.' }

  try {
    symlinkSync(realpathSync(dir), home, 'junction')
  } catch (error) {
    return { ok: false, made: false, why: `작업 폴더 안에 공용 폴더로 가는 연결을 만들지 못했습니다: ${toMessage(error)}` }
  }
  if (real(home) === to) return { ok: true, made: true, why: '' }
  // 방금 건 정션만 걷는다 — 정션을 지우면 가리키던 폴더는 그대로다
  try {
    rmdirSync(home)
  } catch {
    return { ok: false, made: true, why: '작업 폴더 안에 연결을 만들었지만 공용 폴더를 가리키지 않습니다.' }
  }
  return { ok: false, made: false, why: '작업 폴더 안에 공용 폴더로 가는 연결을 만들지 못했습니다.' }
}
