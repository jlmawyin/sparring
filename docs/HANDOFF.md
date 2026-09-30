# Relevo de Sparring

## CODEX — 2026-09-30 ~00:05 ECT (lote en curso)

- Jorge hizo una segunda llamada humana en el sitio público: voz y coaching útiles, pero **sin nota numérica**; saludo parcial pegado y audio inicial muy rápido, luego normal. G1 sigue **parcial / puntuación no verificada**. `docs/LIVE-CHECK.md` ya registra el reporte sin inventar cobertura ni duración.
- Claude Sonnet investigó `transcript.agent.delta`: el proveedor documenta deltas como siguiente palabra/token sin garantía de espacio; reprodujo el texto pegado con deltas sin espacio y corrigió sólo el parcial UI en `src/voice/controller.ts`, dejando texto final intacto. Nuevo test de 4 casos. Reportó typecheck, 180/180 tests y build PASS. Fix **todavía local, sin commit/push/deploy**. No halló control oficial de velocidad TTS ni bug verificable en PlaybackQueue; no afirmar que el audio se corrigió.
- Codex preparó `submission-assets/demo-response-guide.md` con respuesta natural de tres turnos para cubrir empatía, indagación, objeción, autoridad y cierre. Al revisar el scoring local detectó que expresiones habladas como “cuatro horas hábiles” y “reembolso de los 25 dólares del envío” podían no satisfacer sus patrones; Claude Sonnet trabaja ahora en `server/gatewayScore.ts` + `tests/server/gatewayScore.test.ts` (sesión CLI 68412), sin tocar otros archivos. Revisar resultado, pruebas y contraejemplos antes del deploy.
- En Edge, lablab ya está autenticado. Se creó equipo individual cerrado **Sparring** (UTC−5) y se abrió el borrador de submission. Paso 1 guardado: título “Sparring — Practice Tough Customer Conversations”, descripciones, categorías Voice Assistant / Customer Support / Education. La tecnología seleccionada es `Assemblyai Guardrails API` porque no apareció la de Voice Agent a primera vista; **revisar y corregir si hay opción más fiel**. Paso 2 exige cover, video MP4/MOV y slides PDF. `cover.png` y `slides.pdf` existen; MP4 real pendiente. Edge bloqueó el file chooser por permiso de extensión: se pidió a Jorge habilitar `Allow access to file URLs` en `edge://extensions` > ChatGPT > Details, o subir manualmente. Borrador aún no enviado.
- Cupo Codex observado: ventana 5 h 100 % consumida, semanal 30 % usada, `ordinaryUsageAllowed=false`; créditos existentes ~280,18. Jorge autorizó expresamente usarlos para esta entrega y pidió a Claude como relevo operativo. No canjear resets ni comprar. Operar con lotes mínimos y preparar relevo a Grok 4.6 al detener Codex; cuota Grok DESCONOCIDA. La página del equipo mostró countdown ~9h59 a las 00:01 ECT (compatible con cierre 10:00 ECT), pero mantener objetivo conservador **09:00 ECT**.
- Próximo orden: revisar fix scoring de Claude, probar build/tests, commit/push; desplegar sólo `sparring-app` en Contabo preservando `.env` y otros servicios; pedir nueva práctica guiada pública y observar nota/cobertura; grabar y validar MP4; adjuntar cover/slides/video y revisar formulario completo; pedir a Jorge aprobación concreta antes de envío final. Si Edge sigue bloqueado, Jorge debe adjuntar los archivos manualmente.

## CODEX — 2026-09-30 ~00:14 ECT (actualización verificada)

- Los dos fixes se revisaron y publicaron en `origin/master` commit `54c7f9f`. Integración: 187/187 unitarias (Claude), `npm run build` PASS, `npm run validate:spec` PASS, 8/8 E2E simuladas PASS y `git diff --cached --check` limpio. Esto **no acredita G1 humano**.
- Paquete de despliegue de 37 entradas explícitas, sin `.env` ni `.secrets`; SHA-256 local/remoto `958fb3a68f17271f53495d35e54b9327b03a6384b1b693c55ed714804b79c65f`. Se extrajo sólo en `/root/sparring-app`, se construyó la imagen y se recreó únicamente `sparring-app` con `docker compose ... up -d --no-deps sparring`. `docker inspect` = `running healthy`, `/api/health` público = 200 con clave/voz habilitadas, HTML público = 200 con asset `index-vKJfHn4Q.js`. Otros servicios, DNS y proxy intactos. Jorge recibió solicitud de repetir G1 guiado; respuesta pendiente.
- Edge volvió a conectarse después de que se habilitara la carga local. Borrador lablab paso 1 guardado: se quitó la etiqueta inexacta `Assemblyai Guardrails API` (no se usa Guardrails) y se eligió `rest api`, la opción genérica disponible. La descripción nombra explícitamente AssemblyAI Voice Agent API. Paso 2: `submission-assets/slides.pdf` **subido y verificado como enlace de storage**, `submission-assets/cover.png` **subido y visible**. Video MP4 real sigue pendiente; el formulario no se envió. Borrador en `https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/sparring/submission`.
- Siguiente paso: respuesta G1 humano (cobertura/nota), luego captura Game Bar con audio sistema+micrófono (prueba 20s y toma), verificación/edición MP4, upload video, paso 3 repo/demo, revisión final por Jorge, envío. Mantener objetivo conservador 09:00 ECT.

