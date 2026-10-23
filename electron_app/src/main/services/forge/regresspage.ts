/**
 * **회귀 검사가 페이지에 넣는 글** (2026-10-15) — 숨긴 창(`main/regress.ts`)이 이 글을 그대로 평가한다. 모듈별 자동 진행은 `regressdrivers.ts`.
 *
 * - `earlyScript` 는 **페이지 글보다 먼저** 돈다(CDP `Page.addScriptToEvaluateOnNewDocument`). 셋을 한다 —
 *   ① 숨긴 창은 `backgroundThrottling: false` 여도 requestAnimationFrame 이 초당 1번이라(잼: M28 하나 342초) 타이머로 바꾼다.
 *   ② 시계(performance.now · Date.now · setTimeout · setInterval · rAF 시각)를 `warp` 배로 빠르게 한다 — 나레이션은 Howler 가
 *   소리 길이만큼 setTimeout 으로 끝을 알리므로 같이 빨라진다(소리는 창째 음소거). 영상은 재생 속도를 올린다.
 *   gsap 는 읽을 때 `Date.now` 를 잡아 두므로 페이지 글보다 먼저여야 한다.
 *   ③ alert · confirm · prompt 를 막는다 — 대화상자는 페이지 메인 스레드를 붙잡아 평가가 안 돌아온다. 막은 것은 오류 줄로 남는다
 * - `harness` 는 시작을 기다리고 끝 화면(`SparkApp.eop`) · 이닝 표시(`mainMenu.inningDisplay`)를 지켜본다.
 *   `SparkApp` 은 개발 서버에서 `window.__PIXI_APP__` 로 열려 있다(Application.ts `_bindSystemEvent`) — 모듈 주소로 다시 불러오지 않는다
 * - 손가락(`h.drag` · `h.tap`)은 **캔버스에 진짜 포인터 이벤트**를 낸다 — 모듈의 끌기 · 판정 길을 그대로 탄다.
 *   모듈 객체에 이벤트를 바로 내면 끌기 상자를 건너뛰어 모듈이 없는 오류(`removeChild` of null)를 낸다(2026-10-15 M28 에서 잼)
 * - **모든 글은 끝에 값 하나를 둔다**(`'started'`) — 비동기 함수를 그대로 평가하면 끝날 때까지 안 돌아온다(함정)
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

export type PageMode = 'full' | 'first'

/** 페이지 글보다 먼저 — rAF 를 타이머로, 시계를 `warp` 배로. 영상은 소리를 끄고 빠르게 */
export const earlyScript = (warp: number): string => `;(() => {
  const W = ${Number(warp) || 1}
  const rp = performance.now.bind(performance), rd = Date.now
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window)
  const p0 = rp(), d0 = rd()
  const now = () => p0 + (rp() - p0) * W
  performance.now = now
  Date.now = () => Math.floor(d0 + (rp() - p0) * W)
  window.setTimeout = (fn, ms, ...a) => st(fn, (Number(ms) || 0) / W, ...a)
  window.setInterval = (fn, ms, ...a) => si(fn, Math.max(1, (Number(ms) || 0) / W), ...a)
  window.requestAnimationFrame = (cb) => st(() => cb(now()), 16)
  window.cancelAnimationFrame = (id) => clearTimeout(id)
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...a) {
    try { this.muted = true; this.playbackRate = Math.min(16, W) } catch (e) {}
    return play.apply(this, a)
  }
  // 대화상자는 페이지를 멈추고(숨긴 창이어도) 창을 띄울 수 있다 — 띄우지 않고 오류 줄로 남긴다. 확인 · 입력은 「취소」로 답한다
  const block = (kind, answer) => (m) => { console.error('페이지가 ' + kind + ' 창을 띄우려 해서 막았습니다: ' + String(m == null ? '' : m).slice(0, 100)); return answer }
  window.alert = block('alert', undefined)
  window.confirm = block('confirm', false)
  window.prompt = block('prompt', null)
})()`

