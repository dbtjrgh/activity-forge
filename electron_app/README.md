# electron-app

Electron + TypeScript + Vite + React 데스크톱 앱.

## 기술 스택

- **Electron 44** — 데스크톱 셸
- **electron-vite 5** — main / preload / renderer 3개 번들을 한 번에 빌드, main HMR 지원
- **Vite 7 + React 19 + TypeScript 7**
- **electron-builder** — 설치 파일 패키징

## 프로젝트 구조

**파일마다 한 줄씩은 저장소 [CLAUDE.md](../CLAUDE.md) 의 구조도가 정본입니다** — 여기에 다시 적으면 두 벌이 되어 한쪽만 고쳐집니다
(2026-09-29 까지 여기는 `ipc.ts` 한 파일이던 때의 그림이었습니다). 여기는 폴더만 적습니다.
**작업대는 「대화로 만들기」 한 길입니다** — 이전 방식(「생성」 · 질문 카드 · 저장소에 반영 · 비교 캔버스 · 생성 대기열)은
2026-10-08 에 앱에서 걷었습니다(되살리기 fb5c0d4, 저장소 [CLAUDE.md](../CLAUDE.md) 「이전 방식 — 앱에서 걷었다」).

```
src/
  main/
    index.ts · window.ts · preview.ts · guidewin.ts · constants.ts   생명주기 · 메인 창 · 앱 안 창 · 받을 리소스 창 · 상한값
    ipc/                 화면 단위 채널 — 로직 없음, 렌더러 입력 검증은 여기서 한 번
    services/            도메인 로직 — Electron 을 import 하지 않는다
    services/forge/      양산 — forge 를 부르는 자리는 runtime.ts 하나
    lib/                 도메인을 모르는 범용 유틸
  preload/index.ts       contextBridge 로 렌더러에 API 노출
  shared/                메인 · 렌더러 공용 타입과 IPC 채널 상수 (shared/forge/ 는 화면 단위)
  renderer/
    index.html           렌더러 엔트리 HTML (하나뿐 — 옛 양산 창 forge.html 은 M8 에 걷음)
    src/App.tsx          옆줄 + 진행판 또는 작업대
    src/components/      board/ 진행판 · bench/ 작업대 · manage/ 관리 · guide/ 받을 리소스 창(`?guide=<코드>`)
    src/lib/             화면에 보이는 모양 · 형식
out/                     빌드 결과 (git 무시)
dist/                    패키징 결과 (git 무시)
```

## 개발

```bash
yarn install
yarn dev          # Vite dev server + Electron 실행 (렌더러 HMR)
```

`yarn dev` 실행 중에는 렌더러 콘솔 출력이 터미널로 전달됩니다.

### 양산을 돌릴 PC 에 미리 둘 것

