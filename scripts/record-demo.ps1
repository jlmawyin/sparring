<#
.SYNOPSIS
Captura pantalla + microfono + audio del sistema para el video de entrega de Sparring.

.DESCRIPTION
Ruta de respaldo por CLI, medida en esta maquina (2026-09-29). Es el plan B: la captura
principal recomendada es Xbox Game Bar (Win+Alt+R), que tiene sincronia A/V por diseno y
encoder de hardware a 1080p. Este script existe para el caso en que la pista mezclada de
Game Bar quede inservible (microfono demasiado alto y voz del cliente enterrada), porque
aqui el microfono y el audio del sistema quedan en ARCHIVOS SEPARADOS y se pueden nivelar
en edicion sin repetir la llamada.

Por que dos procesos de ffmpeg y no uno:
  medido con un solo proceso, anadir la entrada de audio dshow hunde gdigrab de 28,8 fps
  a 4,8 fps, y -thread_queue_size no lo corrige. Separando video y audio en procesos
  distintos el video se mantiene en ~28 fps y la deriva medida fue de 3 ms en 20 s
  (~45 ms en 5 min), corregible en edicion.

Limitaciones conocidas, que hay que asumir antes de usarlo:
  - gdigrab cae a ~5 fps si se captura 1920x1080; por eso la region es 1280x720.
  - los dos procesos arrancan con ~300 ms de diferencia. El script mide y guarda ese
    desfase en el archivo .json junto a la grabacion, para aplicarlo con -itsoffset.
  - graba lo que este visible en la region: cerrar paneles, terminales y notificaciones.

.EXAMPLE
  .\scripts\record-demo.ps1 -ListDevices
  .\scripts\record-demo.ps1 -PlaceWindow
  .\scripts\record-demo.ps1 -Seconds 20 -Label prueba-audio
  .\scripts\record-demo.ps1 -Seconds 300 -Label toma-buena
#>
[CmdletBinding()]
param(
  [int]$Seconds = 300,
  [string]$Label = 'take',
  [switch]$PlaceWindow,
  [switch]$NoMic,
  [string]$MicDevice,
  [string]$LoopbackDevice = 'Virtual audio desktop',
  [switch]$ListDevices
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$bin  = Join-Path $root '.cache\bin\ffmpeg-9.0.2-essentials_build\bin'
$ff   = Join-Path $bin 'ffmpeg.exe'
$fp   = Join-Path $bin 'ffprobe.exe'
$outDir = Join-Path $root '.cache\video'

# Region de captura: esquina superior izquierda del monitor primario (1920x1080 en 0,0).
$CapW = 1280; $CapH = 720; $CapX = 0; $CapY = 0

if (-not (Test-Path $ff)) {
  throw "No se encuentra ffmpeg en $bin. Descargarlo a .cache/bin (ignorado por Git) antes de grabar."
}

# Los nombres DirectShow llevan acentos; se detectan en vez de escribirlos literales,
# para no depender de la codificacion de este archivo.
function Get-DshowAudioDevices {
  $raw = (& $ff -hide_banner -list_devices true -f dshow -i dummy 2>&1) -join "`n"
  $names = @()
  foreach ($line in ($raw -split "`n")) {
    if ($line -match '"([^"]+)"\s*\(audio\)') { $names += $Matches[1] }
  }
  return $names
}

if ($ListDevices) {
  Write-Host 'Dispositivos de audio DirectShow visibles:'
  Get-DshowAudioDevices | ForEach-Object { Write-Host "  - $_" }
  return
}

# --- Colocar la ventana de la demo exactamente sobre la region de captura ---
if ($PlaceWindow) {
  Add-Type -Namespace Win32 -Name Wnd -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
'@
  $edge = Get-Process msedge -ErrorAction SilentlyContinue |
          Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle }
  $target = $edge | Where-Object { $_.MainWindowTitle -match 'Sparring' } | Select-Object -First 1
  if (-not $target) { $target = $edge | Select-Object -First 1 }
  if (-not $target) { throw "No hay ventana de Edge visible. Abrir https://sparring.visitaremota.com/ y repetir." }

  [void][Win32.Wnd]::ShowWindow($target.MainWindowHandle, 9)   # SW_RESTORE, quita maximizado
  Start-Sleep -Milliseconds 300
  [void][Win32.Wnd]::SetWindowPos($target.MainWindowHandle, [IntPtr]::Zero, $CapX, $CapY, $CapW, $CapH, 0x0040)
  [void][Win32.Wnd]::SetForegroundWindow($target.MainWindowHandle)
  Write-Host "Ventana colocada: '$($target.MainWindowTitle)' en ${CapX},${CapY} ${CapW}x${CapH}"
  Write-Host 'La region de captura es exactamente esa. Verificar que no asome nada privado alrededor.'
  return
}

$available = Get-DshowAudioDevices
if ($available -notcontains $LoopbackDevice) {
  throw ("No existe el dispositivo de audio del sistema '$LoopbackDevice'. Sin el, el video no " +
         "captura la voz del cliente simulado. Disponibles: " + ($available -join ' | '))
}
if (-not $NoMic -and -not $MicDevice) {
  $MicDevice = $available | Where-Object { $_ -ne $LoopbackDevice } | Select-Object -First 1
  if (-not $MicDevice) { throw 'No se detecto un microfono distinto del loopback. Usar -ListDevices.' }
}

