/**
 * **공용 리소스 가져오기** — 그 모듈의 완성본 전부가 같은 파일을 쓰는 자리는
 * 원본 폴더에서 복사해 온다 (2026-09-23, 사용자 요청).
 *
 * 원본 값은 떠 오면서 파일은 안 가져와서, MAL1M07W3S1(영상 모듈)에 영상 하나만
 * 들어왔는데 재생·정지·닫기 단추 · 프레임 · bgm · 지문 넷이 「폴더에 넣어 주세요」로
 * 나왔다. 사람은 앞 회차 폴더에서 복붙해 왔다 — 요구할 것은 **이 회차에만 있는 것**
 * (그 모듈이면 영상과 썸네일)뿐이어야 한다.
 *
 * **무엇이 공용인가는 forge `common.ts` 가 완성본으로 센다** — 모듈 · 자리마다 완성본
 * 전부가 바이트까지 같은 파일을 쓸 때만. 7·8호로 재면 2,340자리 가운데 틀림 3
 * (`tool/commonrsc.ts`). 스펙에 따로 적지 않는 까닭 — 완성본이 늘 때마다 두 벌을
 * 맞춰야 한다(저장소 CLAUDE.md 3번).
 *
 * **이름으로 맞추기 앞에서 돈다.** 새 폴더에 복사해 두면 맞추기의 ①(그대로)이 짝을
 * 짓는다 — 맞추는 길을 따로 내지 않는다. **덮어쓰지 않는다** — 같은 이름으로 새
 * 파일이 와 있으면 그것이 이 회차 것이다. 복사한 뒤 크기를 양쪽에서 센다(`rsccopy.ts`).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { existsSync } from 'node:fs'
import type { InboxResult } from '../../../shared/forge'
import { blank, put } from './rsccopy'
import type { Forge } from './runtime'
import { isTalkCopy, sameVoice, voiceGated } from './voice'
import type { Fresh } from '@/gen/commonfresh'

/** @param fresh 다른 이름으로 온 새 판 — 있으면 그 크기 공용 그림은 안 가져온다(forge `commonfresh.ts`) */
export function copyCommon(forge: Forge, origin: string, code: string, module: string, fresh?: Fresh): InboxResult {
  const dir = forge.files.rscDir(code)
  if (!dir) return blank('', '리소스 폴더 위치를 정하지 못했습니다.')
  // **호 저장소 안에는 안 넣는다.** 리소스 자리(`rscRoot`)를 안 정했으면 자리가 호
  // 저장소의 `public/sparklab` 이 되는데, 이 걸음은 「만들어 보기」에서도 돈다 —
  // 보기만 했는데 남의 저장소에 파일이 생긴다(저장소 CLAUDE.md 「rscRoot」).
  if (!forge.files.rscRoot()) {
    return { ...blank(dir), note: '리소스 위치(rscRoot)를 정하지 않아 공용 파일을 가져오지 않았습니다.' }
  }
  // **폴더를 여기서 만들지 않는다** (2026-09-29 에 고쳤다가 버린 worktree 에만 남아 있던 것을 10-01 에 되살림).
  // 이 걸음은 작업대를 열 때 도는 AI 없이 보기(`make.ts` 의 `look`)에서도 돈다. 복사(`put`)는 빠진 폴더를 통째로 만들어서,
  // 열어 보기만 해도 리소스 폴더와 공용 파일이 생겼다. 폴더는 사람이 만든다(붙여넣기, 놓기, 「폴더 만들고 열기」)
  if (!existsSync(dir)) {
    return {
      ...blank(dir),
      note: '리소스 폴더가 아직 없어 공용 파일을 가져오지 않았습니다. 폴더를 만들거나 파일을 넣으면 그때 가져옵니다.'
    }
  }
  const out = blank(dir)
  // 대사 소리는 성우 성별이 같을 때만 (2026-10-02, `voice.ts`) — 완성본이 모두 같은 대사를 써도 이번 호 성우가 다를 수 있다
  const voiced = sameVoice(forge, code, origin, module) || !voiceGated(forge, code, module)
  const plan = forge.common
    .commonToCopy(origin, code, dir, module, fresh)
    .filter((c) => voiced || !isTalkCopy(c.slot, c.to))
    .map((c) => ({ from: c.from, rel: c.to, to: c.to, bytes: c.bytes }))
  out.found = plan.length
  if (plan.length) put(dir, plan, false, out)
  return out
}

/** 걸음에 적을 한 줄. 가져온 파일을 **다 적는다** — 사람이 틀린 것을 볼 수 있게. */
export function commonNote(r: InboxResult, origin: string): string {
  if (r.error) return r.error
  if (r.note) return r.note
  if (!r.found) return '가져올 공용 파일이 없습니다.'
  const took = r.took.map((t) => t.rel)
  return (
    (took.length
      ? `모듈 완성본이 모두 같은 파일을 쓰는 항목 ${took.length}개를 원본 ${origin} 폴더에서 가져왔습니다 (${took.join(', ')}).`
      : '') +
    (r.failed.length ? ` 파일 ${r.failed.length}개를 가져오지 못했습니다 (${r.failed[0].name}: ${r.failed[0].why}).` : '') +
    (r.clash.length ? ` 이미 다른 파일이 있어 ${r.clash.length}개는 그대로 두었습니다.` : '')
  ).trim()
}

/** 다른 이름으로 새 판이 와 있어 안 가져온 것 — 빈 자리는 크기로 맞추기가 짝짓거나 차례를 묻는다 */
export function freshNote(fresh: Fresh): string {
  const n = fresh.skipped.length
  return n ? `새 버전이 다른 이름으로 와 있어 이전 버전을 가져오지 않은 항목이 ${n}개 있습니다 (${fresh.skipped.slice(0, 3).join(', ')}${n > 3 ? ' …' : ''}).` : ''
}
