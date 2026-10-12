<#
.SYNOPSIS
  사내/개발 테스트용 자체 서명 코드서명 인증서를 생성한다.

.DESCRIPTION
  외부 배포용으로는 쓸 수 없다. 공인 CA 가 발급한 인증서가 아니므로
  이 인증서로 서명한 앱은 루트 인증서를 신뢰 목록에 설치한 PC 에서만
  "서명된 앱"으로 인식된다. 서명 파이프라인 자체를 검증하거나,
  IT 부서가 GPO 로 루트 인증서를 배포하는 사내 배포에만 사용한다.

.EXAMPLE
  .\scripts\make-dev-cert.ps1 -Password "비밀번호" -Subject "CN=내회사 이름"
#>
param(
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$Subject = "CN=Electron App Dev",
  [int]$Years = 3
)

$ErrorActionPreference = "Stop"
$outDir = Join-Path $PSScriptRoot "..\build"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -CertStoreLocation Cert:\CurrentUser\My `
  -KeyUsage DigitalSignature `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -NotAfter (Get-Date).AddYears($Years) `
  -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")

$pfxPath = Join-Path $outDir "dev-cert.pfx"
$cerPath = Join-Path $outDir "dev-cert.cer"
$securePw = ConvertTo-SecureString -String $Password -Force -AsPlainText

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePw | Out-Null
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null

Write-Output ""
Write-Output "인증서 생성 완료"
Write-Output "  thumbprint : $($cert.Thumbprint)"
Write-Output "  pfx        : $pfxPath   (서명에 사용. 절대 커밋하지 말 것)"
Write-Output "  cer        : $cerPath   (신뢰할 루트로 설치할 공개 인증서)"
Write-Output ""
Write-Output "1) 이 PC 에서 신뢰하게 만들기 (관리자 권한 PowerShell 필요):"
Write-Output "   Import-Certificate -FilePath `"$cerPath`" -CertStoreLocation Cert:\LocalMachine\Root"
Write-Output ""
Write-Output "2) 이 인증서로 서명해서 빌드하기:"
Write-Output "   `$env:CSC_LINK = `"$pfxPath`""
Write-Output "   `$env:CSC_KEY_PASSWORD = `"<비밀번호>`""
Write-Output "   yarn dist:win"