## CODEX — 2026-09-30 ~00:19 ECT (tercera G1 observada)

- Edge mostró la llamada pública de Jorge en resultado: 01:39 en UI, saludo y **un** turno del usuario, cobertura 40 % (empatía 2/4, indagación 3/4), sin otros criterios; nota `— /100` por umbral 60 %. `docs/LIVE-CHECK.md` conserva el texto exacto y límites de esa observación. No inferir por qué terminó a 01:39. Se informó a Jorge que la segunda respuesta a la objeción debe ocurrir **antes** de pulsar terminar. G1 aún sin nota global.
- La transcripción sí mencionaba “impacto ... en la operación de su equipo”, pero el patrón de empatía sólo toleraba 40 caracteres hasta el sustantivo. Claude amplió a 90 y Codex limitó la búsqueda a una sola oración para no tomar un sustantivo de otra frase. Pruebas específicas nuevas y negativas. Integración local tras cambio: **191/191 unitarias, build y 8/8 E2E simuladas PASS**. Cambio todavía local al escribir este bloque; commit/push/deploy pendientes.

## CODEX — 2026-09-30 ~00:22 ECT (empatía publicada)

- Commit `fcd775e` publicado en `origin/master`; prueba de empatía con frase real y control de frontera. Se copió **sólo** `server-dist/production.mjs` a `/root/sparring-app/server-dist/production.mjs` tras comparar SHA-256 local/remoto `759059f9cbbebc94cceb92491748e27bc0e2033dbfa97d10c0c6ed35785ee9c3`. Docker construyó imagen y recreó únicamente `sparring-app`; `running healthy` y `/api/health` público 200 con voz habilitada. No se tocó `.env`, proxy, DNS ni otros servicios.
- Jorge recibió la explicación visible: primera intervención logró 40 % y la nota aparece con cobertura >=60 %; se le pidió responder al menos dos veces antes de terminar. Nueva prueba humana y video todavía pendientes. Los fixes de texto y scoring ya están publicados.

## CODEX — 2026-09-29 ~23:48 ECT

- Jorge autorizó usar los créditos existentes para cerrar la entrega y pidió que Claude lidere la ejecución, con Grok/Agy según su criterio. Claude terminó el lote de captura, dejó `a00400c` publicado y entregó evidencia de medición en el bloque siguiente. No hay un proceso Claude activo al cerrar este lote.
- Codex corrigió el texto del formulario para distinguir las herramientas que el Voice Agent puede invocar del evaluador determinista que sí puntúa cada turno finalizado en producción. Commit `3d5d303` publicado en `origin/master`; árbol limpio. El texto está en `submission-assets/form-copy.md`.
- G1 público humano sigue PENDIENTE: la pregunta ya se envió a Jorge. Esperar resultado de cobertura, nota provisional, feedback hablado y liberación de micrófono antes de declarar PASS, grabar la toma o cerrar el formulario. El intento local anterior fue `LIVE_FAILED_SCORING` antes de la corrección; 176 unitarias y 8 E2E son simuladas, no prueba pública.
- Si G1 pasa, prueba de audio de 20 s según `submission-assets/recording-setup.md`, luego toma continua real y edición del MP4. Si falla, Claude recibe diagnóstico y corrección acotada; repetir pruebas pertinentes y desplegar sólo Sparring. Al terminar, preparar el formulario completo para visto bueno concreto de Jorge antes de envío final.
- La página oficial de lablab muestra horas contradictorias: cabecera `Sep 30, 10:00 AM ET` y programa `Sep 30, 10:00 AM Ecuador Time`. Tratar **09:00 ECT** como límite operativo conservador y enviar con margen; no asumir que hay plazo hasta las 10:00 ECT.
- El formulario real aún no se inspeccionó: Edge mostró `Sign in` (sesión de lablab cerrada). La pestaña del evento quedó abierta para que Jorge inicie sesión por sí mismo. Se le pidió hacerlo después de la práctica pública; no introducir credenciales en chat.

## ORQUESTADOR CLAUDE (Opus 5) — 2026-09-29 ~23:45 ECT

