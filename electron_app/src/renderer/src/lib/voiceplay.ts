/**
 * **소리를 푼다 · 튼다** (2026-10-02, 받을 리소스 창 「대사 성우」).
 *
 * 메인(Node)에는 mp3 를 풀 길이 없다 — 화면의 WebAudio 가 푼다. 바이트는 IPC 로 받는다(`guideVoiceHear`).
 * `<audio src="data:…">` 를 쓰지 않는 것은 CSP(`media-src`)를 넓히지 않으려는 것이다.
 *
 * 목소리 높이(Hz)를 재서 「높은 · 낮은 목소리」로 적던 것은 걷었다(2026-10-06) — 아이 목소리는 남자 성우도 220~345Hz 로 잡혀
 * 9호 K33 남자 성우가 「높은 목소리 222Hz」로 나왔다. 성별은 사람이 들어 보고 정한다(스펙 `voices`).
 */

let ctx: AudioContext | null = null
const audio = (): AudioContext => (ctx ??= new AudioContext())

export function decode(bytes: Uint8Array): Promise<AudioBuffer> {
  // decodeAudioData 는 버퍼를 넘겨받아 비운다 — 사본을 준다
  return audio().decodeAudioData(bytes.slice().buffer)
}

let playing: AudioBufferSourceNode | null = null
/** 틀던 것은 멈추고 이것을 튼다 */
export function play(buffer: AudioBuffer): void {
  playing?.stop()
  const s = audio().createBufferSource()
  s.buffer = buffer
  s.connect(audio().destination)
  s.start()
  playing = s
}
