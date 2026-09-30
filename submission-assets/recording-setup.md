# Flujo de grabación y edición — máquina de Jorge (Windows 11 Pro 26200)

Complementa `video-plan.md`: ese archivo define **qué** contar; este define **con qué** capturarlo y cómo editarlo. Regla que no se negocia: el video se arma sobre una llamada real. No se recrea, no se doblan citas, no se animan puntuaciones que no ocurrieron.

Todo lo de abajo está medido en esta máquina el 2026-09-29 ~23:40 ECT, no supuesto.

## Inventario verificado

| Herramienta | Estado comprobado | Papel |
|---|---|---|
| Xbox Game Bar | Instalado (`Microsoft.XboxGamingOverlay 7.326.8061.0`), `GameDVR_Enabled=1` | **Captura principal** |
| `scripts/record-demo.ps1` | Escrito y probado en esta máquina | **Captura de respaldo**, pistas separadas |
| ffmpeg 9.0.2 | En `.cache/bin/` (ignorado por Git), SHA-256 coincide con el publicado por gyan.dev | **Edición y verificación** |
| Streamlabs OBS | Instalado en `C:\Program Files\Streamlabs OBS` | Segundo respaldo, sin configurar |
| DaVinci Resolve | Instalado | Sólo si hace falta un rótulo animado |
| Monitor primario | 1920×1080 en (0,0); el secundario está en coordenadas negativas | Región de captura |
| `Virtual audio desktop` | Dispositivo DirectShow **activo**, 48 kHz estéreo | Voz del cliente simulado |
| `Micrófono (2- Trust GXT 232 Microphone)` | Dispositivo DirectShow presente | Voz de Jorge |

`ffmpeg` no se instaló al sistema ni se añadió al PATH: vive en `.cache/bin/` igual que `cloudflared.exe`. Los builds de gyan.dev no llevan firma Authenticode, así que la procedencia se comprobó por checksum contra el hash publicado (coincide).

## Por qué Game Bar es la captura principal

Se midió la ruta puramente por CLI y tiene un límite duro:

| Configuración medida | fps reales |
|---|---|
| `gdigrab` 1280×720, sólo vídeo | 28,8 |
| `gdigrab` 1280×720 **+ audio dshow en el mismo proceso** | **4,8** |
| igual, con `-thread_queue_size 1024` y buffer mayor | 5,8 |
| `gdigrab` 1920×1080, sólo vídeo | 5,3 |

Es decir: añadir la entrada de audio en el mismo proceso de ffmpeg hunde la captura a ~5 fps, y `-thread_queue_size` **no** lo corrige. Capturar 1080p también la hunde. Game Bar no tiene ese problema porque usa captura y encoder de hardware con sincronía A/V propia.

El preset del encoder no influye: `amf quality` 26,8 fps, `amf balanced` 27,0, `amf speed` 28,4, `libx264 veryfast` 27,6. Se descartó esa hipótesis con medición.

Contrapartida de Game Bar: micrófono y audio del sistema quedan **mezclados en una sola pista**. Los niveles hay que dejarlos bien *antes* de la toma buena, porque en edición ya no se separan.

## Antes de grabar (2 minutos)

1. Audífonos puestos. Sin ellos la voz del cliente entra por el micrófono y el audio queda con eco.
2. Cerrar Slack/WhatsApp/correo y activar No molestar (`Win+N`). Nada de paneles de hosting, `.env`, terminales con claves ni pestañas privadas en pantalla.
3. Una sola ventana de Edge en `https://sparring.visitaremota.com/`, sin barra de marcadores personales.
4. Usar **sólo datos ficticios** en la conversación.
5. Game Bar: `Win+G` → Configuración → Capturas. Confirmar que el audio a grabar incluya **sistema y micrófono**, con el micrófono a nivel medio.

## Captura principal — Game Bar

- `Win+Alt+R` inicia y detiene; `Win+Alt+M` conmuta el micrófono durante la captura.
- La grabación queda anclada a la ventana donde empezó: no cambiar de aplicación a mitad de toma.
- Salida: `%USERPROFILE%\Videos\Captures\*.mp4` (H.264 + AAC). Esa carpeta aún no existe; se crea en la primera grabación.

### Prueba de 20 s antes de la toma buena — obligatoria

Es la única forma de saber que entraron las dos fuentes.

