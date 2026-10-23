/**
 * 학습할 때 켜는 장치 (2026-10-20) — 셈은 `services/forge/devices.ts` 하나다(모듈 표 · GameData 조건 · 액티비티 폴더 코드).
 * `yes` — 켠다. `maybe` — 모듈은 켤 수 있는데 조건(GameData)을 아직 못 봤다(개발 완료 전). 안 켜면 그 칸이 없다
 */
export type DeviceUse = 'yes' | 'maybe'

export interface Devices {
  camera?: DeviceUse
  mic?: DeviceUse
  /** 무엇 때문인가 — 「M30 모듈」 · 「액티비티 폴더의 코드」 */
  why: string
}
