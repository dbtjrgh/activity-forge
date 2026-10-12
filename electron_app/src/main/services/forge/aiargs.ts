/**
 * `claude -p` 를 **무엇으로 부르나** — 인자 · 모델 · 빈 폴더 · 시간 상한 (2026-09-28 에 `ai.ts` 에서 옮김, 동작 변화 없음).
 *
 * 부르고 받는 일은 `ai.ts`, 어느 모델인지는 `aimodel.ts` 에 있다. 여기는 **재서 정한 값**과 그 까닭만 둔다 — 값마다 잰 숫자가 머리말에 있다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MODEL } from './aimodel'

/**
 * **양산이 부르는 `claude` 에는 사람용 설정을 물려주지 않는다** (2026-09-21).
 *
 * `claude -p` 는 그 컴퓨터의 `~/.claude/settings.json` 을 그대로 읽는다.
 * 이 PC 에는 **`advisorModel: fable`** 이 켜져 있었다 — 대화할 때 답을 한 번 더
 * 검토해 주는 기능인데, **양산이 부르는 부름에도 똑같이 붙어 있었다.**
 *
 * 재서 확인했다 (`--output-format json` 의 `iterations`). 자리 15개를 묻는
 * 부름 하나에 —
 *
 * | | 붙어 있을 때 | 떼어냈을 때 |
 * |---|---|---|
 * | 값 | **$0.356** | **$0.030** |
 * | 얹히는 것 | `advisor_message` 가 들어옴 (`claude-fable-5-1`, 들어온 글 14,140 · 나간 글 3,700토큰) | 없음 |
 *
 * **한 부름에 값이 12배였다.** 표 몇 줄을 맞추는 일에 큰 모델이 한 번 더
 * 읽고 쓴 것이다 — 양산에는 쓸모가 없다(짝이 맞는지는 `pairs.ts` 가 검산한다).
 *
 * **사람 설정은 건드리지 않는다.** 대화할 때는 그 기능이 쓸모가 있으므로
 * `settings.json` 을 고치는 대신, **이 부름에만** 겹쳐 씌운다.
 * 셸을 거치는 Windows 에서 JSON 을 인자로 실으면 따옴표가 먹히므로
 * (`quoted` 머리말) **파일로 써서 자리만 넘긴다.**
 */
let leanFile = ''
export function leanSettings(): string {
  if (!leanFile) {
    const dir = mkdtempSync(join(tmpdir(), 'forge-set-'))
    leanFile = join(dir, 'settings.json')
    writeFileSync(leanFile, JSON.stringify({ advisorModel: 'none' }), 'utf8')
  }
  return leanFile
}

/**
 * **`claude` 를 부를 빈 폴더.**
 *
 * `claude` 는 **작업 폴더에서 위로 올라가며 `CLAUDE.md` 를 찾아 통째로 올린다.**
 * `--system-prompt` 로 시스템 프롬프트는 벗겨지지만 이것은 안 벗겨진다.
 * 이 저장소의 `CLAUDE.md` 는 42KB 라, **물음 한 줄에도 23,824토큰($0.238)** 이
 * 나가고 있었다. 빈 폴더에서 같은 물음이 **747토큰($0.008)** 이다 —
 * **고정 비용의 97%가 이것이었다** (2026-09-17 에 `forge/src/tool/tokens.ts` 로 잼).
 *
 * 실제 브리프(스펙 한 장)로도 **29,094 → 6,012토큰 · $0.291 → $0.060** 이다.
 *
 * `--bare` 가 이것을 끄지만 **`ANTHROPIC_API_KEY` 를 요구한다** — 이 팀은 로그인한
 * 계정을 그대로 쓰므로 못 쓴다. 그래서 **폴더를 옮겨 부른다.**
 *
 * 그림을 볼 때(`lookIn`)는 그 리소스 폴더가 곧 울타리라 그대로 쓴다. 그쪽 호
 * 저장소의 `CLAUDE.md` 는 2.4KB 라 값이 거의 안 붙는다(재서 확인했다).
 */
let emptyDir = ''
export function askFrom(lookIn?: string): string {
  if (lookIn) return lookIn
  if (!emptyDir) emptyDir = mkdtempSync(join(tmpdir(), 'forge-ai-'))
  return emptyDir
}

/**
 * AI 한 번에 줄 시간. 글만 주면 짝 쉰 줄이 보통 30초 안쪽이다.
 * **넘으면 끊고 그렇다고 말한다** — 화면을 붙잡아 두지 않는다.
 *
 * **180초에서 300초로 늘렸다** (2026-09-21). 재서 늘린 것이다 —
 * `MAL2M07W2S1` 을 figma 화면 한 장과 함께 돌렸더니 **짜임 묻기가 180초에
 * 끊겼다**(`_recipe/MAL2M07W2S1.shape.txt`). 그림을 열어 칸을 세는 일은
 * 글만 읽는 것보다 오래 걸리는데, 화면이 **기본 입력**이 된 뒤로는
 * (`shotfirst.ts`) 그것이 보통이 되었다. 끊기면 그 걸음은 통째로 날아가고
 * 토큰만 나간다 — 기다리는 것이 싸다.
 *
 * **300초에서 450초로 늘렸다** (2026-09-28). 기획서가 붙은 뒤로 값 고치기 묶음마다 21쪽 PDF 를
 * 연다. MAL2M07W2S1 을 다섯 판 돌리니 끝난 묶음은 모두 83~256초였는데 **판마다 딱 하나가**
 * 300초에 끊겼고, 그 묶음에 든 정답표가 원본 값으로 남았다. 늘린 만큼 걸음의 최악 시간도 는다.
 */