/** 첫 이닝까지만 볼 때 — 이닝 표시가 뜬 뒤 이만큼(페이지 시계 ms) 더 오류를 본다 */
const FIRST_SETTLE = 3000
/** 이닝 표시가 이만큼(페이지 시계 ms) 안 뜨면 첫 이닝을 확인하지 못한 것으로 끝낸다 */
const FIRST_GIVEUP = 30000

/** 공통 손 — `window.__regress` 에 형편을 두고 `h` 를 자동 진행에 빌려준다 */
export const harnessScript = (mode: PageMode): string => `;(() => {
  if (window.__regress) return
  const MODE = ${JSON.stringify(mode)}
  const R = (window.__regress = { phase: 'load', done: false, reached: false, log: [], shown: null, complete: null, data: null, note: '' })
  const t0 = performance.now()
  const at = () => ((performance.now() - t0) / 1000).toFixed(1)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)) }
  const S = () => window.__PIXI_APP__
  const toClient = (g) => {
    const app = S(), r = app.canvas.getBoundingClientRect()
    return { x: r.left + (g.x * r.width) / app.screen.width, y: r.top + (g.y * r.height) / app.screen.height }
  }
  const fire = (type, p) => S().canvas.dispatchEvent(new PointerEvent(type, { clientX: p.x, clientY: p.y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }))
  const finish = (reached, note) => { if (R.done) return; R.reached = reached; if (note) R.note = R.note || note; R.done = true; R.phase = 'end'; R.log.push(at() + ' 끝 — ' + (note || (reached ? '도착' : '못 감'))) }
  R.h = {
    sleep, frames,
    log: (m) => { R.log.push(at() + ' ' + m); if (R.log.length > 60) R.log.shift() },
    stuck: (m) => finish(false, m),
    center: (o) => { const b = o.getBounds(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } },
    async drag(from, to, steps = 6) {
      const a = toClient(from), b = toClient(to)
      fire('pointerdown', a); await frames(2)
      for (let i = 1; i <= steps; i++) { fire('pointermove', { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps }); await frames(1) }
      await frames(2); fire('pointerup', b); await frames(2)
    },
    async tap(g) { const a = toClient(g); fire('pointerdown', a); await frames(1); fire('pointerup', a); await frames(1) },
    // 누를 것 — 그 안에서 입력을 받는 첫 객체(단추 그릇은 자리가 0,0 부터 잡혀 가운데가 빗나간다, M05)
    hit(o) { const q = [o]; while (q.length) { const x = q.shift(); if (x.visible !== false && (x.eventMode === 'static' || x.eventMode === 'dynamic')) return x; for (const c of x.children || []) q.push(c) } return o },
    // 그 가운데를 누르면 정말 그것이 받나 — 나레이션 동안 화면을 덮는 막(M01 터치 막기)이 있으면 아니다
    reach(o) {
      const t = R.h.hit(o), c = R.h.center(t), eb = S().renderer.events.rootBoundary
      eb.rootTarget = S().renderer.lastObjectRendered
      for (let x = eb.hitTest(c.x, c.y); x; x = x.parent) if (x === t || x === o) return true
      return false
    },
    // 받을 수 있을 때까지 기다렸다 누른다. 끝내 가려져 있으면 false
    async press(o, waits = 600) {
      for (let i = 0; i < waits && !R.done && !R.h.reach(o); i++) await sleep(200)
      if (!R.h.reach(o)) return false
      await R.h.tap(R.h.center(R.h.hit(o)))
      return true
    },
    // 그 안에서 다른 입력 받는 자식(단추 속 스피커 — M01 type2 · type4)을 피한 자리. 가운데에 가까운 것부터
    spot(o) {
      const b = o.getBounds(), kids = [], q = [...(o.children || [])]
      while (q.length) { const x = q.shift(); if (x.visible === false) continue; if (x.eventMode === 'static' || x.eventMode === 'dynamic') kids.push(x.getBounds()); for (const c of x.children || []) q.push(c) }
      const pts = []
      for (let i = 1; i < 6; i++) for (let j = 1; j < 4; j++) pts.push({ x: b.x + (b.width * i) / 6, y: b.y + (b.height * j) / 4 })
      const c = R.h.center(o), free = (p) => !kids.some((k) => p.x >= k.x && p.x <= k.x + k.width && p.y >= k.y && p.y <= k.y + k.height)
      return pts.filter(free).sort((p, r) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(r.x - c.x, r.y - c.y))[0] || c
    },
    // 페이지가 이미 불러온 모듈을 같은 주소로 — 같은 인스턴스다(다른 주소로 부르면 다른 인스턴스, 함정). 없으면 null
    async mod(tail) { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.split('?')[0].endsWith(tail)); return u ? import(u) : null },
    find(name) {
      const root = S() && S().mCurrentScene, q = root ? [[root, 0]] : []
      while (q.length) { const [o, d] = q.shift(); if (o.constructor && o.constructor.name === name) return o; if (d < 4) for (const c of o.children || []) q.push([c, d + 1]) }
      return null
    },
    async wait(get, tries = 300) { for (let i = 0; i < tries; i++) { const v = get(); if (v) return v; await sleep(200) } return null }
  }
  ;(async () => {
    // 안내 영상은 서버 덧config 가 404 를 「다 봤다」로 보내 저절로 시작한다. 영상이 없는 판(누리)만 시작 단추를 누른다.
    // 영상 판에서 누르면 패널이 닫히는 사이에 눌려 모듈 밖 오류(null 의 play)가 난다 — 영상을 한 번이라도 봤으면 오래 기다린 뒤에만 누른다
    let clicked = false, sawVideo = false
    // 리소스 받기는 실제 시각대로 걸린다 — 페이지 시계로 480초(8배면 실제 60초)까지 기다린다
    for (let i = 0; i < 4800 && !(S() && S().isStarted); i++) {
      const img = document.querySelector('img[src*="video_play_btn_n"]')
      if (document.querySelector('video')) sawVideo = true
      if (img && !clicked && (!sawVideo || i > 400)) { clicked = true; R.log.push(at() + ' 시작 단추'); img.click() }
      await sleep(100)
    }
    if (!(S() && S().isStarted)) return finish(false, '시작하지 못했습니다.')
    R.phase = 'run'; R.log.push(at() + ' 시작')
    let firstAt = null
    const t1 = performance.now()
    while (!R.done) {
      const app = S()
      try {
        const d = app.mainMenu.inningDisplay
        R.shown = Math.max(R.shown || 0, d.mInningMarkers.length)
        R.complete = Math.max(R.complete || 0, d.completeCount)
        if (firstAt === null && d.isShow) { firstAt = performance.now(); R.log.push(at() + ' 이닝 표시') }
      } catch (e) {}
      // 공용 이닝 표시를 안 쓰는 모듈(협력사 계열)은 장면의 이닝 수로 첫 이닝을 본다
      const sc = app.mCurrentScene
      if (firstAt === null && sc && typeof sc.inningCount === 'number' && sc.inningCount >= 1) { firstAt = performance.now(); R.log.push(at() + ' 첫 이닝(장면)') }
      if (app.eop && app.eop.visible) return finish(true, MODE === 'first' ? '끝 화면까지 갔습니다.' : '')
      if (MODE === 'first') {
        if (firstAt !== null && performance.now() - firstAt > ${FIRST_SETTLE}) return finish(true, '')
        if (firstAt === null && performance.now() - t1 > ${FIRST_GIVEUP}) { R.reached = null; R.note = '이닝 표시가 뜨지 않아 첫 이닝은 확인하지 못했고 켜진 뒤의 오류만 봤습니다.'; R.done = true; R.phase = 'end'; return }
      }
      await sleep(200)
    }
  })()
})()`

/** 지금 형편 — 메인이 1초마다 읽는다. 이닝 표시를 안 쓰는 모듈은 자동 진행이 센 것(`R.track`)을 쓴다 */
export const SNAPSHOT = `(() => {
  const R = window.__regress, t = R && R.track
  return JSON.stringify(R ? { phase: R.phase, done: R.done, reached: R.reached, shown: t ? t.total : R.shown, complete: t ? t.done : R.complete, data: R.data, note: R.note, log: R.log.slice(-12) } : null)
})()`
