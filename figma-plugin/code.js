/**
 * 스파크온 차례 뽑기 — figma 안에서 **차례와 낱말만** 뽑아 클립보드로 보냅니다.
 *
 * **왜 플러그인인가.** REST API 는 트리를 통째로 줍니다 — 차시 하나에 1,140KB 를
 * 받아 0.7KB 를 씁니다(99.94% 를 버립니다). 게다가 figma 는 **받은 바이트로**
 * 한도를 매겨서, 한 호를 통째로 훑는 것은 아예 못 합니다(49MB).
 * 플러그인은 문서를 **로컬에서** 읽습니다 — 한도가 없고 토큰도 필요 없어,
 * 한 호 36차시를 한 번에 훑어 **25KB 한 장**을 냅니다.
 *
 * **여기서 정하지 않는 것** — 어느 파일이 어느 자리인가. 그건 리소스 폴더에서
 * 풉니다(레이어 이름은 97%가 자동 이름이라 쓸 수 없습니다). 이 플러그인은
 * 앱의 `services/forge/figma/read.ts` 와 **같은 것을 같은 규칙으로** 냅니다.
 *
 * 의존성 없음 — 빌드 단계를 두지 않으려고 그냥 JS 로 씁니다.
 */

/** 활동 이름이 곧 S 번호. `services/forge/figma/name.ts` 와 같은 표입니다. */
var SESSION = {
  'word explorer': 1, 'read together': 1, 'sing along': 1, 'say aloud': 1,
  'story movie': 2, 'story check': 2, 'word adventure': 2, 'write now': 2,
  'word play': 3, 'my mini book': 3, 'sentence fun': 3
}

var SUBJECT = { '영어': 'EN', '국어': 'KO', '수학': 'MA' }

/** 화면 한 장의 크기. forge 의 CANVAS 와 같아야 합니다. */
var CANVAS = { w: 1920, h: 1080 }
var SAME = 0.5

function clean(s) {
  return (s || '').replace(/​/g, '').trim()
}

/** 섹션 이름 하나를 뜯습니다. 하나라도 못 읽으면 null. */
function readSectionName(name) {
  var t = String(name).toLowerCase()
  var issue = /(\d+)\s*호/.exec(t)
  var lv = /lv\.?\s*([123])/.exec(t)
  var wk = /(\d+)\s*주/.exec(t)
  if (!issue || !lv || !wk) return null

  // **가장 긴 것이 이깁니다** — `word play` 와 `word adventure` 처럼 앞머리가
  // 겹치는 이름이 있어, 먼저 찾은 것을 쓰면 짧은 쪽이 가로챕니다.
  var act = ''
  for (var key in SESSION) {
    if (t.indexOf(key) >= 0 && key.length > act.length) act = key
  }
  if (!act) return null

  var week = Number(wk[1])
  if (week > 24) week -= 24 // Lv2 는 한 해를 통째로 세어 25~28주로 적습니다
  if (week < 1 || week > 4) return null

  return { issue: Number(issue[1]), level: Number(lv[1]), week: week, session: SESSION[act] }
}

function subjectOfPage(page) {
  for (var word in SUBJECT) if (String(page).indexOf(word) >= 0) return SUBJECT[word]
  return null
}

function codeOf(subject, p) {
  var mm = p.issue < 10 ? '0' + p.issue : String(p.issue)
  return subject + 'L' + p.level + 'M' + mm + 'W' + p.week + 'S' + p.session
}

/** 값들을 가까운 것끼리 묶어 오름차순 대표값을 냅니다. */
function group(vals, gap) {
  var sorted = vals.slice().sort(function (a, b) { return a - b })
  var out = []
  for (var i = 0; i < sorted.length; i += 1) {
    if (!out.length || sorted[i] - out[out.length - 1] > gap) out.push(sorted[i])
  }
  return out
}

function at(reps, v, gap) {
  for (var i = 0; i < reps.length; i += 1) if (Math.abs(reps[i] - v) <= gap) return i + 1
  return 1
}

