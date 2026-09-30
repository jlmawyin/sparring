<#
.SYNOPSIS
Verifica que una grabacion sirva para el video: duracion, fps reales y actividad de audio.

.DESCRIPTION
Responde una sola pregunta de forma objetiva: ¿entraron de verdad las dos voces?
Mide nivel medio y de pico por pista y dibuja un mapa de actividad por segundo, para
distinguir "hay dos fuentes" de "solo se grabo una". Sirve tanto para un MP4 de Game Bar
con pista mezclada como para los archivos separados de record-demo.ps1.

Una sola franja activa en la prueba de microfono + audio de sistema significa que falta
una fuente: hay que corregirlo ANTES de la toma buena, no despues.

.EXAMPLE
  .\scripts\check-recording.ps1 -Path "$env:USERPROFILE\Videos\Captures\mi-captura.mp4"
  .\scripts\check-recording.ps1 -Label prueba-audio
#>
[CmdletBinding()]
param(
  [string[]]$Path,
  [string]$Label,
  # Umbral de silencio: por debajo de esto se considera que no hay voz.
  [int]$SilenceDb = -45
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$bin  = Join-Path $root '.cache\bin\ffmpeg-9.0.2-essentials_build\bin'
$ff   = Join-Path $bin 'ffmpeg.exe'
$fp   = Join-Path $bin 'ffprobe.exe'

if (-not (Test-Path $ff)) { throw "No se encuentra ffmpeg en $bin." }

if (-not $Path) {
  if (-not $Label) { throw 'Indicar -Path <archivos> o -Label <etiqueta de record-demo.ps1>.' }
  $dir = Join-Path $root '.cache\video'
  $Path = Get-ChildItem $dir -File -ErrorAction SilentlyContinue |
          Where-Object { $_.Name -like "*$Label*" -and $_.Extension -in '.mkv', '.wav', '.mp4' } |
          Sort-Object Name | Select-Object -ExpandProperty FullName
  if (-not $Path) { throw "No hay archivos con etiqueta '$Label' en $dir." }
}

foreach ($f in $Path) {
  if (-not (Test-Path $f)) { Write-Warning "No existe: $f"; continue }
  Write-Host ''
  Write-Host ('=' * 72)
  Write-Host (Split-Path $f -Leaf)
  Write-Host ('=' * 72)

  $dur = [double](& $fp -v error -show_entries 'format=duration' -of csv=p=0 $f)
  Write-Host ("duracion        : {0:N2} s" -f $dur)

  # --- Video, si lo hay ---
  $vinfo = & $fp -v error -select_streams v:0 -show_entries 'stream=width,height,codec_name' -of csv=p=0 $f
  if ($vinfo) {
    $frames = & $fp -v error -count_frames -select_streams v:0 -show_entries 'stream=nb_read_frames' -of csv=p=0 $f
    $fps = if ($dur -gt 0) { [math]::Round([int]$frames / $dur, 1) } else { 0 }
    Write-Host ("video           : $vinfo | $frames fotogramas | $fps fps efectivos")
    if ($fps -lt 20) { Write-Host '  AVISO: por debajo de 20 fps el movimiento se vera a saltos.' -ForegroundColor Yellow }
  }

  # --- Pistas de audio ---
  $aStreams = @(& $fp -v error -select_streams a -show_entries 'stream=index' -of csv=p=0 $f)
  if (-not $aStreams) { Write-Host 'audio           : NINGUNA PISTA' -ForegroundColor Red; continue }
  Write-Host ("pistas de audio : {0}" -f $aStreams.Count)

  for ($i = 0; $i -lt $aStreams.Count; $i++) {
    Write-Host ''
    Write-Host ("  --- pista a:$i ---")
    $log = (& $ff -hide_banner -nostats -i $f -map "0:a:$i" `
              -af "volumedetect,silencedetect=noise=${SilenceDb}dB:d=0.4" -f null NUL 2>&1) -join "`n"

    $mean = ($log -split "`n" | Where-Object { $_ -match 'mean_volume:\s*(\S+)' } | Select-Object -First 1)
    $max  = ($log -split "`n" | Where-Object { $_ -match 'max_volume:\s*(\S+)' }  | Select-Object -First 1)
    if ($mean -match 'mean_volume:\s*(\S+)') { $meanDb = [double]$Matches[1] } else { $meanDb = $null }
    if ($max  -match 'max_volume:\s*(\S+)')  { $maxDb  = [double]$Matches[1] } else { $maxDb  = $null }
    Write-Host ("  nivel medio   : {0} dB" -f $meanDb)
    Write-Host ("  nivel de pico : {0} dB" -f $maxDb)

    # Intervalos de silencio -> franjas activas por complemento.
    $sil = @()
    foreach ($line in ($log -split "`n")) {
      if ($line -match 'silence_start:\s*([0-9.]+)') { $sil += @{ t = [double]$Matches[1]; kind = 'start' } }
      elseif ($line -match 'silence_end:\s*([0-9.]+)') { $sil += @{ t = [double]$Matches[1]; kind = 'end' } }
    }
    $active = @()
    $cursor = 0.0
    foreach ($ev in $sil) {
      if ($ev.kind -eq 'start') {
        if ($ev.t - $cursor -gt 0.3) { $active += @{ from = $cursor; to = $ev.t } }
      } else { $cursor = $ev.t }
    }
    if ($dur - $cursor -gt 0.3) { $active += @{ from = $cursor; to = $dur } }

    if (-not $active) {
      Write-Host '  SIN ACTIVIDAD: esta pista esta en silencio.' -ForegroundColor Red
    } else {
      Write-Host ("  franjas activas: {0}" -f $active.Count)
      foreach ($a in $active) {
        Write-Host ("    {0,6:N2} s -> {1,6:N2} s  ({2:N1} s)" -f $a.from, $a.to, ($a.to - $a.from))
      }
      $talk = ($active | ForEach-Object { $_.to - $_.from } | Measure-Object -Sum).Sum
      Write-Host ("  audio con voz  : {0:N1} s de {1:N1} s ({2:N0}%)" -f $talk, $dur, (100 * $talk / $dur))
    }

    if ($maxDb -ne $null) {
      if ($maxDb -gt -1.0) { Write-Host '  AVISO: pico muy alto, puede haber saturacion.' -ForegroundColor Yellow }
      elseif ($maxDb -lt -30.0) { Write-Host '  AVISO: pista muy baja; subir ganancia antes de la toma buena.' -ForegroundColor Yellow }
    }
  }
}

Write-Host ''
Write-Host 'Lectura: en la prueba de microfono + audio del sistema deben aparecer franjas activas'
Write-Host 'correspondientes a AMBAS fuentes. Una sola franja = falta una fuente; corregir y repetir.'
