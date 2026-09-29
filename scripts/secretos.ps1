<#
.SYNOPSIS
  Guarda y carga secretos locales usando DPAPI de Windows.

.DESCRIPTION
  Los valores se guardan cifrados en .secrets/, que está excluido de Git.
  El cifrado queda ligado al usuario de Windows y a esta máquina.
  Nunca imprime los valores ni los escribe en prompts, logs o archivos del repo.

.EXAMPLE
  .\scripts\secretos.ps1 -Guardar SPARRING_FTP_PASS

.EXAMPLE
  . .\scripts\secretos.ps1 -Cargar

.EXAMPLE
  .\scripts\secretos.ps1 -Listar
#>

[CmdletBinding(DefaultParameterSetName = 'Listar')]
param(
  [Parameter(ParameterSetName = 'Guardar', Mandatory)]
  [string]$Guardar,

  [Parameter(ParameterSetName = 'Cargar', Mandatory)]
  [switch]$Cargar,

  [Parameter(ParameterSetName = 'Listar', Mandatory)]
  [switch]$Listar,

  [Parameter(ParameterSetName = 'Borrar', Mandatory)]
  [string]$Borrar
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$vault = Join-Path $root '.secrets'

if (-not (Test-Path -LiteralPath $vault)) {
  New-Item -ItemType Directory -Path $vault | Out-Null
}

function Get-SafeName([string]$name) {
  if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw 'El nombre sólo puede contener letras, números y guión bajo.'
  }
  return $name
}

function Get-PathFor([string]$name) {
  return Join-Path $vault ((Get-SafeName $name) + '.dpapi')
}

switch ($PSCmdlet.ParameterSetName) {
  'Guardar' {
    $name = Get-SafeName $Guardar
    $secure = Read-Host "Valor de $name" -AsSecureString
    if ($secure.Length -eq 0) { throw 'Valor vacío: no se guardó nada.' }
    ConvertFrom-SecureString $secure | Set-Content -LiteralPath (Get-PathFor $name) -Encoding ASCII
    Write-Host "Guardado $name cifrado para $env:USERNAME en esta máquina."
  }
  'Cargar' {
    $loaded = @()
    Get-ChildItem -LiteralPath $vault -Filter '*.dpapi' -File -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        $secure = Get-Content -LiteralPath $_.FullName | ConvertTo-SecureString
        $plain = [System.Net.NetworkCredential]::new('', $secure).Password
        Set-Item -Path ('env:' + $_.BaseName) -Value $plain
        $loaded += $_.BaseName
      } catch {
        Write-Warning "No se pudo descifrar $($_.BaseName) con esta cuenta de Windows."
      }
    }
    if ($loaded.Count -eq 0) { Write-Host 'No hay secretos cargables.' }
    else { Write-Host ('Cargados en esta sesión: ' + ($loaded -join ', ')) }
  }
  'Listar' {
    $items = Get-ChildItem -LiteralPath $vault -Filter '*.dpapi' -File -ErrorAction SilentlyContinue
    if (-not $items) { Write-Host 'Bóveda vacía.' }
    else {
      Write-Host 'Secretos guardados (sólo nombres):'
      $items | ForEach-Object { Write-Host ('  ' + $_.BaseName) }
    }
  }
  'Borrar' {
    $path = Get-PathFor $Borrar
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force; Write-Host "Borrado $Borrar." }
    else { Write-Host "No existía $Borrar." }
  }
}