- Jorge autorizó usar créditos y puso a Claude como relevo operativo mientras Codex espera su ventana (reset 2026-09-30 01:29:51 ECT). Grok/Agy quedan como agentes de Claude sólo si su capacidad aporta. No se canjean resets ni se compran créditos.
- Estado verificado al abrir, no heredado: `master` limpio, `HEAD == origin/master == 1132e25`. `https://sparring.visitaremota.com/` responde 200 y `/api/health` devuelve `{status:ok,key_configured:true,voice_enabled:true,mode:production}`. No se desplegó, no se tocó DNS ni otros contenedores de Contabo. No se releyó ni se imprimió `.env`. **No se reintentó el Gateway de AssemblyAI**: la cuenta no tiene acceso al modelo.
- **G1 público sigue PENDIENTE de la prueba humana de Jorge.** `docs/LIVE-CHECK.md` conserva `LIVE_FAILED_SCORING` del intento local anterior. Nada de este lote acredita G1: no se hizo ninguna llamada de voz real.
- Trabajo de este lote: quedó lista y medida la cadena de grabación del video, que era el único frente que podía avanzar sin Jorge.
  - `submission-assets/recording-setup.md` (nuevo) — flujo de captura y edición con las mediciones de esta máquina, no supuestos.
  - `scripts/record-demo.ps1` (nuevo) — captura de respaldo por CLI con micrófono y audio de sistema en archivos separados.
  - `scripts/check-recording.ps1` (nuevo) — verifica duración, fps reales y actividad de audio por pista.
- Hallazgo medido que determinó el diseño: con un solo proceso de ffmpeg, añadir la entrada de audio dshow hunde `gdigrab` de **28,8 a 4,8 fps**, y `-thread_queue_size 1024` no lo corrige (5,8 fps). Capturar 1920×1080 también cae a 5,3 fps. Se descartó por medición la hipótesis del preset del encoder: `amf quality` 26,8 / `amf balanced` 27,0 / `amf speed` 28,4 / `libx264 veryfast` 27,6 fps. Por eso la captura principal es **Xbox Game Bar** (encoder de hardware, sincronía A/V propia, 1080p) y la ruta CLI es respaldo con **dos procesos** separados.
- Autopruebas reales de la ruta de respaldo: vídeo 1280×720 a **27,4–28,2 fps efectivos**, duración exacta, deriva audio/vídeo de **3 ms en 20 s** y desfase de arranque de **53–70 ms**, que el script registra en un `.json` para aplicarlo con `-itsoffset`. Se grabó siempre con `-NoMic`: no se capturó la voz de nadie.
- El verificador se validó en los dos sentidos: contra un control sintético (tono 0–3 s, silencio 3–6 s, tono 6–9 s) devolvió exactamente `0,00→3,02 s` y `6,01→9,00 s`; contra una captura real en silencio reportó `SIN ACTIVIDAD` a −91 dB. Los archivos de prueba se borraron.
- Herramienta: ffmpeg 9.0.2 en `.cache/bin/` (ignorado por Git), **sin instalar al sistema ni tocar el PATH**, igual que el precedente de `cloudflared.exe`. Los builds de gyan.dev no llevan firma Authenticode, así que la procedencia se comprobó por SHA-256 contra el hash publicado: **coincide**. Dispositivos confirmados: `Virtual audio desktop` (loopback, 48 kHz) y `Micrófono (2- Trust GXT 232 Microphone)`.
- No se ejecutó la suite de la aplicación en este lote porque no se tocó código de la app: los tres archivos son documentación y scripts de grabación. La evidencia vigente sigue siendo la anterior (176/176 unitarias, build, `validate:spec`, 8/8 E2E), toda con AssemblyAI simulado.
- Siguiente paso, humano y no de agentes: Jorge hace el G1 público (consentimiento → iniciar → responder al reclamo) y reporta voz, **Cobertura de la rúbrica** subiendo, rótulo **Resultado provisional** en llamada, coaching y liberación del micrófono. Sólo entonces se registra en `docs/LIVE-CHECK.md` y se graba la toma buena. Si falla, se diagnostica con una prueba discriminante y se corrige acotadamente antes de grabar.
- El formulario lablab (`submission-assets/form-copy.md`) tiene `Video: PENDING`. **No se envía nada sin el visto bueno concreto de Jorge** sobre el resultado real.


## ORQUESTADOR GROK — 2026-09-29 ~23:20 ECT

