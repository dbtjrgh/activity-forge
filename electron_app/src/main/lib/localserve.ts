/**
 * **내 컴퓨터(127.0.0.1)에서 JSON 한 벌을 잠깐 내준다** — 바깥 웹 페이지의 스크립트가 받아 가게.
 *
 * - 처음 쓴 곳은 팀 일정표 갱신이다(2026-10-12) — 엑셀 웹의 Office Script 가 `fetch` 로 받아 간다.
 *   그 요청의 Origin 이 `null`(샌드박스 iframe)이라 허용 출처를 좁힐 수 없어 `*` 다. 그래서 **오래 열어 두지 않는다** — `ttlMs` 뒤에 닫는다
 * - 같은 자리로 다시 부르면 내용만 바꾸고 닫는 시각을 늦춘다. GET 만 받는다
 * - 크롬의 로컬 네트워크 허용(`Access-Control-Allow-Private-Network`)을 같이 보낸다
 *
 * 도메인을 모른다. Electron 을 import 하지 않는다.
 */
import http from 'node:http'

type Live = { server: http.Server; body: string; timer: NodeJS.Timeout; until: number }
const live = new Map<number, Live>()

export type Served = { ok: true; until: number } | { ok: false; error: string }

function close(port: number): void {
  const one = live.get(port)
  if (!one) return
  clearTimeout(one.timer)
  one.server.close()
  live.delete(port)
}

export function serveJson(port: number, path: string, data: unknown, ttlMs: number): Promise<Served> {
  const body = JSON.stringify(data)
  const until = Date.now() + ttlMs
  const had = live.get(port)
  if (had) {
    clearTimeout(had.timer)
    had.body = body
    had.until = until
    had.timer = setTimeout(() => close(port), ttlMs)
    return Promise.resolve({ ok: true, until })
  }
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Private-Network', 'true')
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET' })
        res.end()
        return
      }
      if (req.method !== 'GET' || req.url !== path) {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(live.get(port)?.body ?? '{}')
    })
    server.once('error', (e: NodeJS.ErrnoException) =>
      resolve({ ok: false, error: e.code === 'EADDRINUSE' ? `${port} 포트를 다른 프로그램이 쓰고 있습니다.` : e.message })
    )
    server.listen(port, '127.0.0.1', () => {
      live.set(port, { server, body, until, timer: setTimeout(() => close(port), ttlMs) })
      resolve({ ok: true, until })
    })
  })
}
