import type { Devices } from '../../../shared/forge'

/**
 * 학습할 때 켜는 카메라 · 마이크를 적는 꼴 (2026-10-20) — 진행판 칸 툴팁. 칸에는 그림 딱지(`DeviceIcons.tsx`)만 붙고 따로 모은 목록은 없다
 * (사용자 말 — 「위에 따로 마이크 카메라 보여줄 필요는 없어」). 셈은 메인 `services/forge/devices.ts` 하나다
 */

/** 칸에 올렸을 때 보일 한 마디 — 「카메라 사용, 마이크 사용 여부 확인 필요 (M30 모듈)」 */
export function deviceLine(d: Devices): string {
  const part = (name: string, use?: string): string => (use === 'yes' ? `${name} 사용` : `${name} 사용 여부 확인 필요`)
  const parts = [d.camera && part('카메라', d.camera), d.mic && part('마이크', d.mic)].filter(Boolean)
  return `${parts.join(', ')} (${d.why})`
}
