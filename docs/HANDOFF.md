# Relevo de Sparring

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
