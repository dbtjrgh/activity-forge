/**
 * **받을 리소스 창**의 모양 (2026-09-30) — 앞 학습코드가 쓴 리소스를 그림으로 보여 준다.
 * figma 옆에 켜 두고 **보이는 것만 내보내게** 하려는 창이다. 전에는 사람이 앞 호 폴더를 열어 보고 figma 로 갔다.
 */

/**
 * 이번 폴더에서의 형편. **이름이 같은 것만 「왔음」이다** — 크기가 맞는 파일은 실마리라 따로 둔다(저장소 CLAUDE.md 6번).
 *   name  같은 이름의 파일이 왔다
 *   set   이름은 다르지만 AI · 사람이 이 폴더의 파일로 정했다(`_recipe/<코드>.answer.json`) — `pick` 이 그 파일
 *   hint  이름은 다르지만 크기(그림) · 수(소리 · 영상)가 맞는 파일이 왔다 — 만들 때 크기 · AI 로 맞춘다
 *   auto  앱이 앞 호에서 가져온다(공용 · 돌려 쓰는 파일) — 안 받아도 된다
 *   wait  아직
 */
export type GuideState = 'name' | 'set' | 'hint' | 'auto' | 'wait'

export interface GuideItem {
  /** 원본 폴더 안 자리 — `images/btn_01.png` */
  rel: string
  name: string
  /** image · video · sound · lottie — 영상(mp4)은 AssetTable 이 그림에 올리지만 따로 센다 */
  kind: string
  /** 그림 크기(px). 그림이 아니거나 못 읽으면 null */
  w: number | null
  h: number | null
  state: GuideState
  /** `set` 일 때 정한 파일 — `images/Group 33117.png` */
  pick?: string
  /** 같은 크기 여럿(그림) · 이름이 다른 것이 모자람(소리 · 영상, `size` 빈 글) — 「5장 중 2」. **어느 것이 왔는지는 모른다** */
  group?: { size: string; of: number; got: number }
  /** `hint` 가 크기가 아니라 **수로** 잡힌 그림 — 이름도 크기도 다른 파일이 같은 수만큼 왔다 (2026-10-02) */
  byCount?: boolean
  /** 대사 소리 — 이닝 낱말 · 배경음이 아닌 소리. 성우 성별이 같은 앞 호에서 한 묶음째 고른다(`voice.ts`) */
  talk?: boolean
}

/**
 * 이번 폴더에 놓인 파일 하나 (2026-10-12) — 무엇을 넣었고 무엇을 빼먹었나 보게. `to` 는 **사실만** 적는다.
 *   name  원본에 같은 이름이 있다
 *   set   AI · 사람이 원본의 그 항목으로 정했다
 *   size  이름은 다르고, 아직 안 온 원본 그림 가운데 크기가 같은(절반 · 두 배 포함) 것이 있다 — 여럿이면 어느 것인지 모른다
 *   none  이름도 크기도 맞는 원본이 없다(소리 · 로티는 크기가 없어 늘 여기)
 */
export interface GuideFile {
  /** 이번 폴더 안 자리 — `images/Group 33117.png` */
  rel: string
  name: string
  kind: string
  w: number | null
  h: number | null
  how: 'name' | 'set' | 'size' | 'none'
  /** 짝인 원본 이름 — `size` 면 크기가 같은 원본 전부 */
  to: string[]
}

export interface RscGuide {
  code: string
  module: string
  /** 베낄 앞 학습코드 — 만들 때 쓰는 것 그대로(받은 그림 크기로 바꾼 것까지) */
  origin: string
  /** 크기로 원본을 바꿨으면 그 까닭 한 줄 */
  originNote?: string
  items: GuideItem[]
  /**
   * 기획서에 적힌 이 학습코드 소리 이름 가운데 없는 것(`rsccount.ts` `planGap`) — 창의 「소리」 할 일은 이것만 본다 (2026-10-28).
   * 원본 소리 이름(`SL_ko_321_s1_nar06`)은 이 학습코드 이름이 될 수 없어 끝까지 「아직」이라 할 일과 진행을 흐렸다.
   * `note` 가 있으면 기획서로 못 셌다(영어 · 기획서 없음) — 그때는 원본 이름으로 센다
   */
  plan: { names: number; note: string; missing: string[]; unsure: string[] }
  /**
   * 리소스 폴더에는 없고 호 저장소(`public/sparklab/<코드>`)에만 있어 들어온 것으로 센 파일 수 (2026-10-28).
   * 끝낸 학습코드는 리소스 폴더를 정리해 거기에만 남는다. `mine` 에는 안 든다
   */
  hall: number
  /**
   * 개발 완료한 학습코드인가 (2026-10-28) — 그러면 할 일 칸은 개수를 안 세고 한 줄만 보인다.
   * 원본과 견주면 이번 호가 원본보다 적게 쓴 것(물건 6개 → 악기 5개)까지 「아직 없음」으로 나왔다
   */
  finished: boolean
  /** 이번 폴더에 놓인 파일 전부 — 이름이 달라도 */
  mine: GuideFile[]
  /** 이번 리소스 폴더 — 창은 만들지 않는다. 없으면 `exists: false` */
  dir: string
  exists: boolean
  error?: string
}
