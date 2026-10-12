# 코드 서명 & 백신 차단 대응

## 2026-09-11 — 실제로 막혔습니다. 이건 예상이 아닙니다

| 무엇 | 무슨 일이 났나 |
|---|---|
| **exe 실행** | 「An Application Control policy has blocked this file」. 사내 보안 프로그램가 서명 없는 exe 를 막습니다. **빌드할 때마다 해시가 바뀌므로 해시 예외는 한 번 쓰고 버려집니다** |
| **`yarn dist:win`(NSIS)** | `spawn UNKNOWN`. electron-builder 가 uninstaller 를 뽑으려고 **방금 만든 `setup.exe` 를 직접 실행**합니다(`NsisTarget.computeScriptAndSignUninstaller` → `WineVmManager.exec`; Windows 에서는 wine 이 아니라 대상을 그대로 spawn). 그 실행이 차단됩니다 |

**서명 설정을 지워도, `CSC_IDENTITY_AUTO_DISCOVERY=false` 로도 안 고쳐집니다.**
서명 문제가 아니라 **exe 실행 차단**입니다 (`makensis.exe` 자체는 잘 돕니다 — 확인했습니다).

**실패가 맨 마지막 단계에 나서 성공처럼 보입니다.** `dist/` 에 `setup.exe` 가 남지만
**222KB 껍데기**입니다 — 112MB `.nsis.7z` 가 안에 안 들어갔습니다. **크기로 확인하세요.**

### 지금 쓰는 우회

| | |
|---|---|
| 실행 | `electron_app/start-app.bat` (`yarn start`). node_modules 의 electron 은 안 막힙니다 |
| 배포 | `yarn dist:zip`. NSIS 를 안 거치므로 차단될 자리가 없습니다 |

### IT 에 요청할 때 — 해시가 아니라 **인증서 또는 경로**로 받으세요

빌드마다 해시가 바뀌므로 해시 예외는 다음 빌드에서 또 막힙니다. 둘 중 하나입니다.

1. **경로 예외** — `<저장소>\electron_app\dist\win-unpacked\` 와 설치 폴더
2. **코드 서명** (아래 1번 항목). 서명하면 **NSIS 도 함께 풀립니다** —
   자동 업데이트를 nsis blockmap 델타로 할 계획이라면 이쪽이 맞습니다

아래는 그때 쓸 배경 설명입니다.

---

## 왜 차단되는가

현재 빌드는 **서명이 전혀 없다**(`Get-AuthenticodeSignature` → `NotSigned`).
여기에 Electron 앱의 특징이 겹치면 행위 기반 백신/EDR 에게는 악성코드와 거의 같은 신호로 보인다.

| 신호 | 현재 상태 |
|---|---|
| 디지털 서명 | 없음 — 가장 큰 원인 |
| 파일 평판(prevalence) | 0. 세상에 방금 처음 등장한 107MB 실행 파일 |
| 설치 동작 | `%LOCALAPPDATA%` 에 압축 해제, 바로가기/레지스트리 생성, `elevate.exe` 포함 |
| 구조 | asar 로 리소스를 하나의 블롭에 묶음 → 패커(packer)와 유사하게 보임 |

서명은 이 중 첫 두 개를 해결한다. 나머지는 **배포처에 예외 등록**으로 푸는 것이 정석이다.
백신을 우회하는 방법(패킹, 난독화, 탐지 회피)은 쓰지 말아야 한다.
그런 조치는 오히려 탐지 점수를 올리고, 사용자 PC 의 보호를 무력화하며, 재배포 시 다시 막힌다.

---

## 1. 정식 코드서명 인증서 (외부 배포의 정답)

2023년 6월부터 CA/Browser Forum 규정에 따라 코드서명 인증서의 **개인키는 하드웨어
(USB 토큰 / HSM / 클라우드 KMS)에 보관해야** 한다. 따라서 `.pfx` 파일을 그냥 받는 방식은
신규 발급에서 사라졌고, 아래 중 하나를 골라야 한다.

| 방식 | 비용(대략) | 특징 |
|---|---|---|
| **Azure Trusted Signing** | 월 $10 내외 | 가장 저렴. electron-builder 가 `azureSignOptions` 로 기본 지원. 사업자 등록 3년 이상 등 자격 요건이 있다 |
| OV 인증서 + USB 토큰 | 연 20~40만원 | 물리 토큰이 있는 PC 에서만 빌드 가능 → CI 에서 쓰기 불편 |
| OV/EV + 클라우드 서명 (DigiCert KeyLocker, SSL.com eSigner, Sectigo) | 연 40~100만원+ | CI/CD 에서 쓰기 좋음 |
| 국내 CA (한국전자인증, 코스콤 등) | 견적 | 국내 기업 인증 절차가 익숙한 장점 |

> EV 인증서가 SmartScreen 경고를 "즉시" 없애준다는 설명은 오래된 정보다.
> 지금은 EV 도 평판 축적이 필요하며, 다만 일반 OV 보다 빠르게 쌓인다.

### 설정 방법

**(a) pfx 파일이 있는 경우** — 기존 인증서나 자체 서명 인증서

```powershell
$env:CSC_LINK = "C:\path\to\cert.pfx"     # 파일 경로 또는 base64 문자열
$env:CSC_KEY_PASSWORD = "비밀번호"
yarn dist:win
```

`electron-builder.yml` 에 경로를 적지 말고 환경변수로 넘긴다. 커밋 사고를 막을 수 있다.

**(b) USB 토큰 / Windows 인증서 저장소** — `electron-builder.yml` 의
`win.signtoolOptions.certificateSubjectName` 주석을 풀고 인증서의 `issued to` 값을 정확히 적는다.

```yaml
win:
  signtoolOptions:
    certificateSubjectName: 'Your Company Co., Ltd.'
