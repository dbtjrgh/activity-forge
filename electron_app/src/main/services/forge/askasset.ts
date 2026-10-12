/**
 * **리소스 요구 카드** — 못 맞춘 리소스 자리를 이름 무리로 묶어 「넣어 주세요」·「골라 주세요」로.
 *
 * `ask.ts` 가 200줄에 닿아 떼어 냈다 (2026-09-23). 카드를 모으는 것은 `ask.ts`, 필드 카드는
 * `askfield.ts`, 배치표 카드는 `askmodule.ts` 에 있다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { Ask, AskOption } from '../../../shared/forge'
import type { Issue } from '@/gen/types'
import type { Swap } from '@/gen/swap'
import { orderAsks } from './askorder'
import type { SizeGroup } from './sizematch'
/**
 * 리소스 요구는 **이름 무리로 묶는다.**
 *
 * `apple_0`~`apple_11` 열두 자리를 열두 장으로 내놓으면 한 차시에 130장이
 * 나온다 (`KOL1M07W1S1` 에서 실제로 그랬다). 실제 사정은 「사과 그림 한 벌이
 * 통째로 없다」 하나다. forge 가 못 맞은 것을 보여줄 때 쓰는 것과 **같은
 * 무리 기준**(`familyOf`)을 쓴다 — 여기서 새로 정하지 않는다.
 */
export function assetAsks(
  issues: Issue[],
  swap: Swap,
  spare: Map<string, string[]>,
  familyOf: (rel: string) => string,
  sizeGroups: SizeGroup[] = [],
  /** 기획서가 들어와 있나 — 순서 카드가 「기획서를 넣으세요」와 「직접 고르세요」로 갈린다(`askorder.ts`) */
  hasPlan = false
): Ask[] {
  const bySize = new Map<string, SizeGroup>()
  for (const g of sizeGroups) for (const a of g.aliases) bySize.set(a, g)
  const groups = new Map<string, { issues: Issue[]; files: string[] }>()
  for (const issue of issues) {
    const alias = issue.path.split('.').pop() ?? ''
    const file = swap.misses.find((m) => m.alias === alias)?.file ?? alias
    const key = familyOf(file)
    const at = groups.get(key) ?? { issues: [], files: [] }
    at.issues.push(issue)
    at.files.push(file)
    groups.set(key, at)
  }

  return [...groups].flatMap(([family, at]): Ask[] => {
    const one = at.issues[0]
    const n = at.issues.length
    // **같은 크기 묶음이면 자리마다 고르게 한다** (2026-09-29, `sizematch.ts`). 폴라로이드 다섯처럼 파일은 다 왔는데
    // 차례(몇 번이 무엇인지)만 모르는 것이다 — 「파일 n개가 없습니다」라고 하면 사람은 없는 파일을 찾으러 간다
    const sized = at.issues.map((i) => bySize.get(i.path.split('.').pop() ?? ''))
    if (n > 1 && sized.every((g) => g && g === sized[0])) {
      const g = sized[0] as SizeGroup
      return orderAsks(at.issues, at.files, g.files, `같은 크기(${g.size}) 그림`, hasPlan)
    }
    const kin = spare.get(family) ?? []
    // **이름 무리가 통째로 다른 이름으로 다 와 있으면 순서만 남은 것이다** (2026-10-01) — 「파일 없음」 표로 원본 이름을 넣으라고 하지 않는다
    if (n > 1 && kin.length >= n) return orderAsks(at.issues, at.files, kin, '비슷한 파일', hasPlan)
    // **이름 꼴이 같은 것이 없으면 같은 폴더 · 같은 확장자 파일을 후보로 낸다**
    // (2026-09-23). 썸네일처럼 회차마다 이름이 제멋대로 오는 자리는 이름 꼴로는 영영
    // 후보가 안 붙어, 사람이 폴더에 들어가 **파일 이름을 고쳐야** 했다. 고르면 그 파일이
    // 그 자리에 이어지므로 이름을 안 바꿔도 된다. 「이것이다」라고는 안 한다.
    const loose = n === 1 && !kin.length ? sameShape(swap.spare, at.files[0] ?? '') : []
    const left = kin.length ? kin : loose
    // 자리 하나에 남은 파일 하나 — 이때만 「이것이겠다」고 말할 수 있다.
    const sure = n === 1 && kin.length === 1
    // 후보가 여럿이어도 **고르게는 한다.** 다만 「이것이다」라고는 안 한다.
    // 자리가 여럿이면(무리로 묶인 것) 어느 자리에 넣을지부터 모르므로 안 받는다.
    const pickable = n === 1 && left.length > 0
    // **까닭은 후보가 하나일 때만 붙인다.** 여럿이면 다 같은 말이라 아홉 줄이
    // 똑같이 반복된다. 그 말은 위 「요구」 한 줄에 이미 있다.
    const options: AskOption[] = left.map((value) => ({
      value,
      // **도구 말을 쓰지 않는다** (3단계). 사람이 읽는 줄이다.
      why: sure ? `원본 파일(${at.files[0]})과 이름 형식이 같은 유일한 파일입니다.` : ''
    }))
    return [{
      id: `asset|${family}`,
      want: pickable ? ('고르기' as const) : ('리소스파일' as const),
      where: n === 1 ? one.path : `assets — ${family}`,
      title:
        n === 1
          ? one.message
          : `리소스 폴더에 ${family} 파일 ${n}개가 없습니다.`,
      // 생성기의 `why` 는 「리소스를 …아래에 넣은 뒤 다시 만드세요」라 아래
      // 요구와 같은 말이다. 폴더 자리는 「리소스 폴더 열기」가 대신한다.
      // 대소문자 어긋남만 다르다 — 왜 Windows 에서만 열리는지가 적혀 있다.
      desc: one.rule === 'asset-file-case' ? (one.why ?? '') : '',
      // **말은 짧게, 되풀이는 화면이 묶는다.** 「폴더에 넣어 주세요」 갈래는
      // 열여섯 장이 한 표로 묶이고 공통된 말은 표 머리에 한 번만 나간다
      // (`AskFiles.tsx`). 여기서는 이 자리에만 해당하는 것을 적는다.
      give: sure
        ? `${options[0].value} 파일이 맞으면 고르세요.`
        : pickable && loose.length
          ? `같은 폴더의 ${extOf(at.files[0] ?? '')} 파일 ${loose.length}개 중 이 항목에 맞는 파일을 고르세요.`
          : pickable
          ? `남은 파일 ${left.length}개 중 이 항목에 맞는 파일을 고르세요.`
          : left.length
            ? `비슷한 파일 ${left.length}개가 있지만 이름이 달라 연결하지 못했습니다.`
            : '',
      options,
      // 무리로 묶인 것은 고를 수가 없다 — 자리 하나에 후보 하나일 때만 받는다.
      shape: pickable ? ('pick' as const) : ('none' as const),
      count: n,
      items: at.files,
      // **파일 이름은 다음 호에 안 물려준다.** 호마다 다른 것이 파일이다 —
      // 올려 두면 다음 호가 이 호의 그림을 쓰게 된다.
      carry: false
    }]
  })
}