- **`claude` (Claude Code CLI)** — 대화로 만들기가 `services/forge/aisession.ts` 에서 `claude -p` 로 부릅니다(이어 갈 때 `--resume`).
- **poppler (`pdftoppm`)** — 기획서 PDF 가 10쪽을 넘으면 `claude -p` 가 쪽을 나눠 여는데, 그때
  `pdftoppm` 이 있어야 합니다. 없으면 **에러 없이** AI 가 「기획서를 못 열었다」며 기획서 없이 답합니다
  (2026-09-28, `_document/함정.md`). 관리자 권한 없이 됩니다 —
  [poppler-windows 릴리스](https://github.com/oschwartz10612/poppler-windows/releases) zip 을
  `%LOCALAPPDATA%\poppler` 에 풀고 `…\Library\bin` 을 **사용자** PATH 에 넣습니다. 앱을 다시 켜야 먹습니다.
  **실행 파일로 받은 사람은 안 해도 됩니다** (2026-10-01) — `yarn dist:*` · `yarn package` 가 먼저
  `scripts/vendor-poppler.mjs` 로 이 PC 의 poppler 에서 두 프로그램과 그 DLL 만(34개 · 54MB) `vendor/poppler` 에 모으고,
  실행 파일이 그것을 `resources/poppler` 로 들고 가 PATH 맨 앞에 둡니다. 그래서 **빌드하는 PC 에는 위처럼 풀어 둔 poppler 가 있어야** 합니다.
  git · Claude Code 는 사람이 설치합니다 — 초기 설정 창이 없으면 「설치 페이지 열기」를 보입니다.

## 타입 체크 / 빌드

```bash
yarn typecheck    # main·preload(node) + renderer(web) 각각 검사
yarn build        # 타입 체크 후 out/ 에 번들 생성
yarn start        # 빌드 결과를 프로덕션 모드로 실행
```

## 패키징

```bash
yarn package      # 설치 파일 없이 dist/ 에 실행 가능한 앱만 생성
yarn dist:win     # Windows NSIS 설치 파일
yarn dist:mac     # macOS dmg
yarn dist:linux   # Linux AppImage
```

앱 아이콘 등 패키징 리소스는 `build/` 디렉터리에 두면 electron-builder 가 사용합니다
(`electron-builder.yml` 의 `directories.buildResources`).

## IPC 추가하는 방법

1. `src/shared/ipc.ts` 의 `IPC` 상수에 채널 이름 추가 (문자열을 직접 적지 않는다)
2. `src/main/services/` 에 실제 로직 작성 — Electron 을 import 하지 않고, 검증된 인자를 받는다
3. `src/main/ipc/` 의 그 화면 파일(`forge.ts` · `resource.ts` …)에서 채널과 서비스를 연결
4. `src/preload/index.ts` 의 `api` 객체에 메서드 추가 — `ipcRenderer.invoke(IPC.myChannel)`
5. 렌더러에서 `window.api.myMethod()` 호출 (타입은 preload 에서 자동 추론)

파일을 어디에 둘지, 어떤 관례를 따를지는 저장소 루트의 `CLAUDE.md` 에 정리되어 있습니다.

## 보안 설정

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration` 미사용
- CSP 는 `electron.vite.config.ts` 의 `csp()` 플러그인이 주입합니다.
  개발 모드에서는 Vite HMR 을 위해 `script-src 'unsafe-inline'` 을 허용하고,
  프로덕션 빌드에서는 `script-src 'self'` 로 제한합니다.
- 외부 링크는 기본 브라우저로 열리고(`setWindowOpenHandler`), 앱 내 새 창은 생성되지 않습니다.
- preload 는 sandbox 환경에서 `node_modules` 를 require 할 수 없으므로
  의존성을 번들에 포함합니다(`electron.vite.config.ts` 의 `externalizeDepsPlugin` exclude).

## 코드 서명 / 백신 차단 — 이 PC 에서는 실제로 막힙니다

**`yarn dist:win`(NSIS)은 이 PC 에서 안 됩니다.** 사내 보안 프로그램가 막습니다. 만들어진
exe 도 실행이 차단됩니다. 자세한 것과 IT 요청 방법은
[docs/code-signing.md](docs/code-signing.md), 함정의 전말은 [../CLAUDE.md](../CLAUDE.md).

```powershell
yarn dist:portable  # 배포 — 실행 파일 하나(dist\SparkOn Manager 1.0.0.exe), NSIS 를 안 거칩니다
.\start-app.bat     # 이 PC 에서 실행 — 소스로 띄웁니다(안 막힙니다). 9222 를 열고 감시 모드는 끕니다. 창을 보며 켤 때
```

바탕화면 바로가기는 `start-app.vbs` 를 부릅니다 — 같은 `start-app.ps1` 을 **cmd 창 없이** 돌리고 출력은 `start-app.log` 에 남깁니다.
패키지 설치가 실패하면 알림 창이 뜹니다. 켜는 단계는 `start-app.ps1` 한 곳에만 있습니다.

실행 파일은 서명하지 않았습니다 — **막히면 안내합니다**(2026-10-01 결정). 받는 사람에게
[docs/실행이-막히면.md](docs/실행이-막히면.md) 를 같이 줍니다(`dist:portable` 이 실행 파일 옆에 `실행이 막히면.txt` 로 놓습니다).

서명을 붙이게 되면 (`docs/code-signing.md` 1번 항목) 아래처럼 하고, 그때
`electron-builder.yml` 의 주석 처리된 `signExts`·`signtoolOptions` 를 되살립니다.

```powershell
$env:CSC_LINK = "C:\path\to\cert.pfx"
$env:CSC_KEY_PASSWORD = "비밀번호"
yarn dist:win
```

