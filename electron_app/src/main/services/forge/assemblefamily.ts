/**
 * 만들 것 모으기(`assemble.ts`)의 **③.45 ~ ③.49 — 이름으로 맞춘 뒤 무리를 손보는 걸음들**
 * (2026-09-30 에 `assemble.ts` 에서 옮김, 409줄이라. 동작 변화 없음 — 걸음 이름 · 차례 그대로, 걸음은 얼렸다).
 *
 * 무리 이름 맞추기 → 표 짜임 맞추기 → 안 쓰는 자리 덜어내기 → 짝 무리 맞추기 → 없던 무리 자리 세우기 → 빠진 부품 채우기 → 자리 표 채우기.
 * **차례가 곧 규칙이다** — 까닭은 걸음마다 아래 주석에 있다. 차례를 바꾸지 않는다.
 *
 * forge 를 부르는 규칙은 `runtime.ts` 하나뿐이다. Electron 도 import 하지 않는다(services 규칙).
 */

import type { Answer } from '../../../shared/forge'
import { fitFollows, followNote } from './aliasfollow'
import type { Assembled } from './assemble'
import { familyNote, followFolder } from './family'
import { addFolderOnly, addNote } from './familyadd'
import { trimFamily, trimNote } from './familytrim'
import { fitFileTables } from './filetable'
import { dropOriginOnly, originNote } from './originonly'
import { fillEmptyParts, fillNote } from './partfill'
import type { Forge } from './runtime'
import type { Step } from './step'
import { addTableKeys, tableNote } from './tablekeys'

type Ctx = { code: string; forge: Forge; step: Step; module: string; swapped: Assembled['swapped']; spec: Assembled['spec']; kept: Answer[] }

export type Families = {
  famed: ReturnType<typeof followFolder>
  trimmed: ReturnType<typeof trimFamily>
  only: ReturnType<typeof dropOriginOnly>
  followed: ReturnType<typeof fitFollows>
}

export async function fixFamilies({ code, forge, step, module, swapped, spec, kept }: Ctx): Promise<Families> {
  // ─ ③.45 무리 이름이 통째로 바뀐 것 ─
  // **자리를 가리기 전이다.** 이름 짜임이 바뀐 무리는 「고정 자리인데 파일이
  // 없다」로 가려져 **답이 없는 물음**이 된다 — 여섯 자리에 열다섯 파일을
  // 넣을 수는 없다. 까닭과 빗장 넷은 `family.ts` 에 있다.
  // **답은 부르는 쪽이 읽어 넘긴다.** 아래 ③.46 이 「이미 정해진 형제」를 증인으로 쓰므로
  // 자리 세우기보다 먼저 있어야 한다.
  const famed = followFolder(forge, swapped)
  if (famed.length) {
    await step(
      '무리 이름 맞추기',
      () => famed,
      (f) => ({ name: '무리 이름 맞추기', state: 'ok', note: familyNote(f) })
    )
  }

  // ─ ③.455 표 짜임을 폴더 파일 이름으로 ─ 스펙 `fileTables` (`filetable.ts`). 무리 이름을 맞춘 **뒤**다
  const listed = forge.files.listFiles(code)
  const tabled = fitFileTables(
    swapped.recipe,
    spec?.fileTables,
    listed?.exists ? listed.files.map((f) => (f.base === 'root' ? f.name : `${f.base}/${f.name}`)) : [],
    spec?.gameData?.root ?? ''
  )
  if (tabled.length) {
    await step(
      '표 짜임 맞추기',
      () => tabled,
      (t) => ({ name: '표 짜임 맞추기', state: t.some((x) => !x.to.length) ? 'warn' : 'ok', note: t.map((x) => x.note).join(' ') })
    )
  }

  // ─ ③.46 이 회차에 쓰이지 않는 자리 덜어내기 ─
  // **묻기 전에 덜어낸다.** 원본보다 자리가 줄어든 무리를 그대로 두면 「그 파일을
  // 주세요」가 되고, AI 는 남는 파일을 아무거나 집어넣는다 — 검산 넷을 다
  // 통과하면서 틀린다. 까닭과 빗장은 `familytrim.ts` 에 있다.
  const trimmed = trimFamily(forge, swapped, kept, spec)
  // 원본에만 있던 외톨이 자리도 같은 걸음이다 — 걸음 이름을 늘리지 않는다 (`originonly.ts`)
  const only = dropOriginOnly(forge, code, module, swapped, kept, spec)
  if (trimmed.length || only.dropped.length) {
    await step(
      '안 쓰는 자리 덜어내기',
      () => trimmed,
      (f) => ({
        name: '안 쓰는 자리 덜어내기',
        state: 'ok',
        note: [trimNote(f), only.dropped.length ? originNote(only.dropped) : ''].filter(Boolean).join(' ')
      })
    )
  }

  // ─ ③.465 번호로 짝인 무리 ─ 스펙 `aliasFollows`. 단추를 덜어낸 **뒤**, AI 를 부르기 **전**이다 (`aliasfollow.ts`)
  const followed = fitFollows(forge, swapped, spec)
  if (followed.length) {
    await step('짝 무리 맞추기', () => followed, (f) => ({ name: '짝 무리 맞추기', state: 'ok', note: followNote(f) }))
  }

  // ─ ③.47 폴더에만 있는 무리에 자리 세우기 ─
  // **덜어낸 뒤다.** 원본에 아예 없던 무리(몸·팔로 갈린 캐릭터의 `arm`)는
  // 짝지을 자리 자체가 없어 폴더에 그대로 남는다 — 에러도 카드도 안 나고
  // 그림만 빠진 채 나간다. **AI 가 그 갈래를 한 번 본 뒤에만** 세운다
  // (까닭과 빗장 넷은 `familyadd.ts`).
  // 차례만 남은 크기 묶음의 파일은 자리를 안 세운다 — 원본 자리가 있다 (`sizematch.ts`)
  const added = addFolderOnly(forge, swapped, kept, swapped.sized?.groups.flatMap((g) => g.files) ?? [])
  if (added.length) {
    await step(
      '없던 무리 자리 세우기',
      () => added,
      (f) => ({ name: '없던 무리 자리 세우기', state: 'ok', note: addNote(f) })
    )
  }

  // ─ ③.48 빠진 부품은 빈 그림으로 ─
  // **③.47 뒤다.** 폴더에 파일이 있는 부품(`arm_correct`)은 그 걸음이 세운다 —
  // 여기가 먼저 돌면 그 자리까지 빈 그림으로 덮어 그림이 통째로 사라진다.
  // 여기는 **폴더에 파일이 아예 없는** 자리만 맡는다 (`partfill.ts`).
  const parted = fillEmptyParts(forge, swapped, code)
  if (parted.added.length || parted.noEmpty.length) {
    await step(
      '빠진 부품 채우기',
      () => parted,
      (f) => ({
        name: '빠진 부품 채우기',
        state: f.noEmpty.length ? 'warn' : 'ok',
        note: fillNote(f)
      })
    )
  }

  // ─ ③.49 새로 세운 그림 자리를 자리 표에도 ─ 표에 칸이 없으면 모듈이 그 그림을 안 그린다 (`tablekeys.ts`)
  const keyed = addTableKeys(forge, swapped, spec, code)
  if (keyed.empty.length || keyed.guessed.length) {
    await step('자리 표 채우기', () => keyed, (t) => ({ name: '자리 표 채우기', state: t.guessed.length ? 'warn' : 'ok', note: tableNote(t) }))
  }

  return { famed, trimmed, only, followed }
}