/**
 * 폴더에 남은 파일을 **이름 무리로** 묶는다.
 *
 * `familyOf` 는 숫자 뭉치를 `#` 로 바꾼 이름이다 — `bg2.png` 와 `bg.png` 는
 * 다른 무리이고, `nar03`·`nar12` 는 같은 무리다. forge 가 못 맞은 것을
 * 보여줄 때 쓰는 것과 같은 기준을 쓴다. 여기서 새로 정하지 않는다.
 */
/** 후보로 늘어놓을 상한. 이보다 많으면 고르는 일이 아니라 찾는 일이라 안 낸다. */
const LOOSE_MAX = 20

const extOf = (rel: string): string => {
  const at = rel.lastIndexOf('.')
  return at > rel.lastIndexOf('/') ? rel.slice(at).toLowerCase() : ''
}
const dirOf = (rel: string): string => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '')

/**
 * 남은 파일 가운데 **그 자리와 같은 폴더 · 같은 확장자**인 것. 폴더가 다르면 고르는
 * 순간 AssetTable 경로가 어긋나고(`images/` 자리에 `sounds/` 파일), 확장자가 다르면
 * 갈래가 다르다.
 */
function sameShape(spare: string[], slotFile: string): string[] {
  const ext = extOf(slotFile)
  if (!ext) return []
  const got = spare.filter((f) => extOf(f) === ext && dirOf(f).toLowerCase() === dirOf(slotFile).toLowerCase())
  return got.length <= LOOSE_MAX ? got : []
}

export function spareByFamily(swap: Swap, familyOf: (rel: string) => string): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const f of swap.spare) {
    const key = familyOf(f)
    map.set(key, [...(map.get(key) ?? []), f])
  }
  return map
}

