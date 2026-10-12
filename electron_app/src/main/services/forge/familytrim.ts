/**
 * **회차마다 자리 수가 줄어든 무리를 덜어낸다** (2026-09-21).
 *
 * `family.ts` 는 **이름 짜임**이 바뀐 무리를 폴더 쪽으로 맞춘다. 여기는 다른
 * 것을 본다 — **이름은 그대로인데 개수가 줄어든** 무리다.
 *
 *   원본(6호)   `button_0_basic` … `button_7_basic`   여덟 자리
 *   이 회차 폴더 `button_0_basic` … `button_5_basic`   여섯 개
 *
 * 앞의 여섯은 그대로 맞고 **뒤의 둘만 남는다.** 도구는 그것을 「리소스가 없는
 * 자리」라 하고, 사람에게 「그 파일을 주세요」라고 한다. **그 파일은 없는 것이
 * 아니라 이 회차에 쓰이지 않는 것**이다.
 *
 * 묻기만 하고 끝나는 것이 아니다. 실제로 재 보니 **AI 가 억지로 채웠다** —
 * `MAL2M07W2S1` 에서 `button_6_basic = images/view_2_0_basic.png` 처럼 남는
 * 파일을 아무거나 집어넣었고, **검산 넷을 다 통과했다**(폴더에 있는 파일 ·
 * 갈래도 맞음 · 겹치지도 않음). 에러도 카드도 안 난다. 자리가 있으니 AI 는
 * 채우려 한다 — **없어야 할 자리를 물어 놓고 답이 틀렸다고 할 수 없다.**
 *
 * **형제가 증인이다.** 같은 무리의 다른 자리들이 이미 가리키고 있는 폴더 무리를
 * 보고, **그 무리에 남은 파일이 하나도 없으면** 이 자리는 채울 것이 없는
 * 자리다. 형제가 한 자리도 안 정해졌으면 아무 말도 하지 않는다 — 그때는
 * 정말로 파일이 빠진 것일 수 있다.
 *
 * 그래서 **AI 를 부르기 전에도 부른 뒤에도 같은 자리에서 돈다.** 부르기 전에는
 * 맞추기가 맞춘 형제가 증인이고(`button_0..5`), 부른 뒤에는 AI 가 답한 형제가
 * 증인이다(`character_0..5_idle → character_#_body_idle`). 한 벌로 둘 다 본다.
 *
 * 빗장은 `family.ts` 와 같다 — **`gameData` 가 그 별칭을 한 번이라도 부르면
 * 건드리지 않는다.** 자리를 없애는 순간 없는 이름을 가리키게 된다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import type { FamilyFix } from './family'
import type { Answer } from '../../../shared/forge'
import type { Forge } from './runtime'
import type { Swap } from '@/gen/swap'
import type { AssetKind, Spec } from '@/gen/types'

type Asset = { alias: string; file: string; base?: string }

/** 별칭에서 숫자를 걷어낸 **무리 이름**. `character_6_idle` 과 `character_0_idle` 이 같아진다. */
function aliasFamily(alias: string): string {
  return alias.replace(/\d+/g, '#')
}

/** `gameData` 어딘가에 그 이름이 값으로 들어 있나. `family.ts` 와 같은 빗장이다. */
export function usedInData(data: unknown, names: Set<string>): boolean {
  if (typeof data === 'string') return names.has(data)
  if (Array.isArray(data)) return data.some((v) => usedInData(v, names))
  if (data && typeof data === 'object') {
    return Object.values(data as Record<string, unknown>).some((v) => usedInData(v, names))
  }
  return false
}

/**
 * 같은 파일을 받은 자리들 가운데 **번호가 파일과 다른 쪽**의 별칭. 번호가 같은 자리가
 * 딱 하나 있을 때만 나머지를 짚는다 — 어느 쪽이 맞는지 모르면 아무것도 안 짚는다.
 *
 * **원본에서도 한 파일을 나눠 쓰던 자리는 짚지 않는다.** 완성본에는 일부러 나눠 쓰는 짜임이 260군데
 * 있다(KO `apple0` · `apple3` → `apple_0.png`). 억지로 채운 것은 원본에서 **따로였던** 파일이 한 파일로
 * 모인 것이다(`character_5_idle.png` · `character_6_idle.png` → `character_5_body_idle.png`).
 * 이 걸음에서 레시피의 `file` 은 아직 원본 것이다 — 답은 뒤(③.6)에서 얹는다.
 */
