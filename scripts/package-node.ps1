<#
  Builds an uploadable Node app for cPanel without including local secrets.
  The ZIP is written to ignored .cache/release/; upload it through cPanel's
  File Manager to an application root outside the public document root.
#>

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

npm run build | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'No se pudo construir el paquete Node.' }

$members = @('app.js', 'package.json', 'server-dist', 'dist', 'spec', 'prompts')
foreach ($member in $members) {
  if (-not (Test-Path -LiteralPath $member)) { throw ('Falta ' + $member) }
}

$outputDir = Join-Path $projectRoot '.cache/release'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$zip = Join-Path $outputDir 'sparring-node.zip'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourceFiles = foreach ($member in $members) {
  if (Test-Path -LiteralPath $member -PathType Container) {
    Get-ChildItem -LiteralPath $member -Recurse -File
  } else {
    Get-Item -LiteralPath $member
  }
}
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
$archive = [IO.Compression.ZipFile]::Open($zip, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $sourceFiles) {
    $entryName = $file.FullName.Substring($projectRoot.Length).TrimStart('\', '/') -replace '\\', '/'
    $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
    $inputStream = [IO.File]::OpenRead($file.FullName)
    $outputStream = $entry.Open()
    try { $inputStream.CopyTo($outputStream) }
    finally { $outputStream.Dispose(); $inputStream.Dispose() }
  }
} finally { $archive.Dispose() }

$archive = [IO.Compression.ZipFile]::OpenRead($zip)
try {
  $entryNames = @($archive.Entries | ForEach-Object { $_.FullName })
  if ($entryNames | Where-Object { $_ -match '\\' }) { throw 'El ZIP contiene separadores de Windows.' }
  foreach ($required in @('app.js', 'package.json', 'server-dist/production.mjs', 'dist/index.html')) {
    if ($entryNames -notcontains $required) { throw ('Falta en ZIP: ' + $required) }
  }
  if ($entryNames | Where-Object { $_ -match '(^|/)(\.env|\.secrets|quota\.json|node_modules)(/|$)' }) {
    throw 'El ZIP contiene un archivo o directorio privado.'
  }
  Write-Output ('PACKAGE=PASS entries=' + $entryNames.Count)
  Write-Output ('PACKAGE_PATH=' + $zip)
} finally {
  $archive.Dispose()
}
