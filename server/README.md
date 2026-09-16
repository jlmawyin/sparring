# Adaptador local

`index.ts` escucha exclusivamente en `127.0.0.1:8787`. `createApp` devuelve un servidor HTTP con entorno, reloj y fetch inyectables para pruebas. Nunca lee `.env`; el lanzador puede cargar variables antes del arranque. `NODE_ENV=production` rechaza el arranque.

Los contextos opacos de 256 bits, la transcripción aceptada, las respuestas idempotentes y la cuota viven en memoria. Se eliminan por vencimiento al atender solicitudes. Reiniciar pierde este estado: no desplegar este adaptador, no usar varios procesos ni presentarlo como contador distribuido o contexto firmado. Una sesión activa global; `SPARRING_MAX_SESSION_SECONDS` (60–240, defecto 240) y `SPARRING_DAILY_MINUTES_CAP` (1–30, defecto 30) se aplican a la reserva, el deadline y `max_session_duration_seconds` del token. Finalizar pronto o fallar el proveedor no devuelve la reserva. No hay reconexión.

La evaluación valida estructura y anclaje literal, y calcula pesos desde `spec/rubric.json`; no valida la corrección semántica del nivel propuesto ni autentica una transcripción enviada por el navegador. Toda llamada nueva aceptada incrementa la revisión; la primera espera revisión 0. Un rechazo no cambia score, revisión ni transcripción. `finish` congela el score sin liberar la sesión mientras se reproduce coaching; `end` libera la sesión y conserva la reserva.

Protocolo de configuración comprobado en [AssemblyAI events reference](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference): formato `audio/pcm`, PCM16 mono 24 kHz, voz `lola`, español y configuración inline. Las pruebas inyectan proveedor ficticio y no demuestran conversación real.