- Grok CLI (modelo grok-4.6) asumió orquestación. Codex permanece detenido hasta el reset de ventana 2026-09-30 01:29:51 ECT. No canjear resets ni créditos extra.
- Cuota Grok: **DESCONOCIDA** (`source=unknown`); sin aviso de <10 %. Acción: continuar este lote acotado y detenerse al aviso.
- Git inspeccionado: `.env` ignorado y no tracked; `git diff --check` sin errores; sin claves, tokens ni `.secrets/` en el árbol a publicar. No se tocó Docker, Nginx, Cloudflare ni otros contenedores/vhosts.
- Este commit publica lo ya verificado en MOCK: puntuación local por turno finalizado, Gateway opcional, serialización score-turn/`tool.call`, artefactos Contabo (`.dockerignore`, `deploy/contabo/`) y docs de estado. Evidencia previa (Claude 176/176 unitarias y typecheck; Codex `build`, `validate:spec`, 8/8 E2E) **no acredita G1**.
- **G1 público sigue pendiente de Jorge.** No marcar PASS. Video MP4 y envío lablab pendientes; no presentar submission sin instrucción específica.
- GitHub `origin/master` = `6a445ae` (`Add local in-call scoring and Contabo deploy artifacts`). 22 archivos; `.env` no publicado. Working tree limpio tras el push.
- Siguiente paso humano, no de agentes: Jorge prueba G1 en `https://sparring.visitaremota.com/` (consentimiento → iniciar → responder al reclamo) y reporta cobertura, nota o error. No diagnosticar ni redeployar hasta ese reporte. No tocar otros servicios.

## RELEVO POR CUPO — 2026-09-29 ~23:15 ECT

- Codex consultó límites tras desplegar: **100 % usado de ventana 5 h, `ordinaryUsageAllowed=false`; 30 % usado semanal**. Reset de 5 h: 2026-09-30 01:29:51 ECT. Respetar la regla de Jorge: detener a Codex, no canjear resets ni usar créditos de reserva. No atribuir el uso sólo a esta tarea.
- `grok models` confirmó sesión `grok.com` iniciada y modelo `grok-4.6` disponible. Preparado `docs/task-grok-handoff.txt` para que Grok 4.6 asuma desde el estado actual; leer ese archivo y este checkpoint. Cuota Grok: **DESCONOCIDA**, sin aviso <10 % recibido; comprobar antes de un lote, suspender al aviso.
- La app pública está operativa por HTTPS y el usuario tiene pestaña Edge abierta. Codex pidió a Jorge G1 público: marcar consentimiento, iniciar práctica, responder al reclamo y reportar cobertura/nota o error. **Esa respuesta aún no llegó al cerrar este relevo.** No marcar G1 PASS hasta recibir y documentar observación real. El sitio no debe volver a publicarse por FTP.
- Pendiente inmediato de Grok: inspeccionar `git status`, eliminar sólo artefactos accidentales si aparecieran, `git diff --check`, verificar no secretos, commit y push de los cambios probados a `origin/master` (último remoto `f579797`). El despliegue ya corre con esos artefactos; mantener Git coherente. Después incorporar G1 humano en `docs/LIVE-CHECK.md` y actualizar claims. Video MP4 y submission aún pendientes; no presentar ni publicar submission sin instrucción específica de Jorge.

## CHECKPOINT ACTUAL — 2026-09-29 ~23:10 ECT

- **Fecha límite:** 30 sep 2026, 10:00 ECT. G1 local tuvo ~183 s de voz real convincente pero terminó con rúbrica 0 %: `LIVE_FAILED_SCORING`; ver `docs/LIVE-CHECK.md`. No confundir las pruebas simuladas con esta prueba.
- Claude CLI añadió puntuación forzada por turno finalizado con AssemblyAI LLM Gateway. Codex corrigió un fake AudioContext; luego `typecheck`, 155/155 unitarias, `build`, 8/8 E2E y `validate:spec` pasaron. **Bloqueo real descubierto:** dos modelos Gateway (`claude-sonnet-4-6`, `gemini-2.5-flash-lite`) responden HTTP 400: esta cuenta no tiene acceso al modelo. La API de voz sí funcionó. No añadir tarjeta, comprar créditos ni repetir G1 con ese modo.
- Agy CLI agotó dos intentos sin editar (permiso headless, luego timeout de 10 minutos). Claude CLI implementó el fallback local y una revisión posterior corrigió la autoridad específica de los tres escenarios, citas de 500 caracteres y niveles sobreinterpretados. Gateway sigue optativo; local es defecto. El orquestador corrigió además una carrera entre score-turn y `tool.call` en `src/voice/controller.ts` serializándolos en la misma cola. **Evidencia:** Claude 176/176 unitarias y typecheck; Codex `build` PASS, `validate:spec` PASS, 8/8 E2E tras la corrección. La primera E2E integral detectó la carrera y falló; la repetición completa ya pasó. Todas estas pruebas simulan AssemblyAI.
- **Despliegue decidido por Jorge y ya ejecutado:** Contabo Docker, no cPanel BanaHosting. SSH con llave pública a `198.7.114.73`. Nuevo contenedor exclusivo `sparring-app` en red `net-core-services`, sin puerto de host; `docker inspect` informó `running healthy`. Desde el proxy `web-proxy-core`, `/api/health` respondió `{status:ok,key_configured:true,voice_enabled:true,mode:production}`. Sólo se añadió `/root/nginx-core/conf.d/sparring.conf`; `nginx -t` PASS antes de recargar. Otros vhosts y contenedores intactos.
- Artefactos: `.dockerignore`, `deploy/contabo/{Dockerfile,compose.yaml,sparring.conf}`; paquete TAR validado con 36 entradas, sin secretos, copiado a `/root/sparring-app`. `.env` se transfirió aparte a ruta privada con modo `600`; volumen de cuota `/root/sparring-app/var` uid 1000. Compose usa `SPARRING_SCORING_MODE=local` y límites 240 s/30 min diarios. No imprimir ni subir la clave a Git.
- Jorge actualizó Cloudflare por su cuenta: registro A `sparring.visitaremota.com` → `198.7.114.73` con proxy. Codex lo confirmó visualmente sólo en lectura; el raíz sigue en BanaHosting según su coordinación. HTTPS público `GET /` dio 200 y `GET /api/health` confirmó voz habilitada; Edge mostró tres escenarios y consentimiento, sin aviso de indisponibilidad. La pestaña pública quedó abierta para Jorge. **G1 público humano está pendiente de su respuesta**; no declarar puntuación de voz real hasta comprobarla.
- GitHub `origin/master` público sigue en `f579797`; cambios posteriores aún locales. No hay MP4. Próximo orden: recoger G1 público y registrar evidencia → revisar/push de código y docs → grabar video real y finalizar submission. No declarar DONE ni publicar submission sin autorización específica.
- Cupo Codex al abrir este lote: 72 % usado 5 h, 26 % usado semanal; no usar resets/créditos comprados. Grok CLI informó no autenticado; no despachar.

