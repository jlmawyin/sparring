<#
  Builds Sparring, checks the public bundle, and uploads only dist/ through
  validated explicit FTPS. Credentials come from the local DPAPI vault.
  The current backend is still local; this publishes the static shell only.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
. (Join-Path $PSScriptRoot 'secretos.ps1') -Cargar | Out-Null

if ([string]::IsNullOrEmpty($env:SPARRING_FTP_USER) -or [string]::IsNullOrEmpty($env:SPARRING_FTP_PASS)) {
  throw 'No se pudieron cargar SPARRING_FTP_USER y SPARRING_FTP_PASS desde DPAPI.'
}

$ftpHost = 'single-2030.banahosting.com'
$publicBase = 'https://sparring.visitaremota.com'
$credential = $env:SPARRING_FTP_USER + ':' + $env:SPARRING_FTP_PASS
$dist = Join-Path $root 'dist'

Write-Output 'BUILD=START'
npm run build | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'El build falló.' }

$distRoot = (Get-Item -LiteralPath $dist).FullName
$bundle = Get-ChildItem -LiteralPath $dist -Recurse -File
if (-not $bundle) { throw 'dist está vacío.' }
$textFiles = $bundle | Where-Object { $_.Extension -in @('.js', '.css', '.html', '.json', '.webmanifest') }
$joined = ($textFiles | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName }) -join "`n"
if ($joined -match 'ASSEMBLYAI_API_KEY|Bearer\s+[A-Za-z0-9._-]{12,}|127\.0\.0\.1|localhost:8787') {
  throw 'El bundle contiene una clave, un token o una dirección local.'
}
if ($bundle | Where-Object { $_.Extension -eq '.map' }) { throw 'El bundle contiene mapas de código.' }
Write-Output ('BUNDLE_CHECK=PASS files=' + $bundle.Count)

foreach ($file in $bundle) {
  $relative = $file.FullName.Substring($distRoot.Length).TrimStart('\', '/') -replace '\\', '/'
  if (-not $relative -or $relative -match '(^/|^[A-Za-z]:|(^|/)\.\.(/|$))') {
    throw ('Ruta remota inválida: ' + $relative)
  }
  $url = 'ftp://' + $ftpHost + '/' + $relative
  $null = & curl.exe --ssl-reqd --ftp-create-dirs --max-time 180 -sS `
    -T $file.FullName $url --user $credential 2>&1
  if ($LASTEXITCODE -ne 0) { throw ('FTPS upload failed for ' + $relative) }
}
Write-Output ('FTPS_UPLOAD=PASS files=' + $bundle.Count)

$response = Invoke-WebRequest -UseBasicParsing -Uri ($publicBase + '/?deploy=' + [guid]::NewGuid().ToString('N')) -TimeoutSec 30
if ($response.StatusCode -ne 200) { throw ('HTTPS returned ' + $response.StatusCode) }
Write-Output ('HTTPS_ROOT=PASS status=' + $response.StatusCode)

Remove-Variable credential -ErrorAction SilentlyContinue
Remove-Item Env:SPARRING_FTP_USER -ErrorAction SilentlyContinue
Remove-Item Env:SPARRING_FTP_PASS -ErrorAction SilentlyContinue
