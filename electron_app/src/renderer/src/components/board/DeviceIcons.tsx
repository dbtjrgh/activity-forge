import type { Devices } from '../../../../shared/forge'

/**
 * 카메라 · 마이크 그림 (2026-10-20) — 진행판 칸 아래 테두리 딱지에 들어간다.
 * 칸이 좁아(12칸) 글자 대신 그림이다. 「확인 필요」(`maybe`)는 흐리게. 뜻은 칸의 툴팁에 글로 있다
 */
const Camera = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
)

const Mic = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </svg>
)

function DeviceIcons({ devices }: { devices: Devices }) {
  return (
    <span className="dev-icons">
      {devices.camera && (
        <span className={devices.camera === 'maybe' ? 'dev-maybe' : ''}>
          <Camera />
        </span>
      )}
      {devices.mic && (
        <span className={devices.mic === 'maybe' ? 'dev-maybe' : ''}>
          <Mic />
        </span>
      )}
    </span>
  )
}

export default DeviceIcons