function doubled(slots: Asset[], fileOf: (s: Asset) => string): Set<string> {
  const digits = (s: string): string => (s.match(/\d+/g) ?? []).join('_')
  const byFile = new Map<string, Asset[]>()
  for (const s of slots) {
    const f = fileOf(s).split('/').pop() ?? ''
    byFile.set(f, [...(byFile.get(f) ?? []), s])
  }
  const out = new Set<string>()
  for (const [file, same] of byFile) {
    if (same.length < 2) continue
    if (new Set(same.map((s) => s.file)).size < same.length) continue
    const right = same.filter((s) => digits(s.alias) === digits(file))
    if (right.length !== 1) continue
    for (const s of same) if (s !== right[0]) out.add(s.alias)
  }
  return out
}

/**
 * 덜어낸 이름을 **열쇠로 부르는 표**에서도 뺀다 (2026-09-23). `usedInData` 는 값만 본다 —
 * M05 `M05_Button.image` 는 열쇠가 alias 라, 여기서 안 빼면 AssetTable 에는 없는
 * `button_6_basic` 이 표에 남는다(완성본은 0~5 뿐이다). 어느 표가 그런지는 스펙의
 * 관계가 안다 — 그 밖의 열쇠는 뜻이 다를 수 있어 안 건드린다.
 */
export function dropKeys(forge: Forge, data: unknown, spec: Spec | null, kind: AssetKind, drop: Set<string>): void {
  if (!spec?.relations || data === undefined) return
  const root = spec.gameData?.root ?? ''
  for (const { kind: k, table } of forge.relpath.aliasKeyPaths(spec.relations, data, root).values()) {
    if (k !== kind || !table || typeof table !== 'object' || Array.isArray(table)) continue
    for (const name of drop) delete (table as Record<string, unknown>)[name]
  }
}

/**
 * 채울 것이 없는 자리를 덜어낸다. **레시피와 `swap` 을 그 자리에서 고친다** —
 * 아래 걸음(자리 가리기 · 맞추기 · 요구 카드)이 바뀐 것을 그대로 보게 한다.
 *
 * @param kept 이미 받아 둔 답. **AI 가 답한 형제도 증인으로 세우려는 것**이다.
 */
