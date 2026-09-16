# Relevo de Sparring

## CHECKPOINT VIGENTE — 2026-09-16 11:33 ECT

**Leer esta sección primero. El contenido posterior a HISTÓRICO está superado.** Orquestador en este turno: Grok CLI 4.6, relevo pedido por Jorge. Codex sigue detenido (`ordinaryUsageAllowed=false` en el checkpoint previo, 0% de cinco horas, 71% semanal; reset5h Unix1789586852). No se canjearon resets ni se habilitó gasto adicional. No despachar tareas a Codex hasta recuperar cupo verificado. Cuota Grok: DESCONOCIDO; no hay telemetría en esta sesión. Parar al aviso ≤10%.

### Implementado en este relevo

- Suite verificada de padre, sin ocultar fallos: `npm run typecheck` exit 0; `npm test` **118/118 PASS** (7 archivos, incluye `tests/server/app.test.ts` 60 casos y `tests/voice/evaluateRecovery.test.ts` 7 casos); `npm run build` exit 0, Vite 8.3.0, 29 módulos, `dist/assets/index-BAoVxe85.js` 251 kB / gzip 78.85 kB. Bundle sin literales `ASSEMBLYAI_API_KEY` ni `Bearer`.
- `npm run test:e2e` **7/7 PASS**, 15.3s. Seis con API simulada; `tests/e2e/full-stack.spec.ts` usa servidor Node real y AssemblyAI simulado (vector 3/2/1/4/2 → 59, cobertura 100). **No es llamada real.**
- `server/app.ts` honra `SPARRING_MAX_SESSION_SECONDS` (60–240, defecto 240) y `SPARRING_DAILY_MINUTES_CAP` (1–30, defecto 30): misma cifra en reserva, deadline, `max_seconds` y `max_session_duration_seconds` del token. Enteros inválidos caen al defecto; fuera de rango se acotan. Tests HTTP cubren 90s, tope diario 1 min con sesiones de 60s, y clamp/default.
- Timeout HTTP de evaluación 3s: `src/voice/evaluateRecovery.ts` reintenta el mismo sobre (el servidor ya es idempotente). Si llega `revision_conflict`, rejuega el sobre anterior y reintenta. Si no hay snapshot, declara incompleto y no inventa éxito. Una evaluación tardía aceptada puede actualizar la revisión visible; el tool.result de ese call sigue siendo error si no se recuperó a tiempo.
- App local en ejecución: `npm run dev` (5173 web / 8787 api). `GET /api/health` → `{status:ok,key_configured:true,voice_enabled:true,mode:local}`. UI abierta en Chromium: tres casos, consentimiento requerido, Iniciar deshabilitado sin checkbox, sin overflow a 360px. Capturas `output/playwright/dev-{desktop,mobile}.png` (ignoradas). **No se inició práctica ni se pidió token al proveedor.**
- Clave local: KEY_CONFIGURED=true, SPARRING_VOICE_ENABLED=true. Valor nunca leído en chat ni herramientas. G1 sigue LIVE_NOT_RUN hasta persona + 90s + 2 updates (docs/LIVE-CHECK.md).
- Memoria reindexada fast: proyecto Sparring, generación 2026-09-16T16:31:39Z, 435 nodos / 1045 aristas, ready. `docs/`, `scripts/`, `tests/e2e/` y `tests/**/*.test.ts` excluidos por diseño (fast-pattern). Afirmaciones de código de tests se leyeron en fuente. Cobertura de `server/app.ts` y `src/voice/*` sin parse_partial.

### Evidencia

- `docs/evidence/implementation-checkpoint.json` actualizado con comandos, exit codes y mock vs live.
- Git: ver “Checkpoint Git” abajo. `.env`, dist, test-results, output/playwright, node_modules, `.cache`, `.agents-runtime` ignorados.

### Próximo trabajo concreto

1. **G1 con persona** según docs/LIVE-CHECK.md: Chrome/Edge, Entrega demorada, ≥90s en español, 2 updates durante roleplay, barge-in humano, coaching y Cortar audio. Una llamada ≤4 min. No repetir si hay error persistente o consumo imprevisto. No declarar G1 por los 7 e2e mock.
2. Si G1 pasa: registrar resultado literal en LIVE-CHECK (discrepancias transcripción, n updates, gasto observado en cuenta). Luego PWA/historial, contador distribuido y material de submission según PLAN. No desplegar el adaptador Map local.
3. Codex: no despachar hasta cupo 5h recuperado. Claude: no reanudar sin revisar cupo. Agy: no reintentar el ciclo 503 a ciegas.

### Agentes y procesos

- Este turno: Grok 4.6 en TUI, orquestación asumida. No se delegó a Claude/Agy/Codex.
- Codex: detenido por cuota 5h. Trabajador interno previo interrumpido; no reactivar.
- Dev local dejado activo en loopback 5173/8787 para que Jorge pueda hacer G1. No es un servidor público.
- Cuotas externas DESCONOCIDAS. Máximo 3 interacciones por evaluación Grok/Agy.

### Checkpoint Git

Pendiente de registrar en el mismo turno: commit inicial de archivos autorizados, sin `.env` ni artefactos ignorados.

### Comando de relevo manual

Si hay que ceder el turno: leer este CHECKPOINT y continuar por G1 (LIVE-CHECK) o, si el servidor local no está arriba, `npm run dev` y repetir health. No reiniciar planificación.

## HISTÓRICO — planificación previa (no estado vigente)

Actualizado: 2026-09-15 ECT / 2026-09-16 UTC. Orquestador: Codex. Sustituto solicitado: Grok CLI 4.6. Este documento es un checkpoint, no indicación de que Codex agotó cuota.

## Estado real

