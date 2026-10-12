/** 바이트를 사람이 읽는 단위로 변환한다. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toLocaleString('ko-KR')} B`
  const units = ['KB', 'MB', 'GB', 'TB', 'PB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`
}

/** epoch ms 를 'YYYY-MM-DD HH:mm' 로 변환한다. */
export function formatDate(epochMs: number | null): string {
  if (!epochMs) return '알 수 없음'
  const d = new Date(epochMs)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`
}

/** 지금부터 얼마 전인가 — 「3분 전」 · 「2일 전」. 모르면 「—」 */
export function formatAgo(epochMs: number | null, now = Date.now()): string {
  if (!epochMs) return '—'
  const s = Math.max(0, Math.round((now - epochMs) / 1000))
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}

/** Windows FileSystemRights 토큰 → 한국어 라벨 */
const RIGHT_LABELS: Record<string, string> = {
  FullControl: '모든 권한',
  Modify: '수정',
  ReadAndExecute: '읽기 및 실행',
  Read: '읽기',
  Write: '쓰기',
  ListDirectory: '폴더 내용 보기',
  ReadData: '읽기',
  CreateFiles: '파일 만들기',
  WriteData: '쓰기',
  AppendData: '폴더 만들기',
  CreateDirectories: '폴더 만들기',
  Delete: '삭제',
  DeleteSubdirectoriesAndFiles: '하위 항목 삭제',
  ReadAttributes: '속성 읽기',
  WriteAttributes: '속성 쓰기',
  ReadExtendedAttributes: '확장 속성 읽기',
  WriteExtendedAttributes: '확장 속성 쓰기',
  ExecuteFile: '실행',
  Traverse: '폴더 통과',
  ReadPermissions: '권한 읽기',
  ChangePermissions: '권한 변경',
  TakeOwnership: '소유권 가져오기',
  SpecialRights: '특수 권한'
}

/** 동기화 권한은 거의 모든 항목에 붙고 사용자에게 의미가 없어 표시하지 않는다. */
const HIDDEN_RIGHTS = new Set(['Synchronize'])

/** "Modify, Synchronize" → "수정" 처럼 사람이 읽을 권한 문자열로 바꾼다. */
export function describeRights(rights: string): string {
  const labels = rights
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token && !HIDDEN_RIGHTS.has(token))
    .map((token) => RIGHT_LABELS[token] ?? token)

  return [...new Set(labels)].join(', ') || '권한 없음'
}

/** 계정 이름에서 도메인/컴퓨터 부분을 떼어 짧게 표시한다. */
export function shortPrincipal(principal: string): string {
  const index = principal.lastIndexOf('\\')
  return index >= 0 ? principal.slice(index + 1) : principal
}

/** 리소스 갈래(`image`·`sound`…)를 사람 말로. 모르는 갈래는 그대로 보인다. */
const KIND_NAME: Record<string, string> = {
  image: '그림',
  sound: '소리',
  lottie: '로티',
  video: '영상',
  font: '글꼴'
}

/**
 * `name` 을 주면 **영상은 「영상」**이다 (2026-09-23). AssetTable 은 mp4 를 그림 목록에
 * 올리지만(AssetManager 로 읽는다) 사람에게는 그림이 아니다.
 */
export function kindName(kind: string, name?: string): string {
  if (name && name.toLowerCase().endsWith('.mp4')) return '영상'
  return KIND_NAME[kind] ?? kind
}

/** 종류 색 클래스 — 색은 `assets/styles/base.css` 의 `--kind-*`. 관리 · 작업대 · 받을 리소스 창이 같은 종류를 같은 색으로 보인다 */
export function kindClass(kind: string, name?: string): string {
  if (name && name.toLowerCase().endsWith('.mp4')) return 'kind-video'
  return kind in KIND_NAME ? `kind-${kind}` : 'kind-other'
}