## CHECKPOINT ACTUAL — 2026-09-29 ~21:08 ECT

- G1 ya tuvo una llamada humana real local de ~183 s. Voz y transcripción en español funcionaron; Jorge calificó el cliente como convincente, aunque la voz iba algo rápida. La rúbrica terminó en 0 % sin puntuación ni evidencias visibles. **G1 = LIVE_FAILED_SCORING**, no aprobado; observaciones exactas en `docs/LIVE-CHECK.md`. No está demostrado si AssemblyAI omitió `tool.call` o si el cliente rechazó sus argumentos.
- Corrección en curso mediante Claude CLI, propiedad acotada de servidor/evaluación/frontend/tests: evaluar cada turno finalizado del usuario mediante AssemblyAI LLM Gateway con `tool_choice` forzado, anclar citas en el servidor y actualizar la rúbrica durante la llamada. Contrato oficial suministrado; no hacer llamadas reales ni tocar secretos. Codex conserva revisión, docs, GitHub y despliegue. Al terminar: revisar diff, pruebas y repetir G1 con consentimiento de Jorge; mocks no acreditan voz real.
- La web pública sigue sirviendo sólo `dist/`; `https://sparring.visitaremota.com/api/health` devuelve 404. Jorge ya inició sesión en cPanel; falta instalar el paquete actualizado y configurar secretos sólo en el panel. No afirmar demo pública de voz antes de HTTP y llamada real.
- cPanel ya abierto por Jorge: lectura de `Setup Node.js App` mostró **cero aplicaciones existentes**, Node `20.20.2` disponible y `sparring.visitaremota.com` elegible como Application URL. Dominios muestra docroot propio `/home/wndkyaoy/public_html/sparring.visitaremota.com`. No se guardó ningún cambio. Se comunicaron al usuario campos previstos: Node 20.20.2, Production, Application root privado `sparring-node`, URL exacta sin sufijo, startup `app.js`. No pulsar CREATE antes de que el ZIP actualizado haya pasado pruebas y esté en la carpeta privada; la clave de AssemblyAI la introduce el usuario directamente en cPanel.
- Commit público vigente `f579797` en `origin/master`; los cambios de este lote aún no están comprometidos ni publicados. No hay video MP4. Cierre de hackathon: 2026-09-30 10:00 ECT.

## CHECKPOINT DE ENTREGA — 2026-09-29, tarde ECT

