import { resolve } from 'node:path'
import { findForgeRoot, forgeMissingMessage } from './forgeroot'

// 폴더 찾기는 `forgeroot.ts` 로 옮겼다 — 부르는 쪽이 그대로 여기서 받게 다시 내보낸다
export { configureForge, findForgeRoot, forgetForgeRoot, forgeMissingMessage } from './forgeroot'

/**
 * forge(양산기) 코드를 불러 쓰는 자리.
 *
 * forge 의 `src/gen/paths.ts` 는 **모듈을 읽어들이는 순간** `REPO_ROOT` 를 정한다.
 * 그래서 `FORGE_REPO_ROOT` 를 심은 뒤에 import 해야 하는데, 정적 import 는 파일
 * 맨 위로 끌어올려져 순서를 보장할 수 없다. 그래서 동적 import 로 감싼다.
 *
 * **이 파일이 그 순서를 지키는 유일한 자리다.** 다른 곳에서 `@/gen/...` 을 직접
 * import 하면 앱 폴더를 repo 뿌리로 착각한 채 조용히 빈 결과가 나온다.
 *
 * Electron 을 import 하지 않는다(services 규칙). 앱 경로는 `configureForge()` 로 받는다.
 */


export interface ForgeModules {
  root: string
  layout: typeof import('@/gen/layout')
  paths: typeof import('@/gen/paths')
  user: typeof import('@/gen/user')
  /**
   * 스펙 파일이 어디 있나(`specPath`)와 학습코드 뜯기.
   *
   * **`_common` 되물림 때문에 필요하다.** 스펙은 과목 폴더에 없으면
   * `_spec/_common` 에 있다. 「다음 호에도 같습니다」로 기본값을 올릴 때
   * 그 규칙을 앱이 다시 적으면 두 벌이 되고, 갈리는 날 엉뚱한 파일에 쓴다.
   */
  spec: typeof import('@/gen/spec')
  /** 양산 화면이 부르는 일 한 벌. HTTP 라우트가 부르던 것과 같은 함수다. */
  api: typeof import('@/gen/api')
  /**
   * 리소스 갈아끼우기와 「혼자만 다른 것」 검사.
   *
   * **`api.ts` 에 없어서 따로 싣는다.** 저 둘은 지금까지 명령(`yarn swap`,
   * `yarn check:odd`)으로만 쓰던 것이라 화면용 입구가 없다. 앱이 부르는 첫
   * 자리가 「양산 시작」이다. `api.ts` 에 얇은 함수를 더할 수도 있었지만,
   * 그쪽은 **forge-ui.bat 화면과 1:1 인 표**라 화면이 안 부르는 것을 끼워 넣으면
   * 그 1:1 이 깨진다.
   */
  swap: typeof import('@/gen/swap')
  odd: typeof import('@/gen/odd')
  /**
   * 못 맞춘 자리의 **갈래를 가리고**(reslot) 낱말 자리를 **새로 세운다**(restock).
   *
   * 둘을 같이 싣는 까닭 — 가린 것을 그대로 받아 세우는 사이라 한쪽만 있으면
   * 쓸 데가 없다. `api.ts` 에 넣지 않은 것은 `swap`·`odd` 와 같은 까닭이다.
   */
  reslot: typeof import('@/gen/reslot')
  restock: typeof import('@/gen/restock')
  /** 폴더의 파일 갈래를 가리는 자리. `spare` 에는 갈래가 안 붙어 온다 */
  files: typeof import('@/gen/files')
  /**
   * 몸·팔로 나눠 쓰는 캐릭터의 **빠진 부품**을 세는 자리.
   *
   * **짚는 쪽과 채우는 쪽이 같은 셈을 써야 한다** — 스펙 규칙
   * `character-parts-consistent` 가 짚고 `partfill.ts` 가 채운다.
   */
  parts: typeof import('@/gen/parts')
  /**
   * 자리를 세울 때 **alias 이름을 바꿔도 되나.** 모듈이 이름을 코드에 박아 두고
   * 찾는 자리(`particle`)를 바꾸면 조용히 깨진다. 잰 셈이라 측정 스크립트와
   * 같은 것을 써야 해서 forge 에 있다(`slots.ts` 가 부른다).
   */
  rolename: typeof import('@/gen/rolename')
  /** 관계의 길 셈 — **열쇠가 alias 인 표**를 스펙에서 읽는다(`familytrim.ts` 가 부른다). */
  relpath: typeof import('@/gen/relpath')
  /** 모듈 완성본 전부가 같은 파일을 쓰는 **공용 리소스** — 원본 폴더에서 가져온다(`commonrsc.ts`). */
  common: typeof import('@/gen/common')
  /** 다른 이름으로 온 새 판 — 공용을 옛 판으로 들여오지 않게(`commonrsc.ts` · `carryrsc.ts`). */
  commonfresh: typeof import('@/gen/commonfresh')
  /** 크기가 정해진 그림 — 스펙 `size` 를 재는 셈(`imgsize.ts` 가 부른다). */
  rscsize: typeof import('@/gen/rscsize')
  /** 폴더가 꼬리 칸을 없애라고 말하나 — 칸 수 카드의 실마리(`tailhint.ts` 가 부른다). */
  tailwit: typeof import('@/gen/tailwit')
  /** 번호로 짝인 이름 무리 — 스펙 `aliasFollows` 의 셈(`aliasfollow.ts` 가 부른다). */
  aliasfollow: typeof import('@/gen/aliasfollow')
  /** figma 화면 PNG 에서 좌표를 찾는 셈(`shotcoords.ts` 가 부른다). */
  placefind: typeof import('@/gen/placefind')
  /** 그림을 화면에 대 보는 셈 — 「딱 맞추기」(`snap.ts`)가 불렀다 (M6). 2026-10-08 에 그 화면을 걷어 지금 앱에서 부르는 곳은 없다. */
  imgfind: typeof import('@/gen/imgfind')
  /** PNG 읽기 — 그림 크기를 재는 곳들(`imgsize.ts` · `rscguide.ts` · `scene.ts` …)이 부른다. */
  png: typeof import('@/gen/png')
  /** activityInfo.json 의 서식 — 「끝」(`done.ts`)이 같은 꼴로 다시 쓴다 (M7). */
  render: typeof import('@/gen/render')
  /** 모듈 소스 폴더(`moduleDir`) — 통째로 맡기기(`whole.ts`)가 AI 에게 모듈 소스를 열어 준다. */
  survey: typeof import('@/gen/surveyfind')
  /** 그림 크기에 맞춰 정한 배율을 다시 셈한다(`assemblevalues.ts` 가 부른다). */
  rescale: typeof import('@/gen/rescale')
  /** figma 화면에 원본 후보의 장면 그림이 있나(`scene.ts` 가 부른다). */
  scenefind: typeof import('@/gen/scenefind')
}

