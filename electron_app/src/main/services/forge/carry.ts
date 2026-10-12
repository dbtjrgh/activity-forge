/**
 * 사람이 정한 것을 **다음 호까지 남긴다** (5단계).
 *
 * 계획서: *「고른 답은 `_layout`·`_spec` 에 글로 남깁니다. 다음 호부터는 묻지
 * 않습니다.」* 끝났다고 볼 기준도 그것 하나다 — **같은 질문을 두 번째 호에서
 * 묻지 않는다.**
 *
 *   `#module` → `_layout/<과목><호>.json`   어느 모듈인가. 배치표가 갈릴 때
 *   그 밖     → `_spec/<과목>/<모듈>.json`  그 자리의 `default` 와 `defaultWhy`
 *
 * **왜 스펙의 `default` 인가.** `resolve.ts` 가 레시피에 그 열쇠가 없으면
 * `default` 를 쓴다. 그러니 기본값을 넣는 순간 다음 호에서는 **에러가 아예
 * 안 난다** — 요구 카드도 안 생긴다. 「묻지 않는다」가 화면의 눈속임이 아니라
 * 생성기 안에서 일어난다.
 *
 * **까닭 없이는 안 올린다.** `_layout` 파일 자신이 「정한 까닭을 why 에
 * 남깁니다 — 나중에 「왜 이걸로 했지」를 다시 묻지 않으려는 것입니다」라고
 * 적어 두었다. 스펙도 같은 규칙으로 `defaultWhy` 를 함께 쓴다.
 *
 * **올릴 수 없는 자리는 올리지 않는다** — 무엇이 올릴 수 있는 것인지는
 * `field.ts` 의 `carryable` 하나가 정한다. 파일 이름은 호마다 다르고,
 * 배열 칸은 칸마다 다르다. 짐작해서 올리느니 한 번 더 묻는 편이 낫다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import type { Answer, Carried } from '../../../shared/forge'
import { MODULE_PATH } from '../../../shared/forge'
import { toMessage } from '../../lib/errors'
import { carryable, fieldAt } from './field'
import type { Forge } from './runtime'
import type { Spec } from '@/gen/types'


/** 언제·누가 정했는지를 까닭 뒤에 붙인다. 글만 남고 사람이 안 남으면 못 묻는다. */
export function stamped(why: string, code: string, who: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return `${why.trim()} (${day} ${who} · ${code} 에서 정했습니다)`
}

/**
 * 답 가운데 `carry` 가 붙은 것을 스펙·배치표에 올린다.
 *
 * **하나가 실패해도 나머지는 올린다.** 그리고 실패한 것을 그대로 알린다 —
 * 조용히 넘기면 다음 호에서 또 물어보고 사람은 「올렸는데 왜 또 묻지」가 된다.
 */
export async function carryAnswers(
  code: string,
  answers: Answer[],
  forge: Forge
): Promise<Carried[]> {
  const wanted = answers.filter((a) => a.carry?.why.trim())
  if (!wanted.length) return []

  const who = forge.user.loadUser().developer || '(이름 없음)'
  const out: Carried[] = []
  for (const a of wanted) {
    const why = a.carry?.why ?? ''
    out.push(
      a.path === MODULE_PATH
        ? toLayout(code, String(a.value), why, who, forge)
        : toSpec(code, a.path, a.value, why, who, forge)
    )
  }
  return out
}

/** 배치표에 「이 차시는 이 모듈」을 적는다. */
function toLayout(code: string, module: string, why: string, who: string, forge: Forge): Carried {
  const at = forge.layout.placementFor(code)
  if (!at) {
    return {
      path: MODULE_PATH,
      ok: false,
      file: '',
      note: '학습코드를 읽지 못해 배치표에 저장하지 못했습니다.'
    }
  }
  const r = forge.layout.writeLayoutPick(at.subject, at.issue, at.slot, {
    module,
    why: stamped(why, code, who)
  })
  return {
    path: MODULE_PATH,
    ok: r.ok,
    file: r.file,
    note: r.ok
      ? `배치표 ${at.subject}${at.issue} 파일에서 ${at.slot} 위치의 모듈을 ${module} 모듈로 정했습니다.`
      : (r.error ?? '배치표에 저장하지 못했습니다.')
  }
}

/**
 * 스펙의 그 자리에 기본값을 적는다.
 *
 * **파일을 통째로 다시 쓴다.** JSON 이라 주석이 없고, 읽어서 그 자리만 고친
 * 뒤 같은 꼴(들여쓰기 2칸)로 되쓴다 — 손으로 쓴 스펙과 기계가 쓴 스펙의
 * 생김새가 이미 그렇다.
 */
function toSpec(
  code: string,
  path: string,
  value: unknown,
  why: string,
  who: string,
  forge: Forge
): Carried {
  const at = forge.layout.placementFor(code)
  const module = at?.module ?? ''
  const subject = at?.subject ?? code.slice(0, 2)
  if (!module || module.includes('+')) {
    return {
      path,
      ok: false,
      file: '',
      note: module
        ? `모듈이 둘 이상(${module})이라 스펙에 저장하지 못했습니다.`
        : '모듈이 정해지지 않아 스펙에 저장하지 못했습니다.'
    }
  }

  let file: string
  try {
    file = forge.spec.specPath(subject, forge.spec.resolveModule(subject, module))
  } catch (error) {
    return { path, ok: false, file: '', note: `스펙을 찾지 못했습니다: ${toMessage(error)}` }
  }
  if (!fs.existsSync(file)) {
    return { path, ok: false, file, note: `스펙 파일이 없습니다: ${file}` }
  }

  let spec: Spec
  try {
    spec = JSON.parse(fs.readFileSync(file, 'utf8')) as Spec
  } catch (error) {
    return { path, ok: false, file, note: `스펙을 읽지 못했습니다: ${toMessage(error)}` }
  }

  // 여기서 한 번 더 본다. 화면이 보낸 것을 그대로 믿지 않는다 —
  // 스펙이 그새 바뀌어 그 자리가 없어졌을 수도 있다.
  if (!carryable(spec, path)) {
    return {
      path,
      ok: false,
      file,
      note: '스펙에 기본값으로 저장할 수 없는 항목입니다.'
    }
  }
  const field = fieldAt(spec, path)
  if (!field) return { path, ok: false, file, note: '스펙에 없는 항목입니다.' }

  const had = field.default !== undefined
  field.default = value
  field.defaultWhy = stamped(why, code, who)

  try {
    fs.writeFileSync(file, JSON.stringify(spec, null, 2) + '\n', 'utf8')
  } catch (error) {
    return { path, ok: false, file, note: `스펙을 저장하지 못했습니다: ${toMessage(error)}` }
  }
  return {
    path,
    ok: true,
    file,
    note:
      `${subject}/${module} 스펙에서 ${path} 항목의 기본값을 ${had ? '바꿨습니다.' : '저장했습니다.'}` +
      // **기본값은 이 모듈을 쓰는 앞선 회차에도 걸린다.** 그 자리를 비워 두고
      // 만들어 둔 액티비티가 있으면 다시 뽑을 때 없던 줄이 새로 생긴다.
      // 재현 검사가 그것을 「스펙이 채운 기본값 n자리」로 세어 주므로 한 번
      // 돌려 보라고 적는다 — 막지 않고 볼 자리를 알린다.
      ' 아래 「재현 검사」를 한 번 실행하세요.'
  }
}