1. `Win+Alt+R` con el micrófono activado.
2. Hablar 5 s ("prueba de micrófono, uno, dos, tres"), callar 3 s, y dejar que suenen 5 s de la voz del cliente en el navegador.
3. `Win+Alt+R` para detener.
4. Verificar con la herramienta ya probada:

```powershell
.\scripts\check-recording.ps1 -Path "$env:USERPROFILE\Videos\Captures\<archivo>.mp4"
```

Debe informar **dos franjas activas separadas**. Una sola franja significa que falta una fuente: corregir antes de la llamada, no después. El detector se validó contra un control sintético (tono 0–3 s, silencio 3–6 s, tono 6–9 s) y devolvió exactamente 0,00→3,02 s y 6,01→9,00 s; y contra una captura real en silencio, que reportó correctamente `SIN ACTIVIDAD` a −91 dB.

## Captura de respaldo — `scripts/record-demo.ps1`

Para el caso en que la pista mezclada de Game Bar quede inservible. Graba en **archivos separados**, así que los niveles se corrigen en edición sin repetir la llamada. Evita el cuello de botella usando procesos de ffmpeg distintos para vídeo y audio.

```powershell
.\scripts\record-demo.ps1 -ListDevices          # confirmar dispositivos
.\scripts\record-demo.ps1 -PlaceWindow          # coloca Edge en 0,0 a 1280x720
.\scripts\record-demo.ps1 -Seconds 20 -Label prueba-audio
.\scripts\record-demo.ps1 -Seconds 300 -Label toma-buena
```

Medido en la autoprueba: vídeo 1280×720 a **27,4–28,2 fps efectivos**, duración exacta, deriva audio/vídeo de **3 ms en 20 s** (≈45 ms en 5 min) y desfase de arranque de **53–70 ms**, que el script registra en un `.json` junto a la grabación para aplicarlo con `-itsoffset`. Escribe MKV y WAV, no MP4: si la toma se corta con Ctrl+C los archivos siguen siendo utilizables.

Límite heredado: la región es 1280×720 porque a 1080p `gdigrab` cae a 5 fps. Sólo se graba esa esquina de la pantalla, así que hay que comprobar que no asome nada privado alrededor.

## Toma buena

- **Una toma continua** de la práctica completa, sin pausar. Ahí queda la evidencia de las tool calls y de la cobertura subiendo en vivo.
- Duración de la llamada: 2–3 min (el tope de sesión del servidor es 240 s).
- Lo que la toma debe contener, con las etiquetas reales de la UI:
  - Panel **Escenarios de práctica** y selección de *Entrega demorada*.
  - Casilla de consentimiento de procesamiento por AssemblyAI e inicio.
  - **Sala de práctica** con la transcripción de ambos lados corriendo.
  - **Cobertura de la rúbrica** subiendo y el rótulo **Resultado provisional** durante la llamada — ésta es la prueba visual de la puntuación en llamada, y es el plano que faltaba en el G1 anterior.
  - **Terminar y ver feedback** → resultado con citas y coaching hablado.
  - **Cortar audio** y el indicador de micrófono del navegador apagándose.
- Si algo falla a mitad de la toma, no se disimula: se repite la toma o se rotula el corte.

## Edición (Claude, por CLI, determinista)

Con el material en mano, y sólo entonces:

1. **Inventario y niveles**: `check-recording.ps1` sobre la toma, para duración, fps reales y actividad por pista.
2. **Recortes** por fragmento con `-ss/-to`, según los tiempos de `video-plan.md`, sobre el material que realmente exista.
3. **Rótulos y pantalla final** a partir de `cover.png` y los enlaces de `form-copy.md`; los cortes entre fragmentos se rotulan visiblemente.
4. **Subtítulos en inglés** de las frases en español, transcritos de lo que de verdad se oye, no del guion.
5. **Audio**: `loudnorm` suave para igualar cliente y usuario, sin recortar palabras.
6. **Exportación**: MP4 H.264 + AAC, ≈90 s (límite del evento: 5 min), verificada con `ffprobe` y revisión de fotogramas.

Ninguna etapa puede empezar sin material real: si no hay grabación de una llamada, no hay video.

## Si el G1 público falla

Se corrige la app primero y se repite la llamada. No se graba un video de una función que no funcionó, ni se muestra una puntuación obtenida en mocks. Si queda una limitación conocida, se dice en el video y se anota en README y en la entrega.
