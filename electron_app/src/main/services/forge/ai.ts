/**
 * AI 를 부르는 **유일한 자리** (6단계).
 *
 * **`claude -p` 를 명령으로 부른다.** 이미 깔려 있고 이미 로그인돼 있어서
 * **API 키도 따로 과금도 없다** — 쓰던 계정 그대로다. 앱이 `checkRepro.ts` 와
 * `vite` 를 이미 명령으로 부르고 있으니 자리도 낯설지 않고, 키를 앱에 넣지
 * 않으니 커밋에 섞일 일도 없다(저장소 규칙: 인증서·키는 절대 커밋하지 않는다).
 *
 * **없으면 없다고 말한다.** `claude` 를 못 찾으면 브리프를 그대로 돌려주고
 * 사람이 붙여넣게 한다 — 막히지는 않는다.
 *
 * **껍데기를 벗겨서 부른다.** `claude -p` 는 부를 때마다 Claude Code 한 벌을
 * 통째로 다시 올린다 — 이 일은 「표 읽고 표로 답하기」뿐이라 그것이 하나도 안
 * 쓰인다. 벗기는 값과 잰 숫자는 `askFrom()`·`args()` 에 있다.
 *
 * **글을 그대로 돌려준다. 해석하지 않는다.** 받은 글을 짝으로 읽고 검산하는
 * 것은 `brief.ts` 의 몫이다. 여기는 부르고 받아 오기만 한다 — 얇은 어댑터다.
 */

import { execFile } from 'node:child_process'
import { toMessage } from '../../lib/errors'
import { AI_TIMEOUT, MAX_OUT, args, askFrom, type AgentReach } from './aiargs'
import { tapeKey } from './aimodel'
import { capSays, count } from './aitally'
import { tapeGet, tapeMiss, tapeMode, tapePut } from './tape'

/** 그 상한을 초로. **걸음이 「몇 초째 / 최대 몇 초」를 보여 줄 때 쓴다** — 두 벌로 적지 않는다. */
export const AI_SECONDS = AI_TIMEOUT / 1000

/**
 * **Claude Code 에 로그인이 안 돼 있다** (2026-10-01) — 깔기만 하고 로그인을 안 했거나, 로그인이 풀렸을 때.
 * `claude -p` 는 영어 한 줄(「Invalid API key · Please run /login」 따위)을 답 자리나 오류에 낸다 — 그대로 보이면 무슨 일인지 모른다.
 * 초기 설정의 확인(`setup.ts`)도 같은 문장을 쓴다
 */
export const CLAUDE_LOGIN_NOTE = 'Claude Code에 로그인되어 있지 않습니다. 터미널에서 claude를 실행해 로그인한 뒤 다시 시도하세요.'
// 2026-10-02 「Failed to authenticate: OAuth session expired and could not be refreshed」가 빠져 명령줄 전체가 화면에 떴다
const LOGIN = /please run \/login|run \/login|not logged in|invalid api key|authentication_error|failed to authenticate|oauth (token|session) (has )?expired|login required/i
/** 짧은 글만 본다 — 긴 답 안에 우연히 그 낱말이 있어도 로그인 오류로 읽지 않게 */
export const saysLogin = (text: string): boolean => text.length < 600 && LOGIN.test(text)

export interface AiReply {
  ok: boolean
  /** 받은 글 그대로 */
  text: string
  /** 안 됐으면 왜 */
  error: string
  /** `claude` 를 아예 못 찾았나 — 화면이 「손으로 붙여넣기」로 갈린다 */
  missing: boolean
  /** 걸린 시간(ms) */
  took: number
  /** claude 가 적어 준 토큰 넷. 녹음에서 온 옛 답 · 못 푼 답이면 없다 — **어림으로 채우지 않는다** */
  usage?: AiUsage
  /** claude 가 적어 준 값(달러). 없으면 모름 */
  cost?: number
}

export interface AiUsage {
  input: number
  cacheWrite: number
  cacheRead: number
  output: number
}

// 부른 값의 합(`aiTally`)과 상한은 `aitally.ts` — 부르는 쪽이 여기서 받아 가던 이름 그대로 내보낸다
export { aiTally, spentSince } from './aitally'

/**
 * `--output-format json` 한 줄을 푼다. **못 풀면 받은 글 그대로** — 예전 꼴 답(녹음)이나
 * 깨진 줄이 와도 짝 읽기(`pairs.ts`)가 전처럼 돈다.
 */
function unwrap(stdout: string): { text: string; usage?: AiUsage; cost?: number } {
  const t = stdout.trim()
  if (!t.startsWith('{')) return { text: stdout }
  try {
    const j = JSON.parse(t) as {
      result?: unknown
      total_cost_usd?: number
      usage?: { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number }
    }
    if (typeof j.result !== 'string') return { text: stdout }
    const u = j.usage
    return {
      text: j.result,
      cost: typeof j.total_cost_usd === 'number' ? j.total_cost_usd : undefined,
      usage: u
        ? {
            input: u.input_tokens ?? 0,
            cacheWrite: u.cache_creation_input_tokens ?? 0,
            cacheRead: u.cache_read_input_tokens ?? 0,
            output: u.output_tokens ?? 0
          }
        : undefined
    }
  } catch {
    return { text: stdout }
  }
}

