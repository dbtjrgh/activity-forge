/**
 * 앱이 띄우는 vite 에만 끼우는 **덧config**.
 *
 * 왜 있나 — 안내 영상(`/storage/guide_movie/<학습코드>.mp4`)은 배포 쪽이 주는
 * 파일이라 호 저장소에 없다. 그래서 개발로 띄우면 시작 패널에서 멈춰 **액티비티가
 * 시작조차 못 한다.** 만든 것을 눈으로 볼 길이 막힌다.
 *
 * **공용 코드(`sparkon_common`)를 고치지 않는다.** 그 파일은 모든 호가 같이
 * 쓰는 것이라, 개발 편의 때문에 손대면 남의 운영까지 따라 바뀐다. 대신 **우리
 * 앱이 띄운 서버에만** 작은 글 한 줄을 끼운다 — 사람이 손으로 `yarn dev` 를
 * 돌리면 이 config 가 안 끼므로 **평소 개발은 그대로다.**
 *
 * 하는 일은 하나뿐이다. 안내 영상이 없어 `<video>` 가 오류를 내면 **「다 봤다」와
 * 같은 자리로 보낸다.** 그러면 액티비티가 시작한다. 영상이 실제로 있으면
 * 오류가 안 나므로 아무 일도 안 일어난다.
 *
 * 호 저장소에는 **파일을 남기지 않는다.** 덧config 는 앱의 임시 폴더에 쓰고
 * 절대 경로로 넘긴다 — 저장소에 남기면 `git status` 가 더러워지고, 그러면
 * 「쓸 수 있나」의 깨끗함 검사(`write.ts` 빗장 ④)가 잘못 걸린다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 페이지에 끼우는 글. **오류가 났을 때만** 움직인다.
 *
 * `error` 는 버블링하지 않으므로 창에서 **가로채기(capture)** 로 받는다.
 * 안내 영상 말고 다른 것이 깨진 것은 건드리지 않는다 — 주소를 보고 가린다.
 */
const SKIP = `<script>
(function () {
  window.addEventListener(
    'error',
    function (e) {
      var v = e.target
      if (!v || v.tagName !== 'VIDEO') return
      if (String(v.currentSrc || v.src).indexOf('/storage/guide_movie/') < 0) return
      console.log('[양산기] 안내 영상이 없어 건너뜁니다 — 앱에서 띄운 서버에서만 그럽니다.')
      v.dispatchEvent(new Event('ended'))
    },
    true
  )
})()
</script>`

/**
 * 호 저장소의 config 를 그대로 쓰되 위 글만 더한 config 를 만들어 그 자리를 돌려준다.
 *
 * **repo 의 config 를 다시 쓰지 않는다.** 별칭(`@_common`)·플러그인이 거기 있고,
 * 옮겨 적으면 두 벌이 되어 갈린다. 그대로 들여와 플러그인 하나만 얹는다.
 */
export function writeDevConfig(repo: string): string {
  const base = join(repo, 'vite.config.ts').replace(/\\/g, '/')
  const text = `import base from ${JSON.stringify(base)}

// 앱이 띄운 서버에만 끼는 것 — 안내 영상이 없으면 「다 봤다」로 보낸다.
const guideSkip = {
  name: 'forge-guide-skip',
  transformIndexHtml(html) {
    return html.replace('</head>', ${JSON.stringify(SKIP)} + '</head>')
  }
}

export default { ...base, plugins: [...(base.plugins ?? []), guideSkip] }
`
  // **한 자리에 덮어쓴다** (M6) — 띄울 때마다 새 임시 폴더를 만들면 쌓이기만 하고 아무도 안 지운다
  const dir = join(tmpdir(), 'sparkon-forge')
  mkdirSync(dir, { recursive: true })
  const at = join(dir, 'vite.forge.config.mts')
  writeFileSync(at, text, 'utf8')
  return at
}
