<#
  Uploads one temporary marker through validated explicit FTPS, checks it over
  HTTPS, and removes it. The password is loaded from the local DPAPI vault.
  This script does not publish the application build.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'secretos.ps1') -Cargar | Out-Null

if ([string]::IsNullOrEmpty($env:SPARRING_FTP_PASS)) {
  throw 'No se pudo cargar SPARRING_FTP_PASS desde DPAPI.'
}

$ftpUser = 'datai@sparring.visitaremota.com'
$ftpHost = 'single-2030.banahosting.com'
$publicBase = 'https://sparring.visitaremota.com'
$marker = 'sparring-ftp-probe-' + [guid]::NewGuid().ToString('N') + '.txt'
$temp = Join-Path ([IO.Path]::GetTempPath()) $marker
$credential = $ftpUser + ':' + $env:SPARRING_FTP_PASS
$uploaded = $false
$failure = $null

Set-Content -LiteralPath $temp -Value ('Sparring FTPS probe ' + (Get-Date).ToUniversalTime().ToString('o')) -Encoding utf8

try {
  $null = & curl.exe --ssl-reqd --ftp-create-dirs --max-time 45 -sS `
    -T $temp ('ftp://' + $ftpHost + '/' + $marker) --user $credential 2>&1
  if ($LASTEXITCODE -ne 0) { throw ('FTPS upload failed with exit ' + $LASTEXITCODE) }
  $uploaded = $true

  $listing = & curl.exe --ssl-reqd --max-time 45 -sS -l `
    ('ftp://' + $ftpHost + '/') --user $credential 2>$null
  if (-not ($listing -match [regex]::Escape($marker))) { throw 'El marcador no aparece en la raíz FTP.' }
  Write-Output 'FTPS_REMOTE_LIST=PASS'

  $probeUrl = $publicBase + '/' + $marker + '?probe=' + [guid]::NewGuid().ToString('N')
  try { $response = Invoke-WebRequest -UseBasicParsing -Uri $probeUrl -TimeoutSec 20 }
  catch {
    $status = $_.Exception.Response.StatusCode.value__
    throw ('HTTPS probe returned ' + $status)
  }
  if ($response.StatusCode -ne 200) { throw ('HTTPS probe returned ' + $response.StatusCode) }
  if ($response.Content -notmatch 'Sparring FTPS probe') { throw 'HTTPS content did not match the marker.' }

  Write-Output 'FTPS_UPLOAD=PASS'
  Write-Output 'HTTPS_SERVE=PASS'
  Write-Output ('MARKER=' + $marker)
} catch {
  $failure = $_.Exception.Message
}
finally {
  if ($uploaded) {
    $null = & curl.exe --ssl-reqd --max-time 45 -sS `
      -Q ('DELE ' + $marker) ('ftp://' + $ftpHost + '/') --user $credential 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Output 'MARKER_DELETE=PASS' }
    else { Write-Output 'MARKER_DELETE=FAIL' }
  }
  Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
  Remove-Variable credential -ErrorAction SilentlyContinue
  Remove-Item Env:SPARRING_FTP_PASS -ErrorAction SilentlyContinue
}

if ($failure) {
  Write-Output ('FTPS_PROBE=FAIL: ' + $failure)
  exit 1
}
