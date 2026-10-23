/**
 * **대화로 만들기 첫 지시의 규칙 글** (2026-10-14, `chatbrief.ts` 에서 「하는 법」을 뗐다 · 뗄 때 동작 변화 없음, 떼기 전후 첫 지시를 바이트로 견줘 같았다).
 *
 * 규칙은 8호(M07) · 9호 대화에서 사람이 짜증 낸 것이다(`chatbrief.ts` 머리). 줄을 더할 때는 그 사례를 주석에 남긴다.
 * 학습코드마다 달라지는 주의(figma 화면이 없을 때 · 원본이 모듈 기본값을 덮은 별칭 · 대화로 만든 완성본의 어림 값)도 여기서 글로 만든다 — 재는 것은 `chatlore.ts`.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import path from 'node:path'
import type { ChatCtx } from './chatprep'

const rel = (p: string): string => p.split(path.sep).join('/')

/** 「## 폴더」 가운데 원본 · 완성본 · 모듈 줄 — 첫 지시와 폴더를 다시 열 때(`reopenBrief`)가 같이 쓴다 */
export function folderLines(c: ChatCtx): string[] {
  return [
    `- 원본 완성본(읽기, 앱이 추천): ${c.origin.code}${madeTag(c, c.origin.code)} — 코드 ${rel(c.origin.act)} · 리소스 ${rel(c.origin.rsc)}`,
    ...c.others.map((o) => `- 같은 모듈 다른 완성본(읽기): ${o.code}${madeTag(c, o.code)} — 코드 ${rel(o.act)} · 리소스 ${rel(o.rsc)}`),
    `- 모듈 소스(읽기): ${rel(c.moduleDir)}`,
    `- 모듈 스펙(읽기): ${rel(c.specFile)} — 항목 설명 · 값 범위 · 모듈이 이름을 박아 부르는 그림(fixedAlias)`
  ]
}

/**
 * 대화 도중 모듈이나 원본이 바뀌어 앱이 읽을 폴더를 다시 열었을 때(`chatresume.ts`) — 첫 지시의 폴더 줄 · 원본 주의는 옛것이다.
 * `files` 는 원본이 바뀌어 앱이 리소스 폴더에서 치우고 새로 가져온 파일(`chatcarry.ts`)
 */
export function reopenBrief(c: ChatCtx, files: { gone: string[]; took: string[] } | null): string {
  const list = (title: string, xs: string[]): string[] => (xs.length ? [title, ...xs.map((x) => `- ${x}`)] : [])
  return [
    `앱이 읽을 폴더를 다시 열었다. 모듈은 ${c.module} 이고 원본은 ${c.origin.code} 이다. 첫 지시의 원본 · 완성본 · 모듈 줄과 원본 주의 대신 아래를 쓴다.`,
    ...folderLines(c),
    ...list('앱이 옛 원본에서 가져왔던 파일을 리소스 폴더에서 휴지통으로 옮겼다. 쓰고 있었으면 새 원본 것으로 바꾼다:', files?.gone ?? []),
    ...list('앱이 새 원본에서 리소스 폴더로 가져온 파일(앞 호들이 같은 파일을 쓰는 것):', files?.took ?? []),
    ...loreLines(c)
  ].join('\n')
}

