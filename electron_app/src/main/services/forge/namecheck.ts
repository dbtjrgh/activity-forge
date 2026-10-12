/**
 * 받은 이름과 차례를 **검산한다** — 믿지 않는다 (`name.ts` 에서 떼어 냄).
 *
 * 이름은 폴더에 있는 파일인지, 차례는 **1~N 이 빠짐없이 한 번씩**인지 기계가
 * 다시 본다. 묻는 쪽(브리프 · 받은 글 읽기)은 `name.ts` 에 있다.
 */

import { stem, type NamePick } from './name'

export type NamesChecked = {
  taken: NamePick[]
  refused: { file: string; name: string; why: string }[]
  /** 차례가 1~N 으로 온전한가. 아니면 무엇이 잘못인지 */
  orderNote: string
}

/**
 * 받은 답을 검산한다. **한 줄이 이상해도 나머지는 받는다.**
 *
 *   ① 그 파일이 폴더에 실제로 있나
 *   ② 새 이름이 겹치지 않나 (한 폴더 안에서 별칭이 곧 이름이다)
 *   ③ 새 이름이 쓸 수 있는 글자인가
 *   ④ **차례가 1~N 에 빠짐도 겹침도 없나** ← 그림을 안 보고도 잡는다
 */
export function checkNames(picks: NamePick[], files: string[], innings: number | null): NamesChecked {
  const have = new Set(files)
  // **확장자를 떼고도 찾는다.** 「지금이름」 칸에 `fork.png` 대신 `fork` 를 적어
  // 오는 일이 있다 — 파일 이름이 이미 뜻을 담고 있으면 특히 그렇다. 2026-09-15
  // 에 그림 여섯 개가 전부 그렇게 와서 **다 물렸다**(소리는 6/6 통과했다).
  // 같은 파일을 가리키는 것이 분명하므로 짐작이 아니다. 다만 **줄기가 여럿과
  // 맞으면 받지 않는다** — 어느 것인지 모르는 채 고르는 것은 짐작이다.
  const byStem = new Map<string, string[]>()
  for (const f of files) {
    const k = stem(f).toLowerCase()
    byStem.set(k, [...(byStem.get(k) ?? []), f])
  }
  const used = new Map<string, string>() // 새 이름 → 이미 가져간 파일
  const taken: NamePick[] = []
  const refused: NamesChecked['refused'] = []
  const refuse = (p: NamePick, why: string): void => {
    refused.push({ file: p.file, name: p.name, why })
  }

  for (let p of picks) {
    if (!have.has(p.file)) {
      const same = byStem.get(stem(p.file).toLowerCase()) ?? []
      if (same.length !== 1) {
        refuse(p, same.length ? `${p.file} 이름에 해당하는 파일이 여러 개입니다: ${same.join(', ')}.` : '폴더에 없는 파일입니다.')
        continue
      }
      p = { ...p, file: same[0] as string }
    }
    // **띄어쓰기를 막지 않는다.** 처음엔 `[a-z][a-z0-9_]*` 로 막았는데, 8호
    // 완성본이 `alias: 'watering can'` · `word: "watering can"` 을 쓴다 —
    // 파일 이름 자체가 `watering can.png` 다. 사람이 그렇게 지어 온 것을 도구가
    // 물리면 **완성본을 그대로 다시 만들지 못한다.** 2026-09-15 에 그 한 자리가
    // 물려 이닝 6이 비고, 그 바람에 그림 여섯이 통째로 되물렸다.
    // 막는 것은 **자리 이름에 들어가면 안 되는 글자**뿐이다 — 경로·따옴표·
    // 중괄호처럼 값으로 새어 나가면 글이 깨지는 것들.
    if (!/^[a-z][a-z0-9 _-]*$/i.test(p.name)) {
      refuse(p, '이름에 쓸 수 없는 글자가 있습니다. 영문으로 시작하고 영문, 숫자, 띄어쓰기만 쓸 수 있습니다.')
      continue
    }
    const already = used.get(p.name.toLowerCase())
    if (already) {
      refuse(p, `${p.name} 이름은 이미 ${already} 파일이 쓰고 있습니다.`)
      continue
    }
    used.set(p.name.toLowerCase(), p.file)
    taken.push(p)
  }

  return { taken, refused, orderNote: checkOrder(taken, innings) }
}

/**
 * 차례가 온전한지 본다. **이것이 제일 센 검산이다** — 번호가 겹치거나 빠지면
 * 그림을 안 보고도 답이 틀린 것을 안다.
 *
 * 온전하면 빈 글자를 돌려준다. 아니면 무엇이 잘못인지 사람이 읽는 한 줄이다.
 */
export function checkOrder(picks: NamePick[], innings: number | null): string {
  const numbered = picks.filter((p) => p.inning !== null)
  if (numbered.length === 0) return ''

  const seen = new Map<number, string[]>()
  for (const p of numbered) {
    const list = seen.get(p.inning as number) ?? []
    list.push(p.name)
    seen.set(p.inning as number, list)
  }

  const dup = [...seen.entries()].filter(([, v]) => v.length > 1)
  if (dup.length) {
    return dup.map(([n, v]) => `${n}번째 순서가 겹칩니다(${v.join(', ')})`).join(', ') + '.'
  }

  const want = innings ?? numbered.length
  const missing: number[] = []
  for (let i = 1; i <= want; i += 1) if (!seen.has(i)) missing.push(i)
  if (missing.length) return `${missing.join(', ')}번째 순서가 비어 있습니다.`

  const over = [...seen.keys()].filter((n) => n > want)
  if (over.length) return `${over.join(', ')}번째는 이 액티비티에 없는 순서입니다(${want}번째까지).`

  return ''
}
