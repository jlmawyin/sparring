# Adaptador local

`index.ts` escucha exclusivamente en `127.0.0.1:8787`. `createApp` devuelve un servidor HTTP con entorno, reloj y fetch inyectables para pruebas. Nunca lee `.env`; el lanzador puede cargar variables antes del arranque. `NODE_ENV=production` rechaza el arranque.

Los contextos opacos de 256 bits, la transcripción aceptada, las respuestas idempotentes y la cuota viven en memoria. Se eliminan por vencimiento al atender solicitudes. Reiniciar pierde este estado: no desplegar este adaptador, no usar varios procesos ni presentarlo como contador distribuido o contexto firmado. Una sesión activa global; `SPARRING_MAX_SESSION_SECONDS` (60–240, defecto 240) y `SPARRING_DAILY_MINUTES_CAP` (1–30, defecto 30) se aplican a la reserva, el deadline y `max_session_duration_seconds` del token. Finalizar pronto o fallar el proveedor no devuelve la reserva. No hay reconexión.

La evaluación valida estructura y anclaje literal, y calcula pesos desde `spec/rubric.json`; no valida la corrección semántica del nivel propuesto ni autentica una transcripción enviada por el navegador. Toda llamada nueva aceptada incrementa la revisión; la primera espera revisión 0. Un rechazo no cambia score, revisión ni transcripción. `finish` congela el score sin liberar la sesión mientras se reproduce coaching; `end` libera la sesión y conserva la reserva.

Protocolo de configuración comprobado en [AssemblyAI events reference](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference): formato `audio/pcm`, PCM16 mono 24 kHz, voz `lola`, español y configuración inline. Las pruebas inyectan proveedor ficticio y no demuestran conversación real.

## Adaptador de producción (cPanel/Passenger o host Node equivalente)

`productionApp.ts` (`createProductionApp`) sirve el frontend construido (`dist/`) y `/api` desde el mismo origen y puerto — no hay CORS ni lista de orígenes porque no existe un origen cruzado legítimo. `production.ts` es el punto de entrada ejecutable: escucha en `process.env.PORT` (lo fija Passenger) o `SPARRING_PORT` (por defecto 8788), en el host `SPARRING_HOST` (por defecto `0.0.0.0`).

A diferencia del adaptador local, la cuota global (segundos reservados por día y el candado de sesión activa) vive en un archivo (`quota.ts`, `createQuotaLedger`) con escritura atómica (`write` a un temporal + `rename`) y un candado de exclusión mutua basado en archivo (`<quotaFile>.lock`, creado con `O_EXCL`) que serializa reservas concurrentes entre peticiones y entre procesos que compartan el mismo archivo. Un candado más viejo que `staleLockMs` (5 s por defecto) se considera abandonado por un proceso caído y se rompe automáticamente, para no bloquear la cuota para siempre. Un archivo de cuota ilegible o corrupto **falla cerrado**: la reserva se rechaza (`503 quota_unavailable`) en vez de reiniciar el contador a cero. La reserva sobrevive reinicios del proceso porque se lee del mismo archivo al arrancar; liberar una sesión (`end`) sólo libera el candado de sesión activa, nunca el presupuesto ya reservado — igual que el adaptador local. Las transcripciones y el estado de evaluación de una sesión siguen en memoria de ese proceso (no son necesarios para la conservadurismo de costo, sólo la cuota debe ser durable).

Variables de entorno (mismos nombres y límites que el adaptador local): `ASSEMBLYAI_API_KEY`, `SPARRING_VOICE_ENABLED=true`, `SPARRING_MAX_SESSION_SECONDS` (60–240, defecto 240), `SPARRING_DAILY_MINUTES_CAP` (1–30, defecto 30). Específicas de producción: `SPARRING_STATIC_DIR` (ruta a `dist/`; por defecto `../dist` junto al módulo compilado), `SPARRING_QUOTA_FILE` (ruta al archivo de cuota; por defecto `../var/quota.json` junto al módulo compilado — debe ser una ruta escribible y persistente entre reinicios, no un directorio temporal que el host pueda vaciar), `PORT`/`SPARRING_PORT`, `SPARRING_HOST`. Ningún valor de estas variables se define en el repositorio.

### Construir y arrancar

```
npm run build   # tsc --noEmit && vite build (dist/) && build:server (server-dist/production.mjs)
npm start       # node server-dist/production.mjs
```

`build:server` empaqueta `server/production.ts` con esbuild (`--bundle --platform=node --format=esm`) en un único archivo `server-dist/production.mjs` sin dependencias de terceros en tiempo de ejecución (el servidor sólo usa módulos `node:*` y los propios `spec/`, `prompts/` leídos por ruta relativa en tiempo de ejecución). `server-dist/` debe quedar como hermano de `dist/`, `spec/` y `prompts/` en la raíz del proyecto para que esas rutas relativas se resuelvan igual que en desarrollo.

### Publicar en cPanel (Node Selector / Passenger)

Generar el ZIP listo para subir con `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-node.ps1`. Queda en `.cache/release/sparring-node.zip` y contiene sólo el build, los contratos y el arranque; el script comprueba que no incluya `.env`, `.secrets` ni la cuota. Subirlo y extraerlo con **File Manager** a una carpeta de aplicación privada, fuera del document root. El usuario FTP de `sparring.visitaremota.com` sólo ve el document root y no debe usarse para poner allí el backend ni su clave.

1. Subir al *Application root* del host: `app.js`, `package.json`, `server-dist/`, `dist/`, `spec/`, `prompts/` (con la misma disposición relativa que en el repositorio; no hace falta subir `src/`, `server/*.ts`, `node_modules/` ni `tests/`).
2. En «Setup Node.js App»: *Application startup file* = `app.js` (que importa `server-dist/production.mjs`); *Application root* = la carpeta anterior; versión de Node ≥ 18. Incluir también `app.js` y `package.json` en el paquete.
3. Variables de entorno de la app (definidas en la interfaz de cPanel, nunca en el repositorio ni en `.env` subido): `ASSEMBLYAI_API_KEY`, `SPARRING_VOICE_ENABLED=true`, `SPARRING_MAX_SESSION_SECONDS`, `SPARRING_DAILY_MINUTES_CAP`, `SPARRING_QUOTA_FILE` (ruta absoluta escribible fuera de cualquier carpeta que el host purgue, p. ej. dentro de `$HOME`).
4. No es necesario `npm install` en el host: el bundle no tiene dependencias de terceros. Si el flujo de despliegue de cPanel lo ejecuta igual, no hay problema — no hay nada que instalar.
5. Passenger administra el proceso; `PORT` lo fija automáticamente. No fijar `SPARRING_PORT` salvo que el host lo requiera explícitamente.
6. Antes de habilitar voz, comprobar `https://sparring.visitaremota.com/`, `/api/catalog` y `/api/health` desde el navegador; `/api/health` debe informar `mode: "production"`. Al asignar el dominio a la app Node, cPanel puede dejar de servir directamente el `dist` subido por FTP; esta app sirve su propia copia del build.

### Límites conocidos

- Un único proceso Node sostiene las transcripciones y el estado de evaluación en memoria; reiniciar el proceso pierde esas sesiones en curso (el cliente recibe `session_expired`), pero la cuota global ya consumida no se pierde ni se puede burlar reiniciando.
- El candado de archivo sincroniza procesos que comparten el mismo sistema de archivos (un único host). No es un contador distribuido entre hosts.
- Ningún test de este lote ejecuta AssemblyAI real; el proveedor siempre está simulado.