/** 「## 하는 법」 덩어리 — 앞의 빈 줄까지 */
export function howLines(): string[] {
  return [
    '',
    '## 하는 법',
    '1. 원본의 GameData.ts · AssetTable.ts · Activity.ts 와 모듈 스펙을 먼저 읽는다. 원본에서 출발한다. 새로 짓지 않는다.',
    '2. 값(낱말 · 문장 · 정답 · 소리 파일 번호)의 정본은 기획서다. 기획서를 끝까지 읽는다. 쪽이 많으면 pages 로 나눠 연다.',
    '   기획서도 틀릴 수 있다. 앞뒤가 안 맞는 값(그 이닝 낱말과 다른 주어, 어긋난 번호 같은 것)은 그대로 넣지 말고 ask 로 바로 묻는다.',
    '   기획서대로 두는 답과 고친 값을 고를 답으로 두고, 그 소리 파일 이름도 질문에 적는다(녹음이 기획서와 같으면 의도일 수 있다). 끝 보고 check 에만 적고 넘어가지 않는다.',
    '3. 자리(좌표 · 배치)의 정본은 figma 화면이다. 화면을 모두 열어 본다. 이닝 차례는 figma 화면을 붙인 차례다.',
    '   figma 가 없는 이닝의 글자 조각(자모) 간격은 다른 이닝 간격을 옮겨 쓰지 않는다. 옆으로 놓인 글자(틱)와 위아래로 쌓은 글자(폼)는 간격이 다르다.',
    '   종이에 이미 찍힌 같은 짜임의 글자(위아래로 쌓은 글자, 받침 글자)를 열어 보고 그 간격을 따른다. 어림한 자리는 끝 보고 check 에 적는다.',
    '4. 그림은 이름만 보고 짐작하지 않는다. 후보 그림은 Read 로 열어 눈으로 본다. 소리는 기획서 대본의 파일 이름과 번호로 맞춘다.',
    '5. 이번 회차 내용(낱말 그림 · 책 · 스티커 · 대사처럼 회차마다 바뀌는 것)은 리소스 폴더의 파일에서 고른다. 그림을 편집하지 않는다.',
    // 9호 MAL1M08W2S1 — 장식이 든 액자를 달라고 해서 장식 없는 흰 판(Rectangle 452.png)을 받았는데, 경고만 적고 done 했다(2026-10-12)
    '   받은 파일이 기획서 · figma 와 다르면(장식이 빠진 판, 색이 다른 판 같은 것) 경고만 적고 done 하지 않는다. 무엇이 다른지 적어 ask 로 묻는다.',
    '   리소스 표에서 「폴더에 없음」인 자리 가운데 호마다 같은 틀(타자기 · 자판 · 배경 틀 같은 것)은 원본이나 같은 모듈 완성본의 리소스를 그대로 써도 된다.',
    '   그럴 때는 여러 완성본에서 같은 파일인지(크기 · 모양) 확인하고 쓴다. 내용이 바뀌어야 할 것 같은데 받은 파일이 없으면 묻는다.',
    '   앱이 앞 호에서 가져온 파일은 앞 호들이 다 같았다는 뜻일 뿐이다. figma 화면의 같은 틀(빈칸 상자 같은 것)과 크기나 모양이 다르면 figma 가 정본이다.',
    '   가져온 파일을 그대로 쓰지 말고, figma 와 같은 파일을 달라고 묻는다. 어느 이닝에 어느 크기가 맞는지는 획 그림이 그 틀 안에 드는지로 본다.',
    '   호 저장소에 놓일 파일은 끝 덩어리 files 에 적는다 — 앱이 복사한다.',
    '   모듈이 이름을 박아 부르는 그림(스펙 fixedAlias, 원본 AssetTable 의 「이름 고정」)은 그 이름 그대로 둔다.',
    '6. Activity.ts 는 원본 것에서 학습코드만 바꾼다. activityInfo.json · index.html · main.ts · App.vue · style.css 는 건드리지 않는다.',
    // 개발 완료 5개가 원본에서 옮긴 다른 학습코드를 그대로 들고 있었다(5호 MAL1M05W4S1 mStudyCode 'MAL3M01W4S1' 등) — 앱이 끝에 막는다(`chatident.ts`)
    '   Activity.ts 의 mStudyCode 와 AssetTable.ts 의 ActivityCode 는 둘 다 이 학습코드로 쓴다. 원본에 다른 학습코드가 잘못 적혀 있을 수 있다.',
    '7. 원본 · 모듈을 바꾸거나 모듈 코드를 고쳐야 할 것 같으면 하지 말고 묻는다. 시키지 않은 판단을 하지 않는다.',
    '8. 묻는 것은 기획서 · figma 로도 정할 수 없는 것, 기획서 오기로 보이는 것, 빠진 입력뿐이다. 모아서 한 번에 묻는다. 사소한 것은 원본대로 하고 끝 보고에 적는다.',
    '   figma 화면이나 기획서가 없어서 정할 수 없으면 그것부터 달라고 묻는다.',
    '   입력이 빠져 GameData.ts · AssetTable.ts 를 다 쓸 수 없으면 done 으로 끝내지 않는다. 짐작으로 채우지 말고 ask 로 묻는다.'
  ]
}

/**
 * figma 화면이 0장인데 스펙이 화면을 요구하는 모듈 — 「받은 입력」의 figma 목록 바로 아래.
 * 9호는 figma 없이 시작한 대화가 앞 호 자리 값을 말없이 옮겼다(MAL1M08W2S1 프레임 (0, 100) · MAL3M08W2S1 사진 자리 (0, -70))
 */
