import { execSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// 개발 시에는 Vite HMR 프리앰블(inline script)을 허용하고,
// 프로덕션 빌드에서는 엄격한 CSP를 index.html에 주입한다.
function csp(): Plugin {
  return {
    name: 'inject-csp',
    transformIndexHtml(html, ctx) {
      const dev = Boolean(ctx.server)
      const policy = dev
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: http:"
        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
      return html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${policy}" />`
      )
    }
  }
}

/**
 * **실제 대소문자 경로로 시작한다** (2026-10-01) — 폴더는 `D:\Work` 인데 `D:\work` 에서 빌드하면, rollup 이 같은 파일을
 * 경로 글자가 다른 두 모듈로 묶었다(vite 가 import 를 풀 때 어떤 것은 실제 이름으로 바꾸고 어떤 것은 그대로 둔다).
 * 메인 코드가 통째로 두 벌이 되어 `configureHome` 이 적은 설정 위치를 초기 설정이 못 봤다 — 한 벌은 쓰기만, 한 벌은 읽기만 해서
 * rollup 이 둘 다 빈 글로 접었다. 입구 · 별칭을 실제 경로로 주면 한 벌로 모인다. **아래 경로는 모두 `here` 로 적는다**
 */
const here = realpathSync.native(__dirname)

/**
 * **이 빌드가 어느 커밋에서 언제 나왔나** (2026-10-01) — 앱 새 버전을 받을지 가리는 표(`services/forge/appupdate.ts` · `main/boot.ts`).
 * 고친 것이 남아 있으면 커밋 뒤에 -dirty 를 붙인다 — 그 커밋 그대로가 아니다.
 */
function stampNow(): { source: string; builtAt: number; version: string } {
  const run = (cmd: string): string => {
    try {
      return execSync(cmd, { cwd: here, encoding: 'utf8' }).trim()
    } catch {
      return ''
    }
  }
  const sha = run('git rev-parse HEAD')
  const dirty = run('git status --porcelain --untracked-files=no') !== ''
  // 사람이 읽는 판 번호 — package.json 의 version. 받은 앱(userData/app)은 app.getVersion() 이 실행 파일 것이라 여기 박는다 (2026-10-02)
  const version = (JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8')) as { version?: string }).version ?? ''
  return { source: sha ? `${sha}${dirty ? '-dirty' : ''}` : 'unknown', builtAt: Date.now(), version }
}
const STAMP = stampNow()

function buildStamp(): Plugin {
  return {
    name: 'build-stamp',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(STAMP) })
    }
  }
}

export default defineConfig({
  main: {
    resolve: {
      alias: {
        // forge 안에서 쓰는 별칭. 그쪽 tsconfig 의 paths 와 같은 짝이어야 한다.
        '@': resolve(here, '../forge/src')
      }
    },
    define: {
      __APP_STAMP__: JSON.stringify(STAMP)
    },
    build: {
      rollupOptions: {
        // boot 가 입구다(package.json main) — 받아 둔 앱 새 버전과 들어 있는 것 가운데 새것을 연다
        input: {
          index: resolve(here, 'src/main/index.ts'),
          boot: resolve(here, 'src/main/boot.ts')
        }
      }
    },
    // 받아 둔 새 버전은 app.asar 밖에서 돈다 — 거기서는 node_modules 를 못 찾으니 묶어 넣는다
    plugins: [externalizeDepsPlugin({ exclude: ['@electron-toolkit/utils'] }), buildStamp()]
  },
  preload: {
    // sandbox: true 인 preload는 node_modules를 require 할 수 없으므로 번들에 포함시킨다.
    plugins: [externalizeDepsPlugin({ exclude: ['@electron-toolkit/preload'] })]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    server: {
      fs: {
        // renderer 의 root 는 src/renderer 다. 그 밖(src/shared 등)의 파일을 dev 서버가
        // 읽을 수 있게 허용한다. 빌드에는 필요 없다. forge 의 화면 파일을 읽던 몫은 M8 에 걷었다.
        allow: [resolve(here, '..')]
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(here, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react(), csp()]
  }
})