- Preparación SDD terminada y validada: node scripts/validate-spec.mjs terminó con exitcode0 y PASS. Evidencia en docs/evidence/planning-validation.json; sólo consistencia de especificación, producto NOT_RUN.
- Carpeta inicialmente vacía; hoy contiene documentos, prompts y contratos/fixtures. No app, deployment, API calls de voz, video, PDF ni submission.
- Se investigó evento, guías, docs AAI actuales y competencia. Hora exacta de cierre, MIT específico, equipo/eligibilidad e IBM Bob quedan pendientes de portal autenticado.
- Se clonó starter en .cache (ignorado), commit11b4c9508bef682785e8bdf23d5170b30aafb7a6; no se ejecutó. No se encontró archivo LICENSE en revisión inicial; no copiar al código MIT hasta resolver licencia.
- Reindexación al cierre: Sparring fast,161nodos/160aristas; índice excluye docs y scripts por diseño, además de .cache y .agents-runtime. Leer directamente esas rutas para validar; no interpretar exclusión como ausencia. Pedir index_status/check_index_coverage para generación vigente.
- En la comprobación de esta sesión, Grok quedó autenticado en grok.com con grok-4.6; Agy respondió AUTH_OK con gemini-3.8-flash-low sin herramientas. Claude reportó loggedIn:false y ahora tiene un flujo claude auth login abierto, esperando que el usuario complete el navegador/código. No afirmar revisión de Claude/Grok realizada.
- Memoria estructural al cierre: proyecto Sparring, generación 2026-09-16T04:49:11Z, modo fast, estado ready, 161 nodos/160 aristas. `docs/`, `scripts/`, `.cache/` y `.agents-runtime/` están excluidos por diseño; se leyeron directamente las rutas relevantes. No hay repo Git propio todavía.
- AGENTS.md fija reglas de coordinación, cuotas y3interacciones. No se activaron resets ni compras.

## Próxima orden concreta

Ejecutar P1 de docs/PROMPTS.md, luego P2. Puede programarse y probarse offline aunque falte API key. G1 sólo cierra con llamada real en español y herramientas de scoring antes del final. No gastar tiempo en UI completa antes de demostrar voz+tool.

1. Confirmar autenticación y cuota externa. Para Grok, modelo grok-4.6 debe aparecer en grok models y login ser válido; para Claude, auth status no basta si refresh falla.
2. Consultar index_status del grafo Sparring y coverage para código nuevo; estado inicial fast generation2026-09-16T04:28:37Z,2nodes/1edge y cero funciones, documentos posteriores fuera de esa referencia.
3. Leer SDD, TEST-PLAN y tools/scenarios/rubric. Ejecutar node scripts/validate-spec.mjs.
4. Crear proyecto app con scripts de build/tests y lockfile. Respetar separación voice/domain/ui y sin secretos cliente.
5. Preparar .env local sin imprimir valores; si no hay acceso a AAI, dejar spike mock etiquetado y gate LIVE_BLOCKED.
6. Registrar resultados, revisar cambios y actualizar este archivo antes de un relevo.

## Decisiones a preservar

- React/Vite TypeScript, funciones HTTP Vercel, browser WSS directo con token efímero.
- Inline config con tools cliente, no agent_id mezclado.
- Roleplay180s, finalización≤20s y coaching≤40s dentro240s totales.
- Score propuesto por actor, evidencia validada servidor, matemática determinista; formativo, no antifraude ni científicamente validado.
- Cinco criterios20/20/25/20/15, niveles0..4/null y totalnull si cobertura<60%.
- start_scenario/save_session app; log_objection/score_rubric tools reales.
- Historial local opt in, no audio grabado por app; revisar retención del proveedor.
- Cuota global atómica y kill switch antes de demo pública. Reserva minutos incluso en desconexión.
- No prometer interrupción agente→humano hasta pasarT20; humano→agente se prueba enT03.

## Pendientes del usuario (ya preguntados, no repetir sin necesidad)

- Cupo/facturación de Claude, Grok y Agy, horas humanas disponibles e integrantes.
- Restaurar login Claude y Grok.
- Portal lablab: hora/zona exacta y requisitos MIT/IBM Bob; equipo creado además de Enrolled.
- API key por archivo local y confirmación de acceso/saldo, antes de primera llamada. No enviar por chat.
- GitHub/hosting al preparar publicación. No necesarios para trabajar en contratos.

## Cuotas y relevo

Consulta inicial Codex:97% restante5h y97% semanal. Última consulta antes de cierre de planificación:41% restante5h y88% semanal; saldo de créditos sin cambio, sin resets consumidos. Fuente: get_usage_limits de la app. Es una foto, no estado perpetuo; reconsultar antes de despachar. Externos UNKNOWN, sin aviso recibido de≤10%; autenticación y cuota son distintos. Al aviso cercano al umbral: parar nuevos lotes, guardar trabajo/estado de procesos, actualizar uso+fuente+reset, diffs/commit, pruebas y siguiente comando. Relevo manual hacia Grok4.6 autenticado con cupo; no hay cambio automático garantizado.

No quedan procesos CLI activos de estas tareas. Las salidas brutas se guardaron en .agents-runtime. El directorio no se convirtió aún en repositorio Git propio ni se creó commit; hacerlo al iniciar implementación después de comprobar si hay repositorio padre.

## Plantilla de actualización

Último commit/diff: <consultar git, no inventar>.
Gate actual / tarea / dueño / archivos: <...>.
Pruebas y evidencias: <comando, exitcode, ruta, mock/live>.
Agentes activos y sesión reanudable: <...>.
Cuotas / hora / reset natural: <...>.
Bloqueos y trabajo independiente: <...>.
Siguiente orden mínima: <...>.