- Usuario confirmó rotación y actualización de `SPARRING_FTP_PASS` en la bóveda local. `scripts/deploy-ftps.ps1` se corrigió para permitir una comparación inocua de `location.hostname === '127.0.0.1'` en el frontend, pero seguir rechazando URLs de loopback, claves y tokens embebidos. Build y scanner PASS; FTPS subió **sólo los 22 archivos de `dist/`**; HTTPS raíz 200; el SHA-256 del JS remoto coincide con el local. Edge mostró los tres escenarios de vista previa y el aviso público de voz no disponible. `/api/health` público sigue 404 hasta instalar Node. No usar ni afirmar voz pública aún.
- Comprobación adicional 13:27 ECT: el ZIP de producción se extrajo en `.cache/release/smoke-20260929` y arrancó de forma aislada, sin `node_modules` ni secretos. `/`, `/api/health` y `/api/catalog` devolvieron HTTP 200; `mode=production`, tres escenarios. Otro arranque local con `.env` (sin imprimir la clave) informó `key_configured=true`, `voice_enabled=true`, `mode=production`; no se minteó ningún token ni se hizo una llamada real. El servidor de smoke se detuvo. El dominio público sigue en HTTP 200 para `/` y 404 para `/api/health`.
- Respaldo de red probado: `cloudflared.exe` 2026.9.3 descargado del enlace oficial, firma Authenticode Cloudflare válida, guardado en `.cache/bin/` ignorado. Un Quick Tunnel temporal sirvió por HTTPS el ZIP aislado (`/`, `/api/health`, `/api/catalog`: 200, tres escenarios) con voz deshabilitada y sin clave. Se detuvieron túnel y servidor; el URL aleatorio ya no es demo pública. Cloudflare lo documenta sólo para pruebas, sin garantía de disponibilidad: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/. No sustituye hosting estable.
- Objetivo de hoy: completar demo de voz, desplegar backend y dejar materiales listos antes del cierre oficial **30 sep 15:00 UTC / 10:00 ECT**. Fuente: página del evento lablab; la hora se confirmó en navegador y en el programa oficial.
- Claude CLI implementó un adaptador Node de producción que sirve `dist/` y `/api` juntos, con cuota global persistente y reserva atómica en archivo. Codex ejecutó **typecheck PASS, 143/143 unitarias, build PASS, 8/8 E2E con proveedor simulado, validate:spec PASS**; luego añadió un rechazo de archivo de cuota dentro de `dist/` y verificó 15/15 pruebas focalizadas y typecheck. Un smoke test real del ejecutable Node sirvió `/`, `/api/catalog` y `/api/health` (modo producción, voz deshabilitada) con HTTP 200.
- `scripts/package-node.ps1` genera `.cache/release/sparring-node.zip` con rutas ZIP de Linux y sin `.env`, `.secrets`, cuota ni `node_modules`; validación local `PACKAGE=PASS entries=31`. `app.js` es punto de entrada compatible con cPanel. **No se ha instalado aún en BanaHosting.** Requiere confirmar que cPanel ofrece Node, subir el ZIP a un application root privado, configurar las variables en el panel y probar HTTPS.
- La interfaz pública todavía es estática. Se corrigió el estado de caída de `/api` para mostrar escenarios como vista previa y un mensaje público claro; esa nueva versión está construida localmente, **aún no subida por FTP**.
- Agy produjo cover y slides editables; Codex corrigió URL/copy, exportó cover PNG 1920×1080 y PDF de seis páginas, y comprobó visualmente ambos y los enlaces del PDF. `submission-assets/form-copy.md` y `video-plan.md` preparan el formulario y la grabación. **El MP4 no existe todavía.**
- Grok verificó el cierre y formatos con fuentes oficiales y advirtió que cPanel debe tener Node habilitado. El usuario confirmó disponibilidad para la prueba G1. Servidores locales activos en 5173/8787; health informó clave configurada y voz habilitada, pero **G1 LIVE_NOT_RUN** hasta recibir observación humana. La pestaña local quedó abierta en Edge.
- Pendientes del usuario: confirmar la opción Node en cPanel; rotar la contraseña FTP expuesta por un diagnóstico detallado anterior y volver a guardarla en DPAPI. No usar FTP con la credencial antigua. La clave AssemblyAI nunca se imprime ni se pasa a agentes; su valor de producción debe introducirlo el usuario en la interfaz de hosting.
- Próximo orden: (1) G1 humano y registro, (2) hosting Node o alternativa si no existe, (3) probar voz pública sin secretos, (4) grabar MP4 auténtico, (5) revisar README/claims/artefactos, (6) enviar formulario y conservar comprobante. No declarar DONE por tests mock.

## ACTUALIZACIÓN DE DESPLIEGUE — 2026-09-29 (corrección de ruta)

- Se corrigió `scripts/deploy-ftps.ps1`: calcula la ruta relativa desde `dist` y publica sólo su contenido en la raíz FTP. La versión defectuosa había creado una carpeta remota `C:` con rutas locales.
- Se eliminó la carpeta remota `C:` y sus directorios vacíos sin tocar `.well-known`, `cgi-bin`, `assets` ni los archivos correctos de la raíz.
- Publicación verificada: build de 22 archivos, `BUNDLE_CHECK=PASS`, `FTPS_UPLOAD=PASS` y `https://sparring.visitaremota.com/` responde HTTP 200.
- Prueba FTPS controlada verificada: subida, lectura HTTPS y borrado de marcadores `.txt` y `.html`, todos `PASS`; no quedaron marcadores.
- El dominio correcto es `sparring.visitaremota.com`. La publicación actual es sólo el shell estático; el backend local (`/api`) todavía requiere un despliegue compatible separado antes de declarar la aplicación completa operativa.
- Pendiente local: guardar también el usuario FTP en la bóveda DPAPI con `scripts/secretos.ps1 -Guardar SPARRING_FTP_USER`; la contraseña ya está guardada y ningún secreto se subió a Git.