/** 그 노드 아래의 TEXT 를 읽는 차례(위→아래, 왼→오른쪽)로 모읍니다. */
function textsIn(node) {
  var out = []
  var stack = [node]
  while (stack.length) {
    var n = stack.pop()
    if (n.type === 'TEXT') {
      var s = clean(n.characters)
      var b = n.absoluteBoundingBox
      if (s && b) out.push({ s: s, x: b.x, y: b.y })
    }
    if (n.children) for (var i = 0; i < n.children.length; i += 1) stack.push(n.children[i])
  }
  out.sort(function (p, q) { return p.y - q.y || p.x - q.x })
  return out.map(function (t) { return t.s })
}

/**
 * 섹션 하나 → 차례와 낱말.
 *
 * **화면만 고릅니다** — 캔버스와 같은 크기인 FRAME 이 한 화면입니다. 안에 든
 * 「디자인 리소스」 섹션이나 쪽지를 세면 이닝 수가 틀어집니다.
 * **차례는 y 가 정합니다** — 자식 차례가 아닙니다.
 */
function readSection(sec) {
  var kids = sec.children || []
  var screens = []
  for (var i = 0; i < kids.length; i += 1) {
    var c = kids[i]
    var b = c.absoluteBoundingBox
    if (c.type !== 'FRAME' || !b) continue
    if (Math.round(b.width) !== CANVAS.w || Math.round(b.height) !== CANVAS.h) continue
    screens.push(c)
  }
  if (!screens.length) return null

  var ys = group(screens.map(function (f) { return f.absoluteBoundingBox.y }), CANVAS.h * SAME)
  var xs = group(screens.map(function (f) { return f.absoluteBoundingBox.x }), CANVAS.w * SAME)

  var shots = screens.map(function (f) {
    var b = f.absoluteBoundingBox
    return {
      id: f.id,
      inning: at(ys, b.y, CANVAS.h * SAME),
      at: at(xs, b.x, CANVAS.w * SAME),
      words: textsIn(f)
    }
  })
  shots.sort(function (a, z) { return a.inning - z.inning || a.at - z.at })

  // **이닝마다 낱말 하나. 하나로 안 좁혀지면 null 입니다** — 아무거나 고르면
  // 여섯 자리가 통째로 밀립니다.
  var words = []
  for (var n = 1; n <= ys.length; n += 1) {
    var seen = []
    for (var k = 0; k < shots.length; k += 1) {
      if (shots[k].inning !== n) continue
      for (var w = 0; w < shots[k].words.length; w += 1) {
        if (seen.indexOf(shots[k].words[w]) < 0) seen.push(shots[k].words[w])
      }
    }
    words.push(seen.length === 1 ? seen[0] : null)
  }

  return { innings: ys.length, words: words, screens: shots }
}

async function main() {
  // 새 API 는 페이지를 필요할 때 읽습니다. 훑기 전에 다 불러 둡니다.
  if (typeof figma.loadAllPagesAsync === 'function') await figma.loadAllPagesAsync()

  var out = { file: figma.root.name, at: new Date().toISOString(), lessons: [], unread: [] }
  var pages = figma.root.children

  for (var p = 0; p < pages.length; p += 1) {
    var page = pages[p]
    var subject = subjectOfPage(page.name)
    var kids = page.children || []
    for (var i = 0; i < kids.length; i += 1) {
      var c = kids[i]
      if (c.type !== 'SECTION') continue
      var parsed = readSectionName(c.name)
      if (!parsed || !subject) {
        out.unread.push(page.name + ' / ' + clean(c.name))
        continue
      }
      var read = readSection(c)
      if (!read) {
        out.unread.push(page.name + ' / ' + clean(c.name) + ' (화면이 없습니다)')
        continue
      }
      out.lessons.push({
        code: codeOf(subject, parsed),
        section: clean(c.name),
        id: c.id,
        innings: read.innings,
        words: read.words,
        screens: read.screens
      })
    }
  }

  figma.showUI(__html__, { width: 460, height: 460 })
  figma.ui.postMessage(out)
}

main().catch(function (e) {
  figma.showUI(__html__, { width: 460, height: 460 })
  figma.ui.postMessage({ error: String((e && e.message) || e) })
})
