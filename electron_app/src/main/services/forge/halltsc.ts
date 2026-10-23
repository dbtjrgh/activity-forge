/**
 * **호 저장소 타입 검사** — `vue-tsc --noEmit`(재 보니 10~13초). `chatfinish.ts` 에서 뗐다(2026-10-14) — 대화가 끝날 때만 돌았는데
 * 검수 완료 · 양산 완료 커밋도 하기 직전에 같은 검사를 돌린다. 사람이 대화 뒤에 손으로 고친 것은 아무도 다시 안 쟀다.
 *
 * - `lines` — **이 학습코드 폴더에서 난 오류만**. 이것만 막는다 — 남의 폴더 오류는 우리 탓이 아니다
 * - `common` — 공용 모듈(`src/_common/`) 오류. 막지 않고 경고로 보인다 — 배포 빌드(`vue-tsc -b`)는 이것으로도 실패한다.
 *   `src/_common` 은 `sparkon_common/_common` 을 가리키는 정션인데, 정션을 넣은 시험 프로젝트에서 오류 줄은 `src/_common/…` 으로 나왔다(2026-10-14).
 *   진짜 경로로 나올 때를 위해 `sparkon_common/` 도 본다
 * - **검사를 못 돌린 것은 오류와 따로 둔다**(`ran: false` · `why`) — 처음에는 못 돌린 것을 「통과」로, 프로그램이 없는 것을 「타입 오류」로 AI 에게 세 번 맡겼다
 * - **앱의 실행 파일을 node 로 쓴다**(`view.ts` · `repro.ts` 와 같은 길) — `.cmd` 를 셸로 부르면 PATH 의 node 에 기대고,
 *   오류 글이 CP949 로 깨지고, 시간 초과에 cmd 만 죽어 손주 node 가 남는다. 비동기라 메인 스레드를 안 잡는다
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const TSC_TIMEOUT = 180_000

export type HallTsc = { ran: boolean; ok: boolean; lines: string[]; common: string[]; why?: string }

const isCommon = (l: string): boolean => /(^|\/)src\/_common\//.test(l) || l.includes('sparkon_common/')

const binOf = (hall: string): string => path.join(hall, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js')

/** 타입 검사 프로그램이 없으면 그 까닭 — 「main 에 모두 올리기」 계획(`hallsyncplan.ts`)도 이것으로 미리 말한다(찾는 자리가 두 벌이었다) */
export const vueTscMissing = (hall: string): string =>
  fs.existsSync(binOf(hall)) ? '' : '호 저장소에 타입 검사 프로그램(vue-tsc)이 없습니다. 호 저장소에서 yarn 을 먼저 실행하세요.'

/** `hall` 호 저장소 뿌리, `code` 학습코드. 이 학습코드 오류가 없고 돌았으면 `ok` */
export function hallTsc(hall: string, code: string): Promise<HallTsc> {
  const bin = binOf(hall)
  const missing = vueTscMissing(hall)
  if (missing) return Promise.resolve({ ok: false, ran: false, lines: [], common: [], why: missing })
  return new Promise((done) => {
    execFile(
      process.execPath,
      [bin, '--noEmit', '-p', 'tsconfig.app.json'],
      {
        cwd: hall,
        timeout: TSC_TIMEOUT,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', FORCE_COLOR: '0' }
      },
      (error, stdout, stderr) => {
        const all = `${stdout ?? ''}\n${stderr ?? ''}`.split(/\r?\n/).filter((l) => /error TS\d+/.test(l))
        const slash = (l: string): string => l.replace(/\\/g, '/')
        const lines = all.filter((l) => slash(l).includes(`src/activity/${code}/`))
        const common = all.filter((l) => isCommon(slash(l)))
        // 오류가 있으면 vue-tsc 는 0 이 아닌 코드로 끝난다 — 오류 줄을 읽었으면 돈 것이다
        if (!error || all.length) return done({ ok: lines.length === 0, ran: true, lines, common })
        const e = error as { killed?: boolean; code?: number | string }
        if (e.killed) return done({ ok: false, ran: false, lines: [], common: [], why: `타입 검사가 ${TSC_TIMEOUT / 60000}분 안에 끝나지 않았습니다.` })
        const said = `${stderr ?? ''}`.trim().split(/\r?\n/)[0]?.slice(0, 200) ?? ''
        done({ ok: false, ran: false, lines: [], common: [], why: `타입 검사를 실행하지 못했습니다(종료 코드 ${e.code ?? '알 수 없음'}).${said ? ` ${said}` : ''}` })
      }
    )
  })
}

/** 하기 직전 검사가 막는 까닭 한 문장 — 비면 해도 된다. 검수 완료 · 커밋이 같은 말을 쓴다 */
export function tscBlock(t: HallTsc, what: string): string {
  if (!t.ran) return `타입 검사를 실행하지 못해 ${what}하지 않았습니다. ${t.why ?? ''}`.trim()
  return t.lines.length ? `이 학습코드에 타입 오류가 ${t.lines.length}개 있어 ${what}하지 않았습니다. 대화로 고치거나 직접 고친 뒤 다시 누르세요.` : ''
}