export function noShotLines(c: ChatCtx): string[] {
  if (c.shots.length || !c.lore?.needsShot) return []
  return [
    'figma 화면이 없다. 이닝 수와 차례는 기획서로 정하고, 기획서로도 정할 수 없으면 어림하지 말고 ask 로 묻는다.',
    '자리 값(좌표 · 배치 · 간격)은 앞 호 값으로 어림하고, 어림한 자리를 끝 보고 check 에 모두 적는다.'
  ]
}

/** 대화 도중 figma 화면이 들어왔을 때 답에 붙이는 한 줄 — 앞서 어림한 자리를 그대로 두지 않게 */
export const FIGMA_REDO =
  'figma 화면이 새로 들어왔거나 바뀌었다. 앞서 figma 없이 어림한 자리(좌표 · 배치 · 간격)나 이닝 수 · 차례가 있으면 이 화면으로 다시 맞추고, 끝 보고 check 의 어림 항목도 고친다.'

/** 폴더 목록의 꼬리표 — 대화로 만든 완성본 */
export const madeTag = (c: ChatCtx, code: string): string => (c.lore?.guessed.some((g) => g.code === code) ? ' (대화로 만듦)' : '')

const noExt = (f: string): string => f.replace(/\.[^.]+$/, '')

/** 원본이 모듈 기본값을 덮는 별칭 · 대화로 만든 완성본의 어림 값 — 폴더 목록 뒤 */
export function loreLines(c: ChatCtx): string[] {
  const lore = c.lore
  if (!lore) return []
  const out: string[] = []
  if (lore.overrides.length) {
    out.push(
      '',
      '## 원본이 모듈 기본값을 덮는 별칭',
      '모듈이 스스로 등록하는 소리 · 그림을 원본 AssetTable 이 다른 파일로 덮었다. 같은 모듈 다른 완성본은 대부분 덮지 않아 원본의 실수일 수 있다.',
      '그대로 옮기지 말고 기획서로 확인한다. 기획서로도 정할 수 없으면 ask 로 묻는다.',
      ...lore.overrides.map((o) => `- ${o.alias} → ${noExt(o.file)} (모듈 기본 ${noExt(o.base)}${o.at ? `, 모듈이 부르는 곳 ${o.at}` : ''})`)
    )
  }
  if (lore.guessed.length) {
    const made = new Set(lore.guessed.map((g) => g.code))
    const human = [c.origin.code, ...c.others.map((o) => o.code)].filter((x) => !made.has(x))
    out.push(
      '',
      '## 대화로 만든 완성본',
      `${[...made].join(', ')} 는 앱 안 대화로 만든 완성본이다(위 폴더 목록의 「대화로 만듦」).`,
      human.length
        ? `자리 값(좌표 · 배율 · 간격)은 사람이 만든 완성본(${human.join(', ')})을 먼저 본다.`
        : '열어 준 완성본이 모두 대화로 만든 것이다. 자리 값을 옮길 때는 아래 목록에 든 값인지 먼저 본다.'
    )
    const listed = lore.guessed.filter((g) => g.lines.length)
    if (listed.length) {
      out.push(
        '아래는 그 대화가 끝 보고에 남긴 확인 목록이다. 이 완성본의 아래 값은 어림이나 임시였다. 그대로 옮기지 말고 기획서 · figma 로 다시 정한다.',
        ...listed.flatMap((g) => [`- ${g.code}:`, ...g.lines.map((l) => `  - ${l}`)])
      )
    }
  }
  return out
}

/**
 * 스펙을 맞춰 본 뒤 공용 모듈에 커밋이 더 있을 때 — 폴더 목록 뒤(`ChatCtx.drift`).
 * 공용 모듈을 다른 팀이 고쳐도 스펙은 몰랐다 — 10호 4이닝이 열흘 동안 「5개 이상」으로 막혔다(K05 · K06 · K14, 2026-10-14)
 */
export function driftLines(c: ChatCtx): string[] {
  const d = c.drift
  if (!d) return []
  return [
    '',
    '## 스펙이 모듈보다 낡았을 수 있다',
    `스펙을 맞춰 본 뒤 ${c.module} 모듈에 커밋이 ${d.commits.length}개 더 있다(새것 먼저):`,
    ...d.commits.slice(0, 5).map((x) => `- ${x}`),
    '스펙 설명과 모듈 소스가 다르면 모듈 소스를 따른다. 무엇이 달랐는지 끝 보고 check 에 적는다.'
  ]
}