export const AI_TIMEOUT = 450_000

/** 받은 글의 상한. 표 쉰 줄이면 몇 KB 다 — 이보다 크면 뭔가 잘못된 것이다. */
export const MAX_OUT = 1_000_000

/**
 * 기본 프롬프트 대신 쓸 한 줄. **껍데기를 벗기는 값의 절반이 여기다.**
 *
 * **따옴표(`"`)를 넣지 않는다.** 아래 `quoted()` 가 이 글을 따옴표로 감싸므로
 * 안에 또 들어가면 명령이 그 자리에서 끊긴다.
 */
// **마지막 문장이 「확신이 없으면 그 줄을 아예 쓰지 않는다」였다** (2026-09-21 에
// 고침). 브리프에는 「모르면 `?` 로 답하라」고 적어 두고 시스템 프롬프트가
// **정반대를 시키고 있었다** — 둘이 부딪히면 이쪽이 이긴다. `MAL2M07W2S1` 에서
// 71자리 가운데 58자리가 아무 말 없이 빠진 데는 이 줄의 몫이 있다.
// **짧게 답하라고도 시킨다** — 나가는 글이 곧 기다리는 시간이다.
const SYSTEM =
  '너는 양산 도구가 부르는 자리다. 준 글만 보고, 시킨 꼴 그대로만 답한다. ' +
  '머리말·맺음말·마크다운을 붙이지 않는다. 시킨 칸만 채우고 군말을 붙이지 않는다. ' +
  '모르는 것은 빼먹지 말고 시킨 꼴로 모른다고 적는다.'

/** 맡기기가 더 읽을 폴더 — 작업 폴더(리소스 폴더) 밖에서 **읽기만** 한다 */
/** `timeout` — 통째로 맡기기(`whole.ts`)는 그림 수십 장을 열어 한 판에 몇 분이 걸린다. 비면 `AI_TIMEOUT` */
export type AgentReach = { dirs: string[]; timeout?: number }

/**
 * 껍데기를 벗기는 인자. **재 보고 넣었다** (2026-09-15).
 *
 *   `--tools none`         Bash·Read 가 필요 없는 일이다. 도구 스키마가 제일 크다
 *   `--strict-mcp-config`   붙어 있는 MCP 서버의 도구 서른 개를 안 올린다
 *   `--system-prompt`       기본 프롬프트와 `CLAUDE.md` 대신 위 한 줄
 *   `--model`               위 `MODEL` — 계정 설정을 따라가지 않게
 *
 * 재 본 값 — **55,199 → 14,830토큰 · $0.24 → $0.15.** 계정이 팀 공용이다.
 */
export function args(look: boolean, agent?: AgentReach): string[] {
  // **그림을 보여 줄 때만 `Read` 를 연다.** 프롬프트에 파일 이름을 적으면 스스로
  // 읽는다 — `--tools none` 이면 못 읽는다. 열어도 **`Read` 하나뿐**이라 껍데기가
  // 거의 안 늘어난다: 재 보니 그림 여섯 장을 물어도 $0.08 이었다 (2026-09-15).
  // **맡기기(`agent.ts`)는 읽기 도구 셋과 폴더 몇 개를 더 연다** — 채팅처럼 폴더를 뒤져 견줘야 한다. 쓰기 · Bash 는 안 연다
  const tools = agent
    ? ['--tools', 'Read,Glob,Grep', ...agent.dirs.flatMap((d) => ['--add-dir', quoted(d)])]
    : look
      ? ['--tools', 'Read']
      : ['--tools', 'none']
  return [
    '-p',
    // **토큰과 값을 실제로 받는다** (2026-09-28, M2). 전에는 브리프 글자 수로 어림해
    // MAL2 한 판이 3,191토큰으로 적혔는데, 값 고치기 브리프 하나가 약 76K 였다.
    // 답 글은 JSON 의 `result` 에 온다 — 푸는 것은 `ai.ts` 의 `unwrap`.
    '--output-format',
    'json',
    ...tools,
    '--model',
    MODEL,
    '--strict-mcp-config',
    // 사람용 설정(조언자 모델)을 이 부름에서만 떼어낸다 — 위 `leanSettings` 참고.
    '--settings',
    quoted(leanSettings()),
    '--system-prompt',
    quoted(SYSTEM)
  ]
}

/**
 * 셸을 거칠 때만 따옴표를 씌운다.
 *
 * **Windows 에서는 셸을 거친다** — `claude` 가 `.cmd` 라 `execFile` 이 직접 못
 * 띄운다. 그런데 `shell: true` 면 Node 가 인자를 **그냥 띄어쓰기로 이어 붙이고
 * 따옴표를 씌워 주지 않는다.** 그래서 씌우지 않으면 첫 띄어쓰기에서 잘린다 —
 * 오류가 아니라 **앞 한 토막만 시스템 프롬프트로 가고 나머지는 사라진다.**
 * 2026-09-15 에 재서 확인했다(표시 글자를 문장 끝에 두고 대조).
 */
export function quoted(text: string): string {
  return process.platform === 'win32' ? `"${text.replace(/"/g, '')}"` : text
}

