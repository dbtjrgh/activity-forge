# SparkOn Manager 를 소스로 켠다 — Claude 가 시험할 때 켜는 방식과 같다 (2026-10-01).
#  - ELECTRON_RUN_AS_NODE 를 비운다(남아 있으면 electron 이 그냥 node 로 돈다)
#  - %LOCALAPPDATA%\poppler 를 PATH 앞에(기획서 PDF)
#  - 9222 를 연다 — Claude 가 같은 창을 본다
#  - 감시 모드(-w)는 끈다 — 다시 뜨면 9222 가 닫힌다. 앱 안 「업데이트」로 코드를 받았으면 앱을 닫고 다시 켠다
# 바탕화면 바로가기는 start-app.vbs 로 이 파일을 **창 없이** 부른다. 그때 출력은 start-app.log 에 남고,
# 준비(yarn install)가 실패하면 알림 창을 띄운다. 창을 보며 켜려면 start-app.bat(-Console).
# 한글이 있으니 UTF-8 BOM 으로 저장한다(Windows PowerShell 5.1 — CLAUDE.md 「스크립트를 쓸 때」).
param([switch]$Console)

$ErrorActionPreference = 'Continue'
$here = $PSScriptRoot
$log = Join-Path $here 'start-app.log'

Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$poppler = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'poppler') -Directory -ErrorAction SilentlyContinue |
  Where-Object { Test-Path (Join-Path $_.FullName 'Library\bin\pdftoppm.exe') } | Select-Object -Last 1
if ($poppler) { $env:PATH = (Join-Path $poppler.FullName 'Library\bin') + ';' + $env:PATH }

function Fail([string]$what) {
  $msg = "$what`n자세한 내용은 $log 파일을 보세요. node 와 yarn 이 설치되어 있는지 확인하세요."
  if ($Console) { Write-Host $msg; return }
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($msg, 'SparkOn Manager', 'OK', 'Error') | Out-Null
}

function Run([string]$dir, [string[]]$cmd) {
  Push-Location $dir
  try {
    if ($Console) { & $cmd[0] $cmd[1..($cmd.Length - 1)] }
    # `*>>` 는 5.1 에서 UTF-16 으로 붙인다 — 머리 줄(UTF-8)과 섞여 못 읽는다. 줄마다 글로 바꿔 UTF-8 로 붙인다
    else { & $cmd[0] $cmd[1..($cmd.Length - 1)] 2>&1 | ForEach-Object { "$_" } | Out-File $log -Append -Encoding utf8 }
    return $LASTEXITCODE -eq 0
  } finally { Pop-Location }
}

# 이미 켜져 있으면 새로 켜지 않고 그 창을 앞으로 — 두 번째가 9222 · 로그 파일을 두고 부딪혀 오류 창이 떴다(2026-10-01)
$busy = Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($busy) {
  $owner = Get-Process -Id $busy.OwningProcess -ErrorAction SilentlyContinue
  if ($owner -and $owner.Name -eq 'electron') {
    (New-Object -ComObject WScript.Shell).AppActivate($owner.Id) | Out-Null
    exit 0
  }
  Fail '9222 포트를 다른 프로그램이 쓰고 있어 앱을 켜지 못했습니다.'
  exit 1
}

if (-not $Console) { "=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') 시작 ===" | Out-File $log -Encoding utf8 }

# 켤 때마다 두 폴더의 패키지를 맞춘다(바뀐 것이 없으면 몇 초)
if (-not (Run (Join-Path $here '..\forge') @('yarn.cmd', 'install', '--frozen-lockfile', '--silent'))) { Fail '양산기(forge) 패키지를 설치하지 못했습니다.'; exit 1 }
if (-not (Run $here @('yarn.cmd', 'install', '--frozen-lockfile', '--silent'))) { Fail '앱 패키지를 설치하지 못했습니다.'; exit 1 }

if (-not (Run $here @('npx.cmd', 'electron-vite', 'dev', '--remoteDebuggingPort=9222'))) { Fail '앱이 비정상으로 종료되었습니다.'; exit 1 }