/**
 * 불러 놓은 forge 한 벌. 서비스들이 인자로 주고받는 이름이다.
 *
 * **여기에 둔다** — 「불러 온 것」의 타입이므로 불러 오는 파일의 몫이다.
 * 전에는 `run.ts` 가 갖고 있어서, 실제로 쓰는 파일들이 서로 부르지도 않는
 * 「양산 시작」을 타입 하나 때문에 import 하고 있었다.
 */
export type Forge = ForgeModules

let loading: Promise<ForgeModules> | null = null

/**
 * forge 모듈을 불러온다. 처음 한 번만 실제로 읽고 그 뒤로는 같은 것을 돌려준다.
 * repo 를 찾지 못하면 throw 한다 — 부르는 쪽이 잡아 결과의 `error` 로 바꾼다.
 */
export function loadForge(): Promise<ForgeModules> {
  if (loading) return loading

  loading = (async () => {
    const root = findForgeRoot()
    if (!root) throw new Error(forgeMissingMessage())

    // import 보다 먼저 심어야 한다. 이 한 줄이 이 파일의 존재 이유다.
    process.env['FORGE_REPO_ROOT'] = root

    const [layout, paths, user, spec, api, swap, odd, reslot, restock, files, parts, rolename, relpath, common, commonfresh, rscsize, tailwit, aliasfollow, placefind, imgfind, png, render, survey, scenefind, rescale] =
      await Promise.all([
      import('@/gen/layout'),
      import('@/gen/paths'),
      import('@/gen/user'),
      import('@/gen/spec'),
      import('@/gen/api'),
      import('@/gen/swap'),
      import('@/gen/odd'),
      import('@/gen/reslot'),
      import('@/gen/restock'),
      import('@/gen/files'),
      import('@/gen/parts'),
      import('@/gen/rolename'),
      import('@/gen/relpath'),
      import('@/gen/common'),
      import('@/gen/commonfresh'),
      import('@/gen/rscsize'),
      import('@/gen/tailwit'),
      import('@/gen/aliasfollow'),
      import('@/gen/placefind'),
      import('@/gen/imgfind'),
      import('@/gen/png'),
      import('@/gen/render'),
      import('@/gen/surveyfind'),
      import('@/gen/scenefind'),
      import('@/gen/rescale')
    ])

    // 심은 값이 실제로 먹었는지 확인한다. 안 먹었으면 빈 진행판이 나올 뿐이라
    // 여기서 멈추는 편이 낫다.
    if (resolve(paths.REPO_ROOT) !== resolve(root)) {
      throw new Error(
        `양산기가 다른 폴더를 보고 있습니다(기대한 폴더 ${root}, 실제 폴더 ${paths.REPO_ROOT}).`
      )
    }

    return { root, layout, paths, user, spec, api, swap, odd, reslot, restock, files, parts, rolename, relpath, common, commonfresh, rscsize, tailwit, aliasfollow, placefind, imgfind, png, render, survey, scenefind, rescale }
  })()

  // **실패한 약속을 쥐고 있지 않는다.** 여기 담아 두면 처음 한 번 못 찾은 것이
  // 앱을 끌 때까지 따라다닌다 — 사람이 양산기 폴더를 골라 고쳐도 같은 옛
  // 오류만 나온다. 2026-09-18 에 그 길을 열면서 같이 고쳤다.
  loading.catch(() => {
    loading = null
  })

  return loading
}