export function trimFamily(forge: Forge, swap: Swap, kept: Answer[], spec: Spec | null): FamilyFix[] {
  const fam = forge.swap.familyOf
  const recipe = swap.recipe as { assets?: Record<string, Asset[]>; gameData?: unknown }
  const fixes: FamilyFix[] = []

  // 폴더에 아직 아무도 안 가져간 파일을 무리별로 센다.
  const spare = new Map<string, number>()
  for (const f of swap.spare) spare.set(fam(f), (spare.get(fam(f)) ?? 0) + 1)

  // **받아 둔 답이 찜해 놓은 파일은 뺀다.** 답을 얹는 것은 이 걸음보다 뒤라
  // (`assemble.ts` ③.6) 그때까지 `spare` 에 그대로 남아 있다. 그대로 세면
  // 「아직 파일이 남아 있다」로 읽혀, 정작 덜어내야 할 자리를 못 덜어낸다.
  for (const a of kept) {
    if (!a.path.startsWith('assets.')) continue
    const one = String(a.value)
    const key = fam(one)
    spare.set(key, (spare.get(key) ?? 0) - 1)
  }

  for (const [kind, list] of Object.entries(recipe.assets ?? {})) {
    const base = kind === 'image' ? 'images' : kind === 'sound' ? 'sounds' : 'animations'
    const missing = new Set(swap.misses.filter((m) => m.kind === kind).map((m) => m.alias))
    const answered = new Map(
      kept
        .filter((a) => a.path.startsWith(`assets.${kind}.`))
        .map((a) => [a.path.slice(`assets.${kind}.`.length), String(a.value)])
    )

    const group = new Map<string, Asset[]>()
    for (const a of list) group.set(aliasFamily(a.alias), [...(group.get(aliasFamily(a.alias)) ?? []), a])

    for (const [, slots] of group) {
      if (slots.length < 2) continue
      // **형제와 같은 파일을 받은 자리는 정해진 것으로 안 친다** (2026-09-29, M3). AI 가
      // 남는 자리를 억지로 채운다 — MAL2M07W2S1 `character_6_idle ← character_5_body_idle.png`
      // 는 `character_5_idle` 과 같은 파일이었고, 완성본에는 6번이 없다. 둘 가운데
      // **번호가 파일 번호와 같은 쪽**만 둔다. 같은 쪽이 없으면 가리지 않는다.
      const stuffed = doubled(slots.filter((s) => answered.has(s.alias)), (s) => answered.get(s.alias) ?? '')
      const told = (s: Asset): boolean => answered.has(s.alias) && !stuffed.has(s.alias)
      // 아직 채울 것을 못 찾은 자리 · 이미 정해진 형제
      const open = slots.filter((s) => missing.has(s.alias) && !told(s))
      const settled = slots.filter((s) => !missing.has(s.alias) || told(s))
      if (!open.length || !settled.length) continue

      // **형제가 가리키는 폴더 무리에 남은 파일이 있나.** 하나라도 남아 있으면
      // 이 자리가 그것을 가져갈 수 있다 — 없앨 자리가 아니다.
      // **답과 레시피는 꼴이 다르다.** 답은 `images/x.png` 처럼 갈래 폴더까지
      // 적혀 오고, 레시피의 `file` 은 그 아래부터다(`sfx/y.mp3`). 그대로 이으면
      // `images/images/x.png` 가 되어 **폴더에 남은 파일이 0개로 보이고**, 멀쩡한
      // 자리까지 덜어낸다. 실제로 그렇게 한 번 덜어냈다(재서 잡았다).
      const at = (s: Asset): string => {
        const dir = s.base ?? base
        const one = answered.get(s.alias) ?? s.file
        return fam(one.startsWith(`${dir}/`) ? one : `${dir}/${one}`)
      }
      const targets = new Set(settled.map(at))
      if ([...targets].some((t) => (spare.get(t) ?? 0) > 0)) continue
      // `gameData` 가 이름으로 부르고 있으면 건드리지 않는다
      if (usedInData(recipe.gameData, new Set(open.map((s) => s.alias)))) continue

      // ─ 덜어낸다 ─ **지금 들어 있는 것에서** 덜어낸다(`family.ts` 와 같은 함정).
      const drop = new Set(open.map((s) => s.alias))
      recipe.assets![kind] = recipe.assets![kind].filter((a) => !drop.has(a.alias))
      dropKeys(forge, recipe.gameData, spec, kind as AssetKind, drop)
      swap.misses = swap.misses.filter((m) => !(m.kind === kind && drop.has(m.alias)))
      fixes.push({
        kind: kind as AssetKind,
        from: fam(`${open[0].base ?? base}/${open[0].file}`),
        to: [...targets][0] ?? '',
        dropped: open.length,
        added: 0,
        gonePaths: open.map((s) => `assets.${kind}.${s.alias}`)
      })
    }
  }
  return fixes
}

/** 걸음에 적을 한 줄. 아무것도 안 덜었으면 빈 글이다. */
export function trimNote(fixes: FamilyFix[]): string {
  if (!fixes.length) return ''
  const n = fixes.reduce((sum, f) => sum + f.dropped, 0)
  return (
    `이번 회차에 쓰지 않는 항목 ${n}개를 뺐습니다 (` +
    fixes.map((f) => `${f.from} ${f.dropped}개`).join(', ') +
    ').'
  )
}
