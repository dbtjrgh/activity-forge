/**
 * 옆줄의 진행판 목록과 호 이름 — `./board.ts` 에서 뗐다(2026-10-21, 200줄을 넘어서. 동작 변화 없음). 왜 모양을 여기 적는지는 `../forge.ts` 머리말.
 */

/** 어느 과목·호의 진행판인지 */
export interface BoardKey {
  subject: string
  issue: string
}

/** 진행판 목록 한 줄 — 닫을 수 있나까지 (M7). 빈 글이면 닫을 수 있고, 아니면 못 닫는 까닭 */
export interface BoardItem extends BoardKey {
  closeWhy: string
  /** 개발 끝(activityInfo.json devFinished)인 칸 수 — 옆줄이 색으로 보인다. 못 셌으면 null */
  done: number | null
  /** 셀 칸 수 — 36 에서 배치표가 뺀 칸(국어 협력사 몫)을 뺀 것 */
  total: number
}

/**
 * 진행판 목록 — 그리고 **열 수 있는 다음 호**(M7). **과목마다 따로 센다**(2026-10-21 — 누리가 1호부터라 한 줄로 세면 영어 · 수학 · 국어 새 호를 막는다).
 * 호마다 한 줄 「+ 1호(M01) 누리 열기」, 호 차례(`hoOrder`). 열 것이 없으면 빈 목록 — 셈은 `services/forge/board.ts` `opensOf`
 */
export interface BoardList {
  boards: BoardItem[]
  opens: { issue: string; subjects: string[] }[]
  error?: string
}

/**
 * **M 번호 → 호 이름** (2026-09-29). 호 저장소 커밋이 스스로 부르는 이름에서 뽑았다 — 「9호(M08) 차시 36개 골격」 · 「6호(M11)」 · 「M11 방학호」.
 * **+1 이 아니다** — 6호가 방학호라 M11 이고, 7~11호는 M06~M10 이다. 처음에 +1 로 짐작해 옆줄에 「M11 12호」 「M01 2호」가 떴다.
 * M12 는 12호(겨울 방학호)다(2026-10-21) — deploy `devops_app/src/util/studyCode.ts` 의 `MONTH_ORDER`(1 2 3 4 5 11 6 7 8 9 10 12)와 `VACATION_NAME`.
 * 이 PC 에는 sparkon_m12 가 없지만 실행 파일을 받은 사람은 받아 둔다 — 빠져 있으면 처음 설정 점검표와 옆줄이 「M12」로만 불렀다.
 * 표에 없는 M(아직 커밋이 이름을 안 준 호)은 호 이름을 붙이지 않는다 — 짐작을 확정처럼 보이지 않는다.
 * forge 명령줄에 같은 표가 한 벌 더 있다(forge `src/gen/honame.ts`, forge 는 앱을 import 하지 않는다) — 호를 더하면 같이 고친다.
 */
export const HO_OF: Record<string, { name: string; order: number }> = {
  '01': { name: '1호', order: 1 },
  '02': { name: '2호', order: 2 },
  '03': { name: '3호', order: 3 },
  '04': { name: '4호', order: 4 },
  '05': { name: '5호', order: 5 },
  '11': { name: '6호(방학)', order: 6 },
  '06': { name: '7호', order: 7 },
  '07': { name: '8호', order: 8 },
  '08': { name: '9호', order: 9 },
  '09': { name: '10호', order: 10 },
  '10': { name: '11호', order: 11 },
  '12': { name: '12호(방학)', order: 12 }
}

/** 화면에 부를 호 이름 — 「9호(M08)」. 표에 없는 M 은 M 번호만 */
export const hoLabel = (m: string): string => (HO_OF[m] ? `${HO_OF[m].name}(M${m})` : `M${m}`)

/** 방학호인가 — 표에서 이름이 「(방학)」 으로 끝나는 호(M11 · M12). 표에 없는 M 은 아니다(공유 폴더 영어 레벨 공통 자리, `shareruleen.ts`) */
export const isVacation = (m: string): boolean => HO_OF[m]?.name.endsWith('(방학)') ?? false

/** 호 차례 — 6호가 방학호 M11 이라 M 번호 차례와 다르다. 표에 없는 M 은 맨 뒤에 M 번호로 */
export const hoOrder = (m: string): number => HO_OF[m]?.order ?? 100 + Number(m)

/**
 * 호 차례로 다음 호 — 5호(M05) 다음은 6호(M11), 6호 다음은 7호(M06), 11호(M10) 다음은 12호(M12) (2026-10-21, 「호 열기」 `opensOf`).
 * 표가 다음 호를 모르면(12호 뒤 · 표에 없는 M) M 번호 + 1 이다 — 여는 쪽이 그 호 저장소가 있을 때만 연다
 */
export function hoNext(m: string): string {
  const at = HO_OF[m]?.order
  const known = at === undefined ? undefined : Object.keys(HO_OF).find((k) => HO_OF[k]?.order === at + 1)
  return known ?? String(Number(m) + 1).padStart(2, '0')
}
