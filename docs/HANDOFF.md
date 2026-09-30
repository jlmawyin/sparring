# Relevo de Sparring

## ORQUESTADOR GROK — 2026-09-29 ~23:20 ECT

- Grok CLI (modelo grok-4.6) asumió orquestación. Codex permanece detenido hasta el reset de ventana 2026-09-30 01:29:51 ECT. No canjear resets ni créditos extra.
- Cuota Grok: **DESCONOCIDA** (`source=unknown`); sin aviso de <10 %. Acción: continuar este lote acotado y detenerse al aviso.
- Git inspeccionado: `.env` ignorado y no tracked; `git diff --check` sin errores; sin claves, tokens ni `.secrets/` en el árbol a publicar. No se tocó Docker, Nginx, Cloudflare ni otros contenedores/vhosts.
- Este commit publica lo ya verificado en MOCK: puntuación local por turno finalizado, Gateway opcional, serialización score-turn/`tool.call`, artefactos Contabo (`.dockerignore`, `deploy/contabo/`) y docs de estado. Evidencia previa (Claude 176/176 unitarias y typecheck; Codex `build`, `validate:spec`, 8/8 E2E) **no acredita G1**.
- **G1 público sigue pendiente de Jorge.** No marcar PASS. Video MP4 y envío lablab pendientes; no presentar submission sin instrucción específica.
- `origin/master` era `f579797`. Tras el push, usar `git log -1 --oneline` como HEAD público.

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