## ACTUALIZACIÓN DE DESPLIEGUE — 2026-09-29

- Repositorio público: `https://github.com/jlmawyin/sparring`, rama `master`, último commit `5a80b7d`.
- Se añadió manejo local de secretos con DPAPI en `scripts/secretos.ps1`; `.secrets/` está excluido de Git. No hay contraseñas en el repositorio.
- BanaHosting FTPS autenticó correctamente contra `single-2030.banahosting.com:21`; un marcador apareció en la raíz FTP y fue eliminado.
- `https://sparring.visitaremota.com` responde `404` para el marcador. La transferencia FTPS funciona, pero la raíz FTP todavía no está confirmada como docroot público del subdominio. No se publicó `dist/`.
- El dominio correcto es `sparring.visitaremota.com`; `sparring.visitremota.com` no existe.
- La contraseña histórica encontrada en `D:\Jorge\OneDrive\AI\DATA2026\docs\aicerebro-chrome.txt` no se reutiliza; rotar esa credencial antigua.

## CHECKPOINT VIGENTE — 2026-09-16 20:43 ECT

**Orquestador principal: Codex. Revisión del relevo completada.** No recontar el chat ni repetir planificación. La siguiente dependencia sigue siendo G1 con voz humana; no hay que volver a insertar la clave ni repetir la auditoría ya cerrada.

### Revisión posterior de Codex (estado actual)

- Se conservó el trabajo de Grok y se delegó a Claude CLI/Sonnet medium una revisión acotada. Corrigió dos defectos: recordar el último sobre reenviado tras doble timeout y evitar que una respuesta HTTP de una sesión anterior sobrescriba el contexto de recuperación de la nueva. El cleanup de pendientes también respeta la generación.
- Regresión de timeout en Vitest; regresión stop→restart con respuesta HTTP retenida en Playwright. Claude comprobó que esta última falla con el guard antiguo y pasa con el fix. El padre revisó el diff y ejecutó la suite integrada.
- **Verificación final: typecheck PASS, 119/119 unitarias (7 archivos), build PASS, 8/8 E2E (16.6s), validate:spec PASS.** Proveedor simulado en todas las pruebas. Bundle sin marcadores de clave/Bearer. Evidencia: `docs/evidence/codex-review-2026-09-16.json`.
- Se reparó un cierre de llave extra que hacía inválido el JSON del checkpoint Grok; se preservaron sus datos históricos. AGENTS y playbook1.2 refuerzan delegación por capacidades, contexto pequeño, revisión por lotes y reserva de cuota. La planificación antigua se separó al archivo enlazado al final.
- App local seguía respondiendo en5173/8787; health confirmó clave configurada y voz habilitada sin leer el secreto. Se solicitó disponibilidad del usuario para práctica90s; no hay resultado humano recibido ni sesión real iniciada por Codex. **G1 LIVE_NOT_RUN.** No abrir tokens automáticamente.
- Cuota al cerrar lote: **47%5h / 63%semanal**, ordinaryUsageAllowed=true (01:43UTC). Es cuenta compartida, no gasto atribuible sólo a esta tarea. Sin resets ni extra usage activados. Agentes externos: cuota DESCONOCIDA, sin aviso recibido≤10%.
- Claude terminó ambos encargos; sesión `eb71e77c-d4d3-4dfb-a1a9-d8ab92963bed`, salidas ignoradas `.agents-runtime/claude-resume-{review,browser-test}.json`. No agentes de esta revisión pendientes. No reactivar worker interno anterior.
- Memoria reindexada con nombre explícito Sparring, fast, generación `2026-09-17T01:43:22Z`,435nodos/1045aristas. Coverage aún informa metadata_changed para los3archivos fuente y excluye tests/docs por diseño: se usó lectura directa y diff; no afirmar cobertura exhaustiva por reindexar.
- Git base revisada4dee0e4. Consultar `git log -1 --oneline` para el nuevo commit de correcciones; sin remoto ni publicación. No tocar `.env`.

### Transmisión Grok → Codex (lote anterior, conservar sin repetir)

Grok asumió orquestación temporal según `docs/task-grok-handoff.txt` y el CHECKPOINT de 11:33 ECT. Completó los ítems 1–5 de ese checkpoint. Un ciclo de solución, sin reintentos ciegos.