/**
 * 브리프를 주고 답을 받는다.
 *
 * **브리프는 인자가 아니라 stdin 으로 넣는다.** 명령줄에 실으면 길이 한계에
 * 걸리고, 따옴표가 든 글이 셸에 먹힌다.
 *
 * `lookIn` 을 주면 **그 폴더의 그림을 보고 답한다.** 리소스 이름이 figma 에서
 * 온 그대로(`Group 27.png`)라 이름으로는 아무것도 알 수 없을 때 쓴다 (`name.ts`).
 *
 * **`cwd` 가 곧 울타리다.** `claude` 는 파일 도구를 작업 폴더 안으로 묶으므로,
 * 리소스 폴더를 `cwd` 로 주면 그 밖은 못 읽는다. 브리프에는 **파일 이름만**
 * 적는다(경로 말고) — 그래야 울타리 밖을 가리킬 길이 없다.
 */
/** @param agent 맡기기(`agent.ts`) — 읽기 도구 셋과 더 읽을 폴더. 녹음 열쇠는 브리프라 그대로 녹음 · 재생된다 */
export function askAi(brief: string, lookIn?: string, agent?: AgentReach): Promise<AiReply> {
  // **녹음을 먼저 본다** (2026-09-23, `tape.ts`). 꺼져 있으면 `null` 이라
  // 아래로 그냥 흐른다 — 앱은 전과 똑같이 돈다.
  const mode = tapeMode()
  if (mode !== 'off') {
    const kept = tapeGet(tapeKey(brief), lookIn)
    if (kept) return Promise.resolve(kept)
    // `strict` 는 **안 부른다.** 「물음이 그대로인가」를 보는 자리라, 여기서
    // 몰래 부르면 그 물음에 답이 되어 버린다.
    if (mode === 'strict') return Promise.resolve(tapeMiss(tapeKey(brief), lookIn))
  }
  // **상한은 부르기 직전에 본다** (M5, `aitally.ts`) — 녹음 재생은 돈이 안 나가 위에서 먼저 흘려보냈다
  const stop = capSays()
  if (stop) return Promise.resolve({ ok: false, text: '', error: stop, missing: false, took: 0 })
  const at = Date.now()
  return new Promise<AiReply>((done) => {
    let child: ReturnType<typeof execFile>
    try {
      child = execFile(
        'claude',
        args(Boolean(lookIn), agent),
        {
          timeout: agent?.timeout ?? AI_TIMEOUT,
          maxBuffer: MAX_OUT,
          windowsHide: true,
          shell: process.platform === 'win32',
          // **늘 정해 준다** — 안 주면 42KB `CLAUDE.md` 가 올라간다 (`askFrom`).
          cwd: askFrom(lookIn)
        },
        (error, stdout, stderr) => {
          const took = Date.now() - at
          if (error) {
            const why = toMessage(error)
            // 못 찾은 것과 답을 못 낸 것은 다르다. 앞쪽은 사람이 붙여넣으면 된다.
            const missing = /ENOENT|not found|not recognized|찾을 수 없습니다/i.test(
              why + String(stderr ?? '')
            )
            // **시간 초과를 따로 말한다.** `execFile` 은 상한에 걸리면 자식을
            // 죽이고 `Command failed` 만 남긴다 — 그대로 보이면 「AI 가 못
            // 했다」로 읽힌다. 실제로는 **다시 부르면 되는 것**이다.
            // 2026-09-15 에 겹쳐 돌린 기록에서 이 갈래가 드러났다: 같은 차시가
            // 한 번은 0자리, 한 번은 22자리였고 앞쪽이 180초에 끊긴 것이었다.
            const timedOut = !missing && (error as { killed?: boolean }).killed === true
            const said = unwrap(String(stdout ?? '')).text.trim()
            const login = !missing && !timedOut && saysLogin(`${said}\n${String(stderr ?? '')}`)
            done({
              ok: false,
              text: String(stdout ?? ''),
              error: missing
                ? 'claude 명령을 찾지 못했습니다. 아래 브리프를 Claude Code 에 붙여넣고 답을 받아 오세요.'
                : login
                  ? CLAUDE_LOGIN_NOTE
                  : timedOut
                  ? `AI 가 ${Math.round((agent?.timeout ?? AI_TIMEOUT) / 1000)}초 안에 답하지 않아 중단했습니다. 다시 시도하세요. 항목이 아주 많으면 자주 발생합니다.`
                  : // 명령줄 전체(`Command failed: claude -p …`)보다 claude 가 답 자리에 준 까닭이 읽힌다
                    `AI 를 호출하지 못했습니다: ${said && said.length < 600 ? said : why}`,
              missing,
              took
            })
            return
          }
          const got = unwrap(String(stdout ?? ''))
          // 로그인 오류는 종료 코드 0 으로 답 자리에 올 때도 있다 — 답으로 읽으면 「못 읽은 답」이 된다
          if (saysLogin(got.text)) {
            done({ ok: false, text: got.text, error: CLAUDE_LOGIN_NOTE, missing: false, took })
            return
          }
          done({ ok: true, ...got, error: '', missing: false, took })
        }
      )
    } catch (error) {
      done({ ok: false, text: '', error: toMessage(error), missing: true, took: Date.now() - at })
      return
    }

    try {
      child.stdin?.end(brief, 'utf8')
    } catch {
      // stdin 이 벌써 닫혔으면 위 콜백이 까닭을 들고 온다.
    }
  }).then((reply) => {
    // **답이 온 뒤에 녹음한다.** 꺼져 있으면 아무 일도 안 한다.
    if (mode !== 'off') tapePut(tapeKey(brief), lookIn, reply)
    // 못 찾은 것(`missing`)은 부른 것이 아니다 — 돈이 안 나갔다
    if (!reply.missing) count(reply)
    return reply
  })
}
