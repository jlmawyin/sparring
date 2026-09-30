# Evidencia de video — 30 septiembre 2026

Jorge grabó con Action de Mirillis la demo pública y confirmó que la prueba funcionó. Original local `docs/sparring.mp4`, conservado intacto y excluido de Git.

| Comprobación | Original | Entrega |
|---|---|---|
| Duración | 213,466667 s | 221,533333 s |
| Peso | 15.767.070 bytes | 8.379.482 bytes |
| Imagen | 1920×1080, 15 fps, HEVC | 1920×1080, 15 fps, H.264 |
| Audio | AAC estéreo, 44,1 kHz | AAC estéreo, 48 kHz |
| Idioma | Español | Español, subtítulos EN incrustados |

La edición conserva todos los turnos y su ritmo. Sólo recorta las barras del navegador, coloca la imagen sobre una franja para subtítulos, normaliza el nivel del audio y añade ocho segundos de cierre editorial con URLs y una traducción del feedback visible. No se recrearon respuestas, notas ni evidencias.

## Verificación

- ffprobe confirma formato, duración, tamaño y presencia de audio. Decodificación de audio completada; nivel medio del final −20,1 dB y pico −1,4 dB según volumedetect. Esto no sustituye una revisión auditiva humana completa.
- AssemblyAI universal-3-pro transcribió el audio español e identificó dos voces y 447 palabras. Claude generó 53 cues EN/ES; revisión de integración corrigió traducciones y verificó orden, ausencia de solapamientos, máximo dos líneas y último cue a 211,558 s.
- Correcciones de ASR limitadas a errores evidentes contrastados con el texto visible; no se mejoraron las promesas ni el desempeño del alumno. Los subtítulos no son una auditoría humana de cada palabra.
- Revisión visual del original y fotogramas del final: diálogo legible, traducción separada de la interfaz, nota real **75 con 100% de cobertura**, cierre sin recortes.
- La grabación muestra feedback sobre manejo de objeciones y mejora en calidez del cierre. No muestra de forma continua el panel inferior de cobertura y no acredita invocaciones de tools del modelo.
- Cumple la guía de lablab: menos de 300 MB y máximo cinco minutos. Fuente: https://lablab.ai/ai-articles/hackathon-guidelines

Archivos de entrega: `submission-assets/sparring-final-en.mp4` (local, excluido de Git), [subtítulos EN](../submission-assets/sparring-en.srt) y [subtítulos ES](../submission-assets/sparring-es.srt). No hay un nuevo despliegue de la app asociado a esta edición.

SHA-256 original: `b62628ff3b07b54bbb55ca895b7d5d84924bd4494fe796a860bd20c630830527`.

SHA-256 final: `5790ddfa9660f5a92c8d99ba8a683aa65ad18c6c82daf8054305c5b75a4499da`.
