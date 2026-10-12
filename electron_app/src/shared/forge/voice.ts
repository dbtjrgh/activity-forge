/**
 * **대사 성우** — 받을 리소스 창의 「박사 목소리」 칸 (2026-10-02, 메인 `services/forge/voice.ts` · `voiceset.ts`).
 *
 * 같은 모듈이어도 호마다 대사 성우가 남자 · 여자로 갈린다(K36 1호 남 · 2 · 5 · 6 · 7 · 9호 여). 앞 호 대사를 돌려 쓰면
 * 성별이 다른 목소리가 섞인다 — 그래서 학습코드마다 성별을 스펙(`voices`)에 적어 두고, 같은 성별의 대사만 가져온다.
 */

export type VoiceGender = '여' | '남'

/** 그 모듈을 쓴 완성본 하나의 대사 묶음 */
export interface VoiceSet {
  code: string
  /** 스펙에 적힌 성별 — 모르면 null */
  gender: VoiceGender | null
  why: string
  /** 대사 자리 가운데 그 완성본 폴더에 파일이 있는 수 */
  files: number
  /** 이 학습코드 폴더에 지금 들어 있는 대사가 이 완성본 것과 바이트까지 같은 수 */
  same: number
  /** 대사 묶음이 바이트까지 같아 이 줄에 묶인 다른 학습코드 */
  twins: string[]
}

export interface VoiceInfo {
  code: string
  module: string
  /** 대사 자리(소리 별칭) — 이닝 낱말 · 배경음은 뺀다 */
  talk: string[]
  /** 이 학습코드의 성별 — 모르면 null */
  gender: VoiceGender | null
  why: string
  sets: VoiceSet[]
  /** 대사 자리 가운데 이 폴더에 파일이 있는 수(답으로 정한 것 · 원본 이름 그대로 온 것) */
  have: number
  /** 성별이 달라도 지금 폴더의 대사를 그대로 쓰기로 했나 */
  kept: boolean
  error?: string
}

/** 고르기 · 적기 결과 — 다시 읽은 형편을 같이 */
export interface VoiceDone {
  ok: boolean
  note: string
  info: VoiceInfo
  error?: string
}
