/**
 * 열어도 되는 주소인가 — **내 컴퓨터의 http 주소만.**
 *
 * 렌더러가 보낸 글자를 그대로 `shell.openExternal` 이나 창의 `loadURL` 에 넘기면 아무 주소나 열리고,
 * 그중에는 브라우저가 아니라 다른 프로그램을 띄우는 것(`file:`·`ms-…:`)도 있다. 바깥 브라우저(`ipc/index.ts`)와
 * 앱 안 창(`ipc/finish.ts`, M6)이 같이 쓴다 — 두 곳이 따로 거르면 한쪽만 느슨해진다.
 */
export function localHttp(target: string): string | null {
  try {
    const url = new URL(target)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return null
    return url.toString()
  } catch {
    return null
  }
}
