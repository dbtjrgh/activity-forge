/**
 * **화면이 먼저다** — AI 를 부르기 전에 figma 화면이 있는지 본다 (2026-09-21).
 *
 * 2026-09-17 의 틀은 「AI 가 곤란해하면 **그때서야** 화면을 요구한다」였다.
 * 뒤집었다. 사용자 말 그대로 —
 *
 * > 어차피 프로그램으로 양산하려면 **무조건 figma랑 필요시 기획서도 필요하겠지?**
 * > 그때마다 바로바로 양산 못하면 물어보고 사용자가 바로 컨트롤 v로 붙여놓으면
 * > 그냥 **진짜 클로드코드 써서 만들듯이** 하는게 나을듯 스펙도 참고하면서.
 *
 * **까닭은 숫자에 있다.** 화면이 없으면 AI 가 알 길이 없는 것이 남는다 —
 * 짜임(칸 수)은 폴더만 보고 아는 것이 **273자리 중 70자리(26%)**뿐이고,
 * 차례는 파일 이름에 아예 없다. 그 상태로 부르면 답이 안 나오는 것이 아니라
 * **짐작이 나온다.** 에러도 카드도 안 나고 조용히 틀린 채 나간다.
 *
 * 그래서 화면이 없으면 **토큰을 한 톨도 안 쓰고** 어디를 찍으라고 말하고 멈춘다.
 * 사람이 그 화면에서 Ctrl+V 하면(`ShotPaste.tsx`) 그 자리에서 다시 돈다.
 *
 * **어디를 찍는지까지 말한다** (`section.ts`). 한 호가 36개라 「화면이
 * 필요합니다」만으로는 36번 찾아 헤맨다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Ask } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { loadForge } from './runtime'
import { figmaSpot } from './section'
import { shotNote, shotsOf } from './shot'

export interface ShotGate {
  /** 붙여넣은 화면 **전부.** 붙인 차례다. 없으면 빈 목록 */
  shots: string[]
  /** 그것을 사람이 읽을 한 줄로 (`… 외 2장`). 없으면 빈 글 — 있나 없나도 이것으로 가른다 */
  shot: string
  /** 리소스 폴더 자리 — `ai.ts` 의 `lookIn` 울타리로 그대로 넘긴다 */
  dir: string
  /**
   * figma 에서 찾아갈 자리를 사람 말로 한 줄 (`section.ts`).
   *
   * **화면이 있을 때도 들고 있는다** — 「그 화면에는 없는 것입니다, 다른
   * 장면을 주세요」라고 할 때 또 필요하다(`revise.ts` 의 `unsureAsks`).
   * 부르는 쪽이 따로 셈하면 같은 것이 두 벌이 된다 (저장소 규칙 3).
   */
  spot: string
  /** 화면이 없어 못 부를 때 사람에게 낼 카드. 있으면 **부르지 않는다** */
  ask: Ask | null
  /** 그때 걸음에 적을 한 줄 */
  why: string
  /**
   * **화면이 필요 없는 모듈이라 통과시켰나** (2026-09-28, 사용자 결정). 스펙에 값 칸이 없는 모듈
   * (`gameData.kind: unused` — 영상 등 5장)은 화면이 알려 줄 것이 없다. 09-21 「카드가 없어도 화면을
   * 요구한다」의 예외다.
   */
  free?: boolean
}

/**
 * 이 모듈이 figma 화면을 요구하나. **스펙이 정한다** — 값 칸이 하나도 없으면 필요 없다.
 * 스펙을 못 읽으면 요구한다(모르면 여태처럼).
 */
export function needsShot(forge: Awaited<ReturnType<typeof loadForge>>, subject: string, module: string): boolean {
  const spec = forge.api.spec(subject, module) as { gameData?: { kind?: string; fields?: unknown[]; of?: unknown } }
  const g = spec?.gameData
  if (!g) return true
  return !(g.kind === 'unused' || (!g.fields?.length && !g.of))
}

/**
 * 그 학습코드에 화면이 있나.
 *
 * **못 읽어도 막지 않는다** — 폴더를 못 읽는 것은 화면이 없는 것과 다른
 * 일이라, 그때는 카드를 내지 않고 까닭만 들고 간다(부르는 쪽이 그대로 멈춘다).
 */
export async function shotGate(code: string): Promise<ShotGate> {
  try {
    const forge = await loadForge()
    const dir = forge.files.rscDir(code)
    const spot = figmaSpot(forge.spec.parseStudyCode(code))
    if (!dir) {
      return { shots: [], shot: '', dir: '', spot, ask: null, why: '리소스 폴더를 정하지 못했습니다.' }
    }
    const shots = shotsOf(dir)
    if (shots.length) return { shots, shot: shotNote(shots), dir, spot, ask: null, why: '' }
    const pick = forge.api.layoutFor(code)
    if (pick.ok && pick.module && !needsShot(forge, code.slice(0, 2), pick.module)) {
      return { shots: [], shot: '', dir, spot, ask: null, why: '', free: true }
    }
    return {
      shots: [],
      shot: '',
      dir,
      spot,
      ask: askForShot(code, spot),
      why: 'figma 화면이 없어 AI 를 부르지 않았습니다.'
    }
  } catch (error) {
    return {
      shots: [],
      shot: '',
      dir: '',
      spot: '',
      ask: null,
      why: `리소스 폴더를 읽지 못했습니다: ${toMessage(error)}`
    }
  }
}

/**
 * 「화면을 주세요」 카드 한 장.
 *
 * **값으로 못 닫는 카드다.** 화면을 붙여넣고 다시 돌리면 그때 풀리는 것이라
 * 「확인했습니다」로 닫는 꼴(`shape: 'none'`)로 둔다 — `revise.ts` 의
 * `unsureAsks` 와 같은 약속이다.
 */
function askForShot(code: string, spot: string): Ask {
  return {
    id: `shot-first|${code}`,
    want: '사람이 봐야',
    title: 'figma 화면이 있어야 생성할 수 있습니다.',
    where: '_figma',
    desc: '화면이 없으면 항목의 위치와 개수를 알 수 없습니다.',
    give:
      'figma 프레임을 PNG 1x 로 복사(Ctrl+Shift+C)해 Ctrl+V 로 붙여넣으세요. 여러 장을 넣어도 됩니다. ' +
      // **기획서는 이 빗장에 넣지 않는다** — 없다고 멈추면 여태 되던 것까지
      // 막힌다. 다만 여기서 한 번 말해 둔다: 값(낱말·숫자·차례)이 틀리는
      // 까닭의 대부분이 기획서가 없어서다 (완성본과 견줘 값 32%, `pasted.ts`).
      '기획서가 있으면 아래 칸에 함께 넣으세요.' +
      (spot ? ` ${spot}` : ''),
    options: [],
    shape: 'none',
    count: 1,
    items: [],
    carry: false
  }
}