New-Item -ItemType Directory -Force $outDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$base  = Join-Path $outDir "$stamp-$Label"
$videoPath = "$base.video.mkv"
$sysPath   = "$base.sistema.wav"
$micPath   = "$base.microfono.wav"
$metaPath  = "$base.json"

# MKV y WAV, no MP4: si la toma se corta con Ctrl+C o falla algo, los archivos siguen
# siendo utilizables. El MP4 final se produce en edicion.

function Start-Ff([string[]]$ffArgs) {
  Start-Process -FilePath $ff -ArgumentList $ffArgs -PassThru -WindowStyle Hidden
}

$videoArgs = @(
  '-hide_banner','-y',
  '-f','gdigrab','-framerate','30',
  '-video_size',"${CapW}x${CapH}",'-offset_x',$CapX,'-offset_y',$CapY,'-i','desktop',
  '-t',$Seconds,
  '-c:v','h264_amf','-quality','balanced','-b:v','6M','-pix_fmt','yuv420p',
  "`"$videoPath`""
)
# Las comillas internas son necesarias: el nombre del dispositivo lleva espacios y
# Start-Process no las agrega por si mismo.
$sysArgs = @(
  '-hide_banner','-y',
  '-f','dshow','-audio_buffer_size','50','-i',"`"audio=$LoopbackDevice`"",
  '-t',$Seconds,'-c:a','pcm_s16le',"`"$sysPath`""
)
$micArgs = @(
  '-hide_banner','-y',
  '-f','dshow','-audio_buffer_size','50','-i',"`"audio=$MicDevice`"",
  '-t',$Seconds,'-c:a','pcm_s16le',"`"$micPath`""
)

Write-Host "Region $CapX,$CapY ${CapW}x${CapH} | hasta $Seconds s"
Write-Host "Audio del sistema: $LoopbackDevice"
if (-not $NoMic) { Write-Host "Microfono: $MicDevice" } else { Write-Host 'Microfono: DESACTIVADO (-NoMic)' }
Write-Host 'Iniciando. Detener antes con Ctrl+C; los archivos quedan utilizables.'

# Audio primero: es la fuente irremplazable. El video puede recortarse en cabeza.
$t0 = [Diagnostics.Stopwatch]::StartNew()
$pSys = Start-Ff $sysArgs
$tSys = $t0.Elapsed.TotalMilliseconds
$pMic = $null
if (-not $NoMic) { $pMic = Start-Ff $micArgs; $tMic = $t0.Elapsed.TotalMilliseconds } else { $tMic = $null }
$pVid = Start-Ff $videoArgs
$tVid = $t0.Elapsed.TotalMilliseconds

$procs = @($pSys, $pVid) + @($pMic | Where-Object { $_ })
foreach ($p in $procs) { $p.WaitForExit(($Seconds + 60) * 1000) | Out-Null }
$t0.Stop()

$meta = [ordered]@{
  grabado_utc          = (Get-Date).ToUniversalTime().ToString('o')
  etiqueta             = $Label
  segundos_solicitados = $Seconds
  region               = "${CapX},${CapY} ${CapW}x${CapH}"
  video                = Split-Path $videoPath -Leaf
  audio_sistema        = Split-Path $sysPath -Leaf
  audio_microfono      = if ($NoMic) { $null } else { Split-Path $micPath -Leaf }
  # Desfases de arranque: aplicar con -itsoffset al alinear en edicion.
  arranque_ms          = [ordered]@{
    sistema   = [math]::Round($tSys, 1)
    microfono = if ($tMic) { [math]::Round($tMic, 1) } else { $null }
    video     = [math]::Round($tVid, 1)
  }
  nota = 'El video arranca despues del audio; recortar la cabeza del audio por la diferencia video-sistema.'
}

Write-Host ''
Write-Host '--- Resultado medido ---'
$expected = @(
  @{ path = $videoPath; key = 'video' },
  @{ path = $sysPath;   key = 'sistema' }
)
if (-not $NoMic) { $expected += @{ path = $micPath; key = 'microfono' } }

foreach ($item in $expected) {
  $f = $item.path
  if (-not (Test-Path $f)) { Write-Warning "No se produjo $f"; continue }
  $dur = & $fp -v error -show_entries 'format=duration' -of csv=p=0 $f
  $mb  = [math]::Round((Get-Item $f).Length / 1MB, 1)
  Write-Host ("{0,-40} dur={1,-12} {2} MB" -f (Split-Path $f -Leaf), $dur, $mb)
  $meta["duracion_$($item.key)_s"] = [double]$dur
  if ($item.key -eq 'video') {
    $fr = & $fp -v error -count_frames -select_streams v:0 -show_entries 'stream=nb_read_frames' -of csv=p=0 $f
    $meta['video_frames'] = [int]$fr
    if ([double]$dur -gt 0) {
      $meta['video_fps_efectivos'] = [math]::Round([int]$fr / [double]$dur, 1)
      Write-Host ("  fps efectivos = {0}" -f $meta['video_fps_efectivos'])
    }
  }
}

# Desfase a corregir en edicion: el video arranco despues del audio.
$meta['desfase_video_menos_sistema_ms'] = [math]::Round($tVid - $tSys, 1)

$meta | ConvertTo-Json -Depth 5 | Set-Content -Path $metaPath -Encoding utf8
Write-Host ''
Write-Host "Metadatos de sincronia: $metaPath"
Write-Host 'Siguiente paso: pedir a Claude la verificacion de niveles de ambas pistas antes de la toma buena.'