```

**(c) Azure Trusted Signing** — `electron-builder.yml` 의 `signtoolOptions` 를 지우고
`azureSignOptions` 블록의 주석을 푼 뒤, `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` /
`AZURE_CLIENT_SECRET` 환경변수를 설정한다.

### 서명 확인

```powershell
Get-AuthenticodeSignature .\dist\electron-app-1.0.0-setup.exe | Format-List Status, SignerCertificate, TimeStamperCertificate
```

`Status` 가 `Valid` 이고 타임스탬프가 찍혀 있어야 한다. 타임스탬프가 없으면 인증서 만료
후 서명이 무효가 된다(이 프로젝트는 `rfc3161TimeStampServer` 로 이미 설정돼 있다).

---

## 2. 사내 보안 프로그램(EDR) 예외 등록 — 지금 당장 필요한 조치

사내 보안 프로그램는 보안 업체의 안티랜섬웨어/EDR 제품으로, 행위 기반 차단이 핵심이다.
서명을 붙여도 **평판이 없는 신규 실행 파일**은 계속 차단될 수 있으므로 예외 등록이 필요하다.

- **회사에서 배포한 제품인 경우**: 관리 콘솔에서 예외를 넣는 것이 가장 빠르다.
  보안 담당자에게 아래 정보를 함께 전달한다.
  - 파일 경로와 SHA-256 해시 (아래 명령으로 추출)
  - 서명 주체(인증서 CN) — 서명을 붙인 뒤라면 해시 대신 **인증서 기준 예외**를 요청한다.
    빌드마다 해시가 바뀌므로 인증서 예외가 훨씬 관리하기 편하다.
  - 사내에서 개발·빌드한 앱이며 용도가 무엇인지
- **오탐으로 판단되는 경우**: 보안 프로그램 업체에 오탐 신고를 접수한다.
  벤더가 시그니처를 수정해주는 것이 정상적인 해결 경로다.
- **Microsoft Defender 도 함께 막는 경우**:
  <https://www.microsoft.com/en-us/wdsi/filesubmission> 에 오탐 제출.
- VirusTotal 에 올려 어느 엔진이 어떤 이름으로 잡는지 확인하면 신고할 때 근거가 된다.
  단, 업로드한 파일은 보안 업체들에 공유되므로 사내 전용 앱이라면 주의한다.

```powershell
# 신고/예외 등록에 필요한 해시 (빌드마다 바뀝니다 — 위 「인증서 또는 경로」를 먼저 보세요)
Get-FileHash ".\dist\win-unpacked\SparkOn Manager.exe" -Algorithm SHA256
```

---

## 3. 사내 배포용 자체 서명 인증서

외부 배포에는 쓸 수 없지만, **서명 파이프라인 검증**이나 IT 부서가 GPO 로 루트 인증서를
배포하는 사내 환경에서는 유효하다.

```powershell
.\scripts\make-dev-cert.ps1 -Password "비밀번호" -Subject "CN=내회사 이름"
# 출력된 안내대로 .cer 을 신뢰할 루트에 설치(관리자 권한)한 뒤
$env:CSC_LINK = "build\dev-cert.pfx"
$env:CSC_KEY_PASSWORD = "비밀번호"
yarn dist:win
```

자체 서명 인증서는 SmartScreen 경고를 없애지 못하고, 루트를 설치하지 않은 PC 에서는
오히려 "알 수 없는 발행자" 로 표시된다.

---

## 4. 그 외에 차단 확률을 낮추는 것들

- **아이콘과 제품 정보를 채운다.** 아이콘 없고 회사명도 없는 실행 파일은 평판 점수가 낮다.
  `build/icon.ico` (256×256 이상)를 넣고 `electron-builder.yml` 의 `appId` / `productName` 을
  실제 값으로 바꾼다. `copyright`, `win.legalTrademarks` 도 채우면 좋다.
- **DLL 까지 서명한다.** 이 프로젝트는 `win.signExts` 로 `.dll` / `.node` 를 포함해 두었다.
- **sha256 단독 서명.** sha1 은 폐기됐고 일부 제품이 의심 신호로 본다 (설정 완료).
- **테스트 단계에서는 설치 파일 대신 포터블/zip 을 쓴다.** 설치 과정(레지스트리, 자동 실행,
  권한 상승)이 없으면 차단 빈도가 줄어든다. `electron-builder.yml` 의 `win.target` 에
  `portable` 또는 `zip` 을 추가하면 된다.
- **기업 환경이라면 MSI 도 검토한다.** 배포 정책상 MSI 를 화이트리스트에 넣기 쉬운 곳이 많다.
- **다운로드 경로를 고정한다.** 매 빌드마다 새 해시가 생기면 평판이 쌓이지 않는다.
  릴리스 버전을 정해 같은 URL 로 배포하면 평판이 축적된다.