**Verificado (comandos reales, exit 0):**
- `npm run typecheck`
- `npm test` **118/118** (7 archivos). Incluye el lote server que el padre no había recogido (`tests/server/app.test.ts`, 60 casos) y 7 casos nuevos de recuperación.
- `npm run build` — Vite 8.3.0, `dist/assets/index-BAoVxe85.js` ~251 kB. Grep de `dist/` sin `ASSEMBLYAI_API_KEY` ni `Bearer`.
- `npm run test:e2e` **7/7**, 15.3s. Proveedor **MOCK**. `full-stack.spec.ts` = HTTP Node real + AssemblyAI simulado (3/2/1/4/2 → 59, cobertura 100). **No es G1.**

**Código propio de este relevo (revisar diff, no reescribir):**
- `server/app.ts` — `SPARRING_MAX_SESSION_SECONDS` 60–240 (defecto 240) y `SPARRING_DAILY_MINUTES_CAP` 1–30 (defecto 30). Misma cifra en reserva, deadline, `max_seconds` y `max_session_duration_seconds`. Inválido → defecto; fuera de rango → clamp.
- `tests/server/app.test.ts` — fixture fusiona `env`; tests 90s, tope 1 min con sesiones de 60s, clamp/default.
- `src/voice/evaluateRecovery.ts` **nuevo** — timeout 3s, reintento idéntico (servidor ya idempotente), replay si `revision_conflict`, incompleto sin inventar éxito. El sobre `sent` es el que el servidor aceptó, no el envelope obsoleto.
- `src/voice/controller.ts` — `handleToolCall` usa `attemptEvaluate`; snapshot tardío puede actualizar revisión visible; tool.result de ese call sigue error si no se recuperó.
- `tests/voice/evaluateRecovery.test.ts` **nuevo** — 7 casos.
- README y `server/README.md` documentan las variables. No se tocó el starter en `.cache`.

**No hecho / no afirmar:**
- G1 LIVE_NOT_RUN. Ningún token AssemblyAI real. Ninguna práctica iniciada.
- PWA, historial, contador distribuido, calibración, video/slides/submission: pendientes según PLAN.
- `npm run validate:spec` no se reejecutó en este turno (PASS previo).

**Entorno al cerrar transmisión (20:09 ECT):**
- `npm run dev` seguía respondiendo: 5173 web, 8787 api. Health `{status:ok,key_configured:true,voice_enabled:true,mode:local}`. Loopback only.
- Clave: KEY_CONFIGURED=true, SPARRING_VOICE_ENABLED=true. Valor nunca leído ni impreso.
- Git `master` local, sin remoto: `43261a6` root (64 archivos autorizados) → HEAD `34fab80` (sobre accepted + SHA en HANDOFF). `.env` ignorado.

**Memoria:** Sparring fast, generación `2026-09-16T16:31:39Z`, 435 nodos / 1045 aristas, ready. Excluidos por diseño: `docs/`, `scripts/`, `tests/e2e/`, `tests/**/*.test.ts` (fast-pattern). Tests leídos en fuente. Tras más código, reindexar; no reutilizar conclusiones del índice 161 nodos.

### Próximo trabajo concreto (Codex)

1. Comprobar cupo propio antes del siguiente lote; no reutilizar porcentajes históricos. Orquestar con margen de parada10%, sin resets ni extra usage.
2. **G1 con persona** — `docs/LIVE-CHECK.md`. Si `npm run dev` cayó: relanzar, health, no mintear token hasta gesto+consentimiento. Una llamada ≤4 min. No declarar G1 por e2e mock.
3. La revisión padre del diff Grok ya está cerrada arriba. Si G1 pasa: anotar LIVE-CHECK y seguir PLAN (PWA/historial, cuota distribuida, submission), delegando implementación por archivos con pruebas. No desplegar adaptador Map local.

### Agentes

- Grok 4.6: lote cerrado. No asignarle de nuevo las mismas pruebas/cuotas/timeout.
- Claude: 3 lotes voz ya hechos; no reanudar sin cupo. Sesión previa `da4c0a80-7b63-4b73-af32-ef9c573f4a46`.
- Agy: ciclo 503 descartado; no reintento ciego.
- Codex worker `/root/local_backend`: interrumpido por cuota; no reactivar en frío. El padre ya recogió sus tests (118 PASS).
- Cuota Grok: DESCONOCIDO. Parar al aviso ≤10%. Máximo 3 interacciones Grok/Agy por evaluación nueva.

### Comando de relevo a Codex

Leer `docs/task-codex-resume.txt` (también abajo). Pegar en Codex desde esta carpeta. No usar el prompt histórico de planificación.

La planificación anterior está archivada en [HANDOFF-PLANNING-ARCHIVE.md](HANDOFF-PLANNING-ARCHIVE.md). No leerla al retomar salvo que haga falta una decisión histórica.
